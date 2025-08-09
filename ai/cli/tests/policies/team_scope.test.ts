import { teamScopePolicy } from '../../src/policies/team_scope';

describe('Team Scope Policy Generator', () => {
  describe('generate', () => {
    it('should generate team scope policies with default columns', () => {
      const sql = teamScopePolicy.generate('projects', {});
      
      // Check for RLS enablement
      expect(sql).toContain('ALTER TABLE public."projects" ENABLE ROW LEVEL SECURITY');
      
      // Check for team_select policy
      expect(sql).toContain('CREATE POLICY team_select ON public."projects"');
      expect(sql).toContain('FOR SELECT');
      expect(sql).toContain('"org_id" = auth_org()');
      expect(sql).toContain('OR is_admin()');
      
      // Check for team_insert policy
      expect(sql).toContain('CREATE POLICY team_insert ON public."projects"');
      expect(sql).toContain('FOR INSERT');
      expect(sql).toContain('"user_id" = auth_uid()');
      
      // Check for team_update policy
      expect(sql).toContain('CREATE POLICY team_update ON public."projects"');
      expect(sql).toContain('FOR UPDATE');
      
      // Check for team_delete policy
      expect(sql).toContain('CREATE POLICY team_delete ON public."projects"');
      expect(sql).toContain('FOR DELETE');
      
      // Check for grants
      expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public."projects" TO authenticated');
    });
    
    it('should generate policies with custom org column', () => {
      const sql = teamScopePolicy.generate('tasks', {
        orgCol: 'team_id'
      });
      
      expect(sql).toContain('"team_id" = auth_org()');
      expect(sql).not.toContain('"org_id" = auth_org()');
    });
    
    it('should generate policies with custom owner column', () => {
      const sql = teamScopePolicy.generate('documents', {
        ownerCol: 'created_by'
      });
      
      expect(sql).toContain('"created_by" = auth_uid()');
      expect(sql).not.toContain('"user_id" = auth_uid()');
    });
    
    it('should generate team-wide write access when no owner column specified', () => {
      const sql = teamScopePolicy.generate('shared_resources', {
        ownerCol: null
      });
      
      // Should not have owner restrictions in write policies
      expect(sql).toContain('CREATE POLICY team_insert');
      expect(sql).toContain('CREATE POLICY team_update');
      expect(sql).toContain('CREATE POLICY team_delete');
      
      // Should only check org membership for writes
      const insertMatch = sql.match(/CREATE POLICY team_insert[\s\S]*?WITH CHECK \(([\s\S]*?)\);/);
      expect(insertMatch).toBeTruthy();
      expect(insertMatch![1]).toContain('auth_org()');
      expect(insertMatch![1]).not.toContain('auth_uid()');
    });
    
    it('should add org column when requested', () => {
      const sql = teamScopePolicy.generate('new_table', {
        addOrgCol: true
      });
      
      expect(sql).toContain('ADD COLUMN "org_id" UUID');
      expect(sql).toContain('IF NOT EXISTS');
    });
    
    it('should add owner column when requested', () => {
      const sql = teamScopePolicy.generate('new_table', {
        addOwnerCol: true
      });
      
      expect(sql).toContain('ADD COLUMN "user_id" UUID');
    });
    
    it('should use idempotent policy creation', () => {
      const sql = teamScopePolicy.generate('items', {});
      
      // Check for existence checks
      expect(sql).toContain('IF NOT EXISTS');
      expect(sql).toContain('pg_policies');
      expect(sql).toContain('policyname = \'team_select\'');
    });
  });
  
  describe('validate', () => {
    it('should validate table name is required', () => {
      expect(() => teamScopePolicy.validate!('', {})).toThrow('Table name is required');
      expect(() => teamScopePolicy.validate!(null as any, {})).toThrow('Table name is required');
    });
    
    it('should validate org column name format', () => {
      expect(() => teamScopePolicy.validate!('tasks', { orgCol: '123invalid' }))
        .toThrow('Invalid organization column name');
      expect(() => teamScopePolicy.validate!('tasks', { orgCol: 'org-id' }))
        .toThrow('Invalid organization column name');
    });
    
    it('should validate owner column name format', () => {
      expect(() => teamScopePolicy.validate!('tasks', { ownerCol: '123invalid' }))
        .toThrow('Invalid owner column name');
      expect(() => teamScopePolicy.validate!('tasks', { ownerCol: 'user-id' }))
        .toThrow('Invalid owner column name');
    });
    
    it('should accept valid configurations', () => {
      expect(teamScopePolicy.validate!('valid_table', {})).toBe(true);
      expect(teamScopePolicy.validate!('valid_table', { orgCol: 'organization_id' })).toBe(true);
      expect(teamScopePolicy.validate!('valid_table', { ownerCol: 'owner_id' })).toBe(true);
      expect(teamScopePolicy.validate!('valid_table', { 
        orgCol: 'org_id',
        ownerCol: 'user_id' 
      })).toBe(true);
    });
  });
});