-- KickStack PostgreSQL Base Schema
-- Extensions, roles, and core tables for PostgREST/RLS

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create roles for PostgREST
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN 
  RAISE NOTICE 'Role anon already exists';
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN 
  RAISE NOTICE 'Role authenticated already exists';
END $$;

-- Grant usage on public schema to roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Realtime change log table (PostgreSQL version)
CREATE TABLE IF NOT EXISTS kickstack_changes (
  id BIGSERIAL PRIMARY KEY,
  ts BIGINT NOT NULL,
  table_name TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('insert', 'update', 'delete')),
  row_pk TEXT,
  payload JSONB
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_kc_ts ON kickstack_changes(ts);
CREATE INDEX IF NOT EXISTS idx_kc_table ON kickstack_changes(table_name);
CREATE INDEX IF NOT EXISTS idx_kc_table_ts ON kickstack_changes(table_name, ts);

-- Grant permissions on kickstack_changes
GRANT SELECT ON kickstack_changes TO anon, authenticated;
GRANT INSERT ON kickstack_changes TO anon, authenticated;

-- Auto-cleanup old changes (keep last 10000)
CREATE OR REPLACE FUNCTION cleanup_old_changes() RETURNS trigger AS $$
BEGIN
  DELETE FROM kickstack_changes
  WHERE id < (
    SELECT id FROM kickstack_changes
    ORDER BY id DESC
    LIMIT 1 OFFSET 10000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cleanup_changes ON kickstack_changes;
CREATE TRIGGER tr_cleanup_changes
AFTER INSERT ON kickstack_changes
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_old_changes();