import os
import sys
sys.path.insert(0, os.getcwd())

from sqlalchemy import text
from app.db.database import engine

print("\n" + "="*60)
print("DATABASE CONSTRAINTS & INDEXES VERIFICATION")
print("="*60)

with engine.connect() as connection:
     # Check UNIQUE constraints
     print("\n[UNIQUE CONSTRAINTS]")
     result = connection.execute(text("""
         SELECT constraint_name, table_name
         FROM information_schema.table_constraints
         WHERE constraint_type = 'UNIQUE' AND table_schema = 'public'
         ORDER BY table_name
     """))

     unique_constraints = list(result)
     for constraint, table in unique_constraints:
         print(f"   ? {table}: {constraint}")

     # Check CHECK constraints
     print("\n[CHECK CONSTRAINTS]")
     result = connection.execute(text("""
         SELECT constraint_name, table_name
         FROM information_schema.table_constraints
         WHERE constraint_type = 'CHECK' AND table_schema = 'public'
         ORDER BY table_name
     """))

     check_constraints = list(result)
     for constraint, table in check_constraints:
         print(f"   ? {table}: {constraint}")

     # Check Triggers
     print("\n[TRIGGERS]")
     result = connection.execute(text("""
         SELECT trigger_name, event_object_table AS table_name
         FROM information_schema.triggers
         WHERE trigger_schema = 'public'
         ORDER BY event_object_table
     """))

     triggers = list(result)
     for trigger, table in triggers:
         print(f"   ? {table}: {trigger}")

     # Check Indexes
     print("\n[INDEXES (Sample)]")
     result = connection.execute(text("""
         SELECT indexname, tablename
         FROM pg_indexes
         WHERE schemaname = 'public'
         LIMIT 10
     """))

     indexes = list(result)
     for idx, table in indexes:
         print(f"   ? {table}: {idx}")

     print(f"\n   ... and {len(indexes)}+ more indexes")

print("\n" + "="*60)
print("? SCHEMA VERIFICATION COMPLETE")
print("="*60 + "\n")
