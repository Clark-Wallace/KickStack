-- KickStack Auth Helpers for Row-Level Security
-- These functions enable RLS policies to access JWT claims via PostgREST

-- Returns the UUID 'sub' claim from the current JWT or NULL
-- Used to identify the current authenticated user
CREATE OR REPLACE FUNCTION auth_uid() RETURNS uuid
LANGUAGE sql STABLE 
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
$$;

-- Returns the JWT 'role' claim (e.g., 'authenticated' or 'anon')
-- Defaults to 'anon' if no JWT is present
CREATE OR REPLACE FUNCTION auth_role() RETURNS text
LANGUAGE sql STABLE 
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', 'anon')
$$;

-- Convenience function to check if user is authenticated
-- Returns true if role is not 'anon'
CREATE OR REPLACE FUNCTION is_authenticated() RETURNS boolean
LANGUAGE sql STABLE 
AS $$
  SELECT auth_role() <> 'anon'
$$;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION auth_uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_authenticated() TO anon, authenticated;

-- Add comment documentation
COMMENT ON FUNCTION auth_uid() IS 'Returns the UUID of the current authenticated user from JWT sub claim';
COMMENT ON FUNCTION auth_role() IS 'Returns the role of the current user from JWT role claim';
COMMENT ON FUNCTION is_authenticated() IS 'Returns true if the current user is authenticated';