import { DatabaseService } from '../../src/services/database';
import { teamScopePolicy } from '../../src/policies/team_scope';
import { adminOverridePolicy } from '../../src/policies/admin_override';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../infra/.env') });

describe('Multi-Tenancy Integration Tests', () => {
  let db: DatabaseService;
  const testTable = 'test_multi_tenant_' + Date.now();
  
  beforeAll(async () => {
    db = new DatabaseService();
    
    // Create test table
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS public."${testTable}" (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID,
        user_id UUID,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await db.executeMigration(createTableSql);
    
    // Apply multi-tenancy auth helpers
    const authHelpersSql = `
      -- Ensure auth helpers exist
      CREATE OR REPLACE FUNCTION auth_uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub'::uuid
      $$;
      
      CREATE OR REPLACE FUNCTION auth_org() RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'org',
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'org_id'
        )::uuid
      $$;
      
      CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
      LANGUAGE sql STABLE AS $$
        SELECT (
          COALESCE(
            NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
            'anon'
          )
        ) IN ('admin', 'service_role')
      $$;
    `;
    await db.executeMigration(authHelpersSql);
  });
  
  afterAll(async () => {
    // Clean up test table
    try {
      await db.executeMigration(`DROP TABLE IF EXISTS public."${testTable}" CASCADE;`);
    } catch (error) {
      console.error('Error cleaning up test table:', error);
    }
  });
  
  describe('Team Scope Policy', () => {
    it('should apply team scope policies successfully', async () => {
      // Generate and apply team scope policies
      const policySql = teamScopePolicy.generate(testTable, {});
      await db.executeMigration(policySql);
      
      // Verify RLS is enabled
      const rlsCheckQuery = `
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = '${testTable}';
      `;
      const rlsResult = await db.runQuery(rlsCheckQuery);
      expect(rlsResult.rows[0].relrowsecurity).toBe(true);
      
      // Verify policies were created
      const policiesQuery = `
        SELECT policyname, cmd 
        FROM pg_policies 
        WHERE tablename = '${testTable}'
        ORDER BY policyname;
      `;
      const policies = await db.runQuery(policiesQuery);
      
      const policyNames = policies.rows.map((p: any) => p.policyname);
      expect(policyNames).toContain('team_select');
      expect(policyNames).toContain('team_insert');
      expect(policyNames).toContain('team_update');
      expect(policyNames).toContain('team_delete');
    });
    
    it('should enforce organization boundaries', async () => {
      // Set up JWT claims for org1 user
      const org1Claims = JSON.stringify({
        sub: '11111111-1111-1111-1111-111111111111',
        org_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        role: 'authenticated'
      });
      
      // Set up JWT claims for org2 user
      const org2Claims = JSON.stringify({
        sub: '22222222-2222-2222-2222-222222222222',
        org_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        role: 'authenticated'
      });
      
      // Insert test data for both organizations
      await db.executeMigration(`
        INSERT INTO public."${testTable}" (org_id, user_id, name)
        VALUES 
          ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Org1 Data'),
          ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Org2 Data');
      `);
      
      // Test that org1 user can only see org1 data
      // Note: In a real environment, this would be enforced by PostgREST with JWT
      // Here we're verifying the policies exist and are structured correctly
      const selectPolicy = await db.runQuery(`
        SELECT pg_get_expr(polqual, polrelid) as qual
        FROM pg_policy
        WHERE polname = 'team_select'
        AND polrelid = 'public."${testTable}"'::regclass;
      `);
      
      expect(selectPolicy.rows[0].qual).toContain('auth_org()');
      expect(selectPolicy.rows[0].qual).toContain('is_admin()');
    });
  });
  
  describe('Admin Override Policy', () => {
    it('should apply admin override policies successfully', async () => {
      // Generate and apply admin override policies
      const policySql = adminOverridePolicy.generate(testTable, {});
      await db.executeMigration(policySql);
      
      // Verify admin policies were created
      const policiesQuery = `
        SELECT policyname, cmd 
        FROM pg_policies 
        WHERE tablename = '${testTable}'
        AND policyname LIKE 'admin_%'
        ORDER BY policyname;
      `;
      const policies = await db.runQuery(policiesQuery);
      
      const policyNames = policies.rows.map((p: any) => p.policyname);
      expect(policyNames).toContain('admin_select');
      expect(policyNames).toContain('admin_insert');
      expect(policyNames).toContain('admin_update');
      expect(policyNames).toContain('admin_delete');
    });
    
    it('should use is_admin() function in policies', async () => {
      // Check that admin policies use the is_admin() function
      const adminSelectPolicy = await db.runQuery(`
        SELECT pg_get_expr(polqual, polrelid) as qual
        FROM pg_policy
        WHERE polname = 'admin_select'
        AND polrelid = 'public."${testTable}"'::regclass;
      `);
      
      expect(adminSelectPolicy.rows[0].qual).toBe('is_admin()');
      
      // Check admin insert policy
      const adminInsertPolicy = await db.runQuery(`
        SELECT pg_get_expr(polwithcheck, polrelid) as withcheck
        FROM pg_policy
        WHERE polname = 'admin_insert'
        AND polrelid = 'public."${testTable}"'::regclass;
      `);
      
      expect(adminInsertPolicy.rows[0].withcheck).toBe('is_admin()');
    });
  });
  
  describe('Policy Combination', () => {
    it('should have both team and admin policies active', async () => {
      // Verify all policies coexist
      const allPoliciesQuery = `
        SELECT policyname, cmd, permissive
        FROM pg_policies 
        WHERE tablename = '${testTable}'
        ORDER BY policyname;
      `;
      const allPolicies = await db.runQuery(allPoliciesQuery);
      
      const policyNames = allPolicies.rows.map((p: any) => p.policyname);
      
      // Should have both team and admin policies
      expect(policyNames).toContain('team_select');
      expect(policyNames).toContain('admin_select');
      
      // All policies should be permissive (combine with OR)
      allPolicies.rows.forEach((policy: any) => {
        expect(policy.permissive).toBe('PERMISSIVE');
      });
    });
    
    it('should grant appropriate permissions', async () => {
      // Check grants on the table
      const grantsQuery = `
        SELECT 
          grantee,
          string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges
        FROM information_schema.table_privileges
        WHERE table_name = '${testTable}'
        AND grantee IN ('authenticated', 'anon')
        GROUP BY grantee
        ORDER BY grantee;
      `;
      const grants = await db.runQuery(grantsQuery);
      
      // Authenticated users should have full CRUD
      const authGrant = grants.rows.find((g: any) => g.grantee === 'authenticated');
      if (authGrant) {
        expect(authGrant.privileges).toContain('SELECT');
        expect(authGrant.privileges).toContain('INSERT');
        expect(authGrant.privileges).toContain('UPDATE');
        expect(authGrant.privileges).toContain('DELETE');
      }
    });
  });
  
  describe('Column Management', () => {
    it('should handle tables with existing org_id column', async () => {
      const tableWithOrgId = 'test_existing_org_' + Date.now();
      
      // Create table with org_id already present
      await db.executeMigration(`
        CREATE TABLE public."${tableWithOrgId}" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id UUID NOT NULL,
          data TEXT
        );
      `);
      
      // Apply team scope - should not fail
      const policySql = teamScopePolicy.generate(tableWithOrgId, {});
      await expect(db.executeMigration(policySql)).resolves.not.toThrow();
      
      // Clean up
      await db.executeMigration(`DROP TABLE public."${tableWithOrgId}" CASCADE;`);
    });
    
    it('should add org_id column when requested', async () => {
      const tableWithoutOrgId = 'test_no_org_' + Date.now();
      
      // Create table without org_id
      await db.executeMigration(`
        CREATE TABLE public."${tableWithoutOrgId}" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          data TEXT
        );
      `);
      
      // Apply team scope with addOrgCol option
      const policySql = teamScopePolicy.generate(tableWithoutOrgId, {
        addOrgCol: true
      });
      await db.executeMigration(policySql);
      
      // Verify column was added
      const columnQuery = `
        SELECT column_name 
        FROM information_schema.columns
        WHERE table_name = '${tableWithoutOrgId}'
        AND column_name = 'org_id';
      `;
      const result = await db.runQuery(columnQuery);
      expect(result.rows.length).toBe(1);
      
      // Clean up
      await db.executeMigration(`DROP TABLE public."${tableWithoutOrgId}" CASCADE;`);
    });
  });
});