import { OwnerPolicyGenerator, OwnerPolicyOptions } from '../../src/policies/owner';

describe('OwnerPolicyGenerator', () => {
  describe('generatePolicies', () => {
    it('should generate complete RLS policy SQL for a table', () => {
      const options: OwnerPolicyOptions = {
        table: 'contacts',
        ownerCol: 'user_id',
        addOwnerCol: false
      };

      const sql = OwnerPolicyGenerator.generatePolicies(options);

      // Check that RLS is enabled
      expect(sql).toContain('ALTER TABLE public."contacts" ENABLE ROW LEVEL SECURITY');

      // Check for all four policies
      expect(sql).toContain('CREATE POLICY select_own');
      expect(sql).toContain('CREATE POLICY insert_own');
      expect(sql).toContain('CREATE POLICY update_own');
      expect(sql).toContain('CREATE POLICY delete_own');

      // Check that policies use auth_uid()
      expect(sql).toContain('"user_id" = auth_uid()');

      // Check for grants
      expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public."contacts" TO authenticated');
      expect(sql).toContain('REVOKE ALL ON public."contacts" FROM anon');

      // Check for idempotent DO blocks
      expect(sql).toContain('IF NOT EXISTS');
      expect(sql).toContain('pg_policies');
    });

    it('should include ADD COLUMN statement when addOwnerCol is true', () => {
      const options: OwnerPolicyOptions = {
        table: 'products',
        ownerCol: 'owner_id',
        addOwnerCol: true
      };

      const sql = OwnerPolicyGenerator.generatePolicies(options);

      // Check for ADD COLUMN statement
      expect(sql).toContain('ALTER TABLE public."products"');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS "owner_id" UUID NOT NULL DEFAULT auth_uid()');

      // Check for index creation
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_products_owner_id');
    });

    it('should use custom owner column name', () => {
      const options: OwnerPolicyOptions = {
        table: 'documents',
        ownerCol: 'created_by',
        addOwnerCol: false
      };

      const sql = OwnerPolicyGenerator.generatePolicies(options);

      // Check that custom column name is used in policies
      expect(sql).toContain('"created_by" = auth_uid()');
      expect(sql).not.toContain('"user_id"');
    });

    it('should include policy comments for documentation', () => {
      const options: OwnerPolicyOptions = {
        table: 'notes',
        ownerCol: 'user_id',
        addOwnerCol: false
      };

      const sql = OwnerPolicyGenerator.generatePolicies(options);

      // Check for comment statements
      expect(sql).toContain('COMMENT ON POLICY select_own');
      expect(sql).toContain('COMMENT ON POLICY insert_own');
      expect(sql).toContain('COMMENT ON POLICY update_own');
      expect(sql).toContain('COMMENT ON POLICY delete_own');
      expect(sql).toContain('matches their auth_uid()');
    });
  });

  describe('generateAddOwnerColumn', () => {
    it('should generate SQL to add owner column with default', () => {
      const sql = OwnerPolicyGenerator.generateAddOwnerColumn('tasks', 'assigned_by');

      expect(sql).toContain('ALTER TABLE public."tasks"');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS "assigned_by" UUID NOT NULL DEFAULT auth_uid()');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by');
    });
  });

  describe('generateColumnCheckQuery', () => {
    it('should generate query to check if column exists', () => {
      const sql = OwnerPolicyGenerator.generateColumnCheckQuery('orders', 'customer_id');

      expect(sql).toContain('SELECT EXISTS');
      expect(sql).toContain('information_schema.columns');
      expect(sql).toContain("table_name = 'orders'");
      expect(sql).toContain("column_name = 'customer_id'");
    });
  });

  describe('generateListPoliciesQuery', () => {
    it('should generate query to list policies on a table', () => {
      const sql = OwnerPolicyGenerator.generateListPoliciesQuery('invoices');

      expect(sql).toContain('SELECT');
      expect(sql).toContain('pg_policies');
      expect(sql).toContain("tablename = 'invoices'");
      expect(sql).toContain('policyname');
      expect(sql).toContain('ORDER BY policyname');
    });
  });
});