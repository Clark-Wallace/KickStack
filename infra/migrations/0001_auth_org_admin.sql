-- KickStack Multi-Tenancy & Admin Auth Helpers
-- Provides organization-scoped access and admin override capabilities

-- Org claim helper: expects JWT with {"org":"<uuid>"} or {"org_id":"<uuid>"}
CREATE OR REPLACE FUNCTION auth_org() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'org',
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'org_id'
    )::uuid
$$;

-- Admin detection: role=='admin' or 'service_role'
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
      'anon'
    )
  ) IN ('admin', 'service_role')
$$;

-- Helper to check if user is authenticated (not anon)
CREATE OR REPLACE FUNCTION is_authenticated() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
      'anon'
    )
  ) = 'authenticated'
$$;

-- Helper to get user's role from JWT
CREATE OR REPLACE FUNCTION auth_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    'anon'
  )
$$;

-- Comments for documentation
COMMENT ON FUNCTION auth_org IS 'Returns organization UUID from JWT claims (org or org_id field)';
COMMENT ON FUNCTION is_admin IS 'Returns true for admin or service_role tokens';
COMMENT ON FUNCTION is_authenticated IS 'Returns true for authenticated users (not anonymous)';
COMMENT ON FUNCTION auth_role IS 'Returns the current user role from JWT (anon, authenticated, admin, service_role)';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auth_org TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_authenticated TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth_role TO anon, authenticated;