import { adminOverridePolicy } from '../../src/policies/admin_override';

describe('Admin Override Policy Generator', () => {
  describe('generate', () => {
    it('should generate admin override policies for all operations', () => {
      const sql = adminOverridePolicy.generate('sensitive_data', {});
      
      // Check for RLS enablement
      expect(sql).toContain('ALTER TABLE public."sensitive_data" ENABLE ROW LEVEL SECURITY');
      
      // Check for admin_select policy
      expect(sql).toContain('CREATE POLICY admin_select ON public."sensitive_data"');
      expect(sql).toContain('FOR SELECT');
      expect(sql).toContain('USING (is_admin())');
      
      // Check for admin_insert policy
      expect(sql).toContain('CREATE POLICY admin_insert ON public."sensitive_data"');
      expect(sql).toContain('FOR INSERT');
      expect(sql).toContain('WITH CHECK (is_admin())');
      
      // Check for admin_update policy
      expect(sql).toContain('CREATE POLICY admin_update ON public."sensitive_data"');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('USING (is_admin())');
      expect(sql).toContain('WITH CHECK (is_admin())');
      
      // Check for admin_delete policy
      expect(sql).toContain('CREATE POLICY admin_delete ON public."sensitive_data"');
      expect(sql).toContain('FOR DELETE');
      expect(sql).toContain('USING (is_admin())');
      
      // Check for grants
      expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public."sensitive_data" TO authenticated');
    });
    
    it('should use idempotent policy creation with DO blocks', () => {
      const sql = adminOverridePolicy.generate('logs', {});
      
      // Check for DO blocks
      expect(sql).toContain('DO $$');
      expect(sql).toContain('BEGIN');
      expect(sql).toContain('END $$');
      
      // Check for DROP IF EXISTS
      expect(sql).toContain('DROP POLICY IF EXISTS admin_select');
      expect(sql).toContain('DROP POLICY IF EXISTS admin_insert');
      expect(sql).toContain('DROP POLICY IF EXISTS admin_update');
      expect(sql).toContain('DROP POLICY IF EXISTS admin_delete');
    });
    
    it('should include explanatory comments', () => {
      const sql = adminOverridePolicy.generate('audit_logs', {});
      
      // Check for comments
      expect(sql).toContain('Admin Override RLS Policy');
      expect(sql).toContain('Grants full access to admin and service_role tokens');
      expect(sql).toContain('Admins can see all rows');
      expect(sql).toContain('Admins can insert any rows');
      expect(sql).toContain('Admins can update any rows');
      expect(sql).toContain('Admins can delete any rows');
      expect(sql).toContain('PostgreSQL RLS policies are combined with OR logic');
    });
    
    it('should properly escape table names', () => {
      const sql = adminOverridePolicy.generate('user_profiles', {});
      
      // Check that table name is properly quoted
      expect(sql).toContain('public."user_profiles"');
      expect(sql).not.toContain('public.user_profiles"');
      expect(sql).not.toContain('public."user_profiles""');
    });
    
    it('should generate consistent policy names', () => {
      const sql = adminOverridePolicy.generate('documents', {});
      
      // Count occurrences of each policy name
      const selectCount = (sql.match(/admin_select/g) || []).length;
      const insertCount = (sql.match(/admin_insert/g) || []).length;
      const updateCount = (sql.match(/admin_update/g) || []).length;
      const deleteCount = (sql.match(/admin_delete/g) || []).length;
      
      // Each policy should be mentioned at least twice (DROP and CREATE)
      expect(selectCount).toBeGreaterThanOrEqual(2);
      expect(insertCount).toBeGreaterThanOrEqual(2);
      expect(updateCount).toBeGreaterThanOrEqual(2);
      expect(deleteCount).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('validate', () => {
    it('should validate table name is required', () => {
      expect(() => adminOverridePolicy.validate!('', {})).toThrow('Table name is required');
      expect(() => adminOverridePolicy.validate!(null as any, {})).toThrow('Table name is required');
      expect(() => adminOverridePolicy.validate!(undefined as any, {})).toThrow('Table name is required');
    });
    
    it('should validate table name format', () => {
      expect(() => adminOverridePolicy.validate!('123invalid', {}))
        .toThrow('Invalid table name');
      expect(() => adminOverridePolicy.validate!('table-name', {}))
        .toThrow('Invalid table name');
      expect(() => adminOverridePolicy.validate!('table name', {}))
        .toThrow('Invalid table name');
      expect(() => adminOverridePolicy.validate!('Table', {}))
        .toThrow('Invalid table name');
    });
    
    it('should accept valid table names', () => {
      expect(adminOverridePolicy.validate!('valid_table', {})).toBe(true);
      expect(adminOverridePolicy.validate!('users', {})).toBe(true);
      expect(adminOverridePolicy.validate!('user_profiles', {})).toBe(true);
      expect(adminOverridePolicy.validate!('_private_table', {})).toBe(true);
      expect(adminOverridePolicy.validate!('table123', {})).toBe(true);
    });
    
    it('should ignore options parameter', () => {
      // Admin override doesn't use options, so should accept anything
      expect(adminOverridePolicy.validate!('valid_table', { anything: 'goes' })).toBe(true);
      expect(adminOverridePolicy.validate!('valid_table', null)).toBe(true);
      expect(adminOverridePolicy.validate!('valid_table', undefined)).toBe(true);
    });
  });
});