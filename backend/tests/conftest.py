import os

# Point every test at an isolated test database BEFORE any `app.*` module
# gets imported. `app.config` calls `load_dotenv()`, which never overrides
# an env var that's already set - so setting DATABASE_URL here first means
# the real .env value (the shared dev database) is never used by tests.
os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:1234@localhost:5433/social_media_app_test",
)

import pytest

from app.db.database import engine
import app.models  # noqa: F401 - registers every model on Base.metadata
from app.db.base import Base

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


@pytest.fixture(scope="session", autouse=True)
def _test_schema():
    """Build the schema in the test database once per test run, and tear
    it down afterward, so test runs never accumulate leftover users/posts
    the way they did when tests ran against the shared dev database."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)