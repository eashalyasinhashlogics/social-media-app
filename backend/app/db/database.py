from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.config import DATABASE_URL

# Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class for models
Base = declarative_base()

def test_database_connection():
    """Test if we can connect to the database"""
    try:
        with engine.connect() as connection:
            # SQLAlchemy 2.0 requires wrapping raw strings with text()
            connection.execute(text("SELECT 1"))
            print("? Database connection successful!")
            return True
    except Exception as e:
        print(f"? Database connection failed: {e}")
        return False

if __name__ == "__main__":
    test_database_connection()
