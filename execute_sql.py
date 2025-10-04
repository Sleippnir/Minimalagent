#!/usr/bin/env python3
"""
Execute SQL script to update the generate_interview_payload function
"""

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

def execute_sql_file():
    """Execute the SQL file"""
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    # Read the SQL file
    with open('supabase/generate_interview_payload.sql', 'r') as f:
        sql = f.read()

    # Split SQL into individual statements (basic approach)
    statements = [stmt.strip() for stmt in sql.split(';') if stmt.strip()]

    for statement in statements:
        if statement:
            try:
                # Use raw SQL execution - this might not work with anon key
                print(f"Executing: {statement[:50]}...")
                # This won't work with anon key, need service role or direct DB access
            except Exception as e:
                print(f"Failed: {e}")

    print("Note: This script needs service role key or direct DB access to execute DDL")

if __name__ == "__main__":
    execute_sql_file()