import os
import sys
sys.path.insert(0, os.getcwd())

from app.db.database import engine
from sqlalchemy import inspect

# Connect and inspect
inspector = inspect(engine)
tables = inspector.get_table_names()

print("\n" + "="*60)
print("TABLES IN DATABASE")
print("="*60)

for table in sorted(tables):
    columns = inspector.get_columns(table)
    print(f"\n{table}:")
    for col in columns[:3]:  # Show first 3 columns
        print(f"  - {col['name']}: {col['type']}")
    if len(columns) > 3:
        print(f"  ... and {len(columns)-3} more columns")

print(f"\n? Total tables: {len(tables)}")
print("? Expected: 19 tables (+ alembic_version = 20)")
print("="*60 + "\n")

