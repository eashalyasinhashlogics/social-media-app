from sqlalchemy import inspect
from app.db.database import engine

def get_database_info():
    """Get information about the database"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    info = {}
    for table in tables:
        columns = inspector.get_columns(table)
        info[table] = [col['name'] for col in columns]
    
    return info

def print_database_info():
    """Print database schema information"""
    info = get_database_info()
    
    print("\n" + "="*60)
    print("DATABASE SCHEMA")
    print("="*60)
    
    for table, columns in info.items():
        print(f"\n{table}:")
        for col in columns:
            print(f"  - {col}")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    print_database_info()
