-- Auto-grant permissions for new tables
-- This ensures all new tables are accessible via the PostgREST API

-- Function to automatically grant permissions to new tables
CREATE OR REPLACE FUNCTION auto_grant_table_permissions() 
RETURNS event_trigger 
LANGUAGE plpgsql 
AS $$
DECLARE
    obj record;
BEGIN
    -- Loop through created objects
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
    LOOP
        -- Grant permissions to anon role (for public API access)
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO anon', obj.object_identity);
        
        -- Grant permissions to authenticated role
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO authenticated', obj.object_identity);
        
        -- Grant usage on sequences (for auto-incrementing columns)
        EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %s TO anon', 
                       split_part(obj.object_identity, '.', 1));
        EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %s TO authenticated', 
                       split_part(obj.object_identity, '.', 1));
        
        RAISE NOTICE 'Auto-granted permissions for table: %', obj.object_identity;
    END LOOP;
    
    -- Notify PostgREST to reload schema
    NOTIFY pgrst, 'reload schema';
    
END;
$$;

-- Create event trigger to run the function on table creation
DROP EVENT TRIGGER IF EXISTS auto_grant_permissions_trigger;
CREATE EVENT TRIGGER auto_grant_permissions_trigger 
ON ddl_command_end 
WHEN tag IN ('CREATE TABLE')
EXECUTE FUNCTION auto_grant_table_permissions();

-- Grant permissions on all existing tables that might be missing them
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        -- Grant permissions to anon and authenticated roles
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO anon', tbl.schemaname, tbl.tablename);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO authenticated', tbl.schemaname, tbl.tablename);
        
        RAISE NOTICE 'Granted permissions for existing table: %.%', tbl.schemaname, tbl.tablename;
    END LOOP;
    
    -- Grant sequence permissions
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
END;
$$;

-- Notify PostgREST about schema changes
NOTIFY pgrst, 'reload schema';