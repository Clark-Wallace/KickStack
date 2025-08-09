import { PublicReadPolicyGenerator, PublicReadPolicyOptions } from '../../src/policies/public_read';

describe('PublicReadPolicyGenerator', () => {
  describe('generatePolicies', () => {
    it('should generate complete public_read RLS policy SQL for a table', () => {
      const options: PublicReadPolicyOptions = {
        table: 'blog_posts',
        ownerCol: 'author_id',
        addOwnerCol: false
      };

      const sql = PublicReadPolicyGenerator.generatePolicies(options);

      // Check that RLS is enabled
      expect(sql).toContain('ALTER TABLE public."blog_posts" ENABLE ROW LEVEL SECURITY');

      // Check for all four policies with correct names
      expect(sql).toContain('CREATE POLICY select_public');
      expect(sql).toContain('CREATE POLICY insert_own');
      expect(sql).toContain('CREATE POLICY update_own');
      expect(sql).toContain('CREATE POLICY delete_own');

      // Check that select_public uses TRUE for public read
      expect(sql).toContain('FOR SELECT');
      expect(sql).toContain('USING (TRUE)');

      // Check that write policies use auth_uid()
      expect(sql).toContain('"author_id" = auth_uid()');

      // Check for grants - anon gets SELECT only
      expect(sql).toContain('GRANT SELECT ON public."blog_posts" TO anon');
      expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public."blog_posts" FROM anon');

      // Check for grants - authenticated gets all operations
      expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public."blog_posts" TO authenticated');

      // Check for idempotent DO blocks
      expect(sql).toContain('IF NOT EXISTS');
      expect(sql).toContain('pg_policies');
    });

    it('should include ADD COLUMN statement when addOwnerCol is true', () => {
      const options: PublicReadPolicyOptions = {
        table: 'articles',
        ownerCol: 'created_by',
        addOwnerCol: true
      };

      const sql = PublicReadPolicyGenerator.generatePolicies(options);

      // Check for ADD COLUMN statement
      expect(sql).toContain('ALTER TABLE public."articles"');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS "created_by" UUID NOT NULL DEFAULT auth_uid()');

      // Check for index creation
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_articles_created_by');
    });

    it('should use custom owner column name in policies', () => {
      const options: PublicReadPolicyOptions = {
        table: 'comments',
        ownerCol: 'commenter_id',
        addOwnerCol: false
      };

      const sql = PublicReadPolicyGenerator.generatePolicies(options);

      // Check that custom column name is used in write policies
      expect(sql).toContain('"commenter_id" = auth_uid()');
      expect(sql).not.toContain('"user_id"');
      expect(sql).not.toContain('"author_id"');
    });

    it('should include policy comments for documentation', () => {
      const options: PublicReadPolicyOptions = {
        table: 'announcements',
        ownerCol: 'publisher_id',
        addOwnerCol: false
      };

      const sql = PublicReadPolicyGenerator.generatePolicies(options);

      // Check for comment statements
      expect(sql).toContain('COMMENT ON POLICY select_public');
      expect(sql).toContain('COMMENT ON POLICY insert_own');
      expect(sql).toContain('COMMENT ON POLICY update_own');
      expect(sql).toContain('COMMENT ON POLICY delete_own');
      
      // Check for specific comment content
      expect(sql).toContain('Allow public read access');
      expect(sql).toContain('matches their auth_uid()');
    });

    it('should have different SELECT policy than owner preset', () => {
      const options: PublicReadPolicyOptions = {
        table: 'public_data',
        ownerCol: 'owner_id',
        addOwnerCol: false
      };

      const sql = PublicReadPolicyGenerator.generatePolicies(options);

      // Verify select_public is truly public (TRUE condition)
      expect(sql).toMatch(/CREATE POLICY select_public[\s\S]*?FOR SELECT[\s\S]*?USING \(TRUE\)/);
      
      // Verify it's not using auth_uid() for SELECT like owner preset would
      const selectPolicyMatch = sql.match(/CREATE POLICY select_public[\s\S]*?USING \([^)]+\)/);
      expect(selectPolicyMatch).toBeTruthy();
      if (selectPolicyMatch) {
        expect(selectPolicyMatch[0]).not.toContain('auth_uid()');
      }
    });
  });

  describe('generateAddOwnerColumn', () => {
    it('should generate SQL to add owner column with default', () => {
      const sql = PublicReadPolicyGenerator.generateAddOwnerColumn('events', 'organizer_id');

      expect(sql).toContain('ALTER TABLE public."events"');
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS "organizer_id" UUID NOT NULL DEFAULT auth_uid()');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_events_organizer_id');
    });
  });

  describe('generateColumnCheckQuery', () => {
    it('should generate query to check if column exists', () => {
      const sql = PublicReadPolicyGenerator.generateColumnCheckQuery('recipes', 'chef_id');

      expect(sql).toContain('SELECT EXISTS');
      expect(sql).toContain('information_schema.columns');
      expect(sql).toContain("table_name = 'recipes'");
      expect(sql).toContain("column_name = 'chef_id'");
    });
  });

  describe('generateListPoliciesQuery', () => {
    it('should generate query to list policies on a table', () => {
      const sql = PublicReadPolicyGenerator.generateListPoliciesQuery('forums');

      expect(sql).toContain('SELECT');
      expect(sql).toContain('pg_policies');
      expect(sql).toContain("tablename = 'forums'");
      expect(sql).toContain('policyname');
      expect(sql).toContain('ORDER BY policyname');
    });
  });
});