import os
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

# Point every test at an isolated test database BEFORE any `app.*` module
# gets imported. `app.config` calls `load_dotenv()`, which never overrides
# an env var that's already set - so setting DATABASE_URL here first means
# the real .env value (the shared dev database) is never used by tests.
db_url = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:1234@localhost:5433/social_media_app_test",
)
os.environ["DATABASE_URL"] = db_url

# Safety net: refuse to run against anything that isn't clearly a test
# database, so a misconfigured TEST_DATABASE_URL can't silently start
# writing/deleting rows in the real dev or prod database again.
_db_name = os.environ["DATABASE_URL"].rsplit("/", 1)[-1]
if "test" not in _db_name.lower():
    raise RuntimeError(
        "Refusing to run tests: DATABASE_URL does not look like a test "
        f"database (got '{_db_name}'). Set TEST_DATABASE_URL to a "
        "database whose name contains 'test', e.g. "
        "postgresql://postgres:1234@localhost:5433/social_media_app_test"
    )

from app.db.database import engine
import app.models  # noqa: F401 - registers every model on Base.metadata
from app.db.base import Base


def _ensure_test_database_exists(url_str: str) -> None:
    """Connects to the default 'postgres' DB to create the test DB if it doesn't exist."""
    url = make_url(url_str)
    target_db = url.database

    # Create temporary engine connected to 'postgres' system database
    system_db_url = url._replace(database="postgres")
    admin_engine = create_engine(system_db_url, isolation_level="AUTOCOMMIT")

    with admin_engine.connect() as conn:
        result = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
            {"dbname": target_db},
        )
        if not result.scalar():
            # DB names with special characters or underscores should be quote-escaped
            conn.execute(text(f'CREATE DATABASE "{target_db}"'))

    admin_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _test_schema():
    """Build the schema in the test database once per test run, and tear
    it down afterward, so test runs never accumulate leftover users/posts
    the way they did when tests ran against the shared dev database."""
    # Ensure the database exists on the PostgreSQL server first
    _ensure_test_database_exists(os.environ["DATABASE_URL"])

    # Nuke and recreate the schema first, rather than trusting create_all's
    # checkfirst behavior - guarantees a clean slate even if a prior run
    # crashed and left a stale/renamed constraint behind (that's what broke
    # drop_all() by name: it tries to drop constraints using the name your
    # *current* models generate, which stops matching the moment the live
    # DB has an older/differently-named constraint from a previous schema).
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    Base.metadata.create_all(bind=engine)
    yield
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))