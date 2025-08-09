export interface OwnerPolicyOptions {
  table: string;
  ownerCol: string;
  addOwnerCol?: boolean;
}

export class OwnerPolicyGenerator {
  /**
   * Generates SQL to add an owner column if it doesn't exist
   */
  static generateAddOwnerColumn(table: string, ownerCol: string): string {
    return `
-- Add owner column if requested
ALTER TABLE public."${table}" 
ADD COLUMN IF NOT EXISTS "${ownerCol}" UUID NOT NULL DEFAULT auth_uid();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_${table}_${ownerCol} ON public."${table}"("${ownerCol}");
`;
  }

  /**
   * Generates complete RLS owner policy SQL for a table
   */
  static generatePolicies(options: OwnerPolicyOptions): string {
    const { table, ownerCol, addOwnerCol } = options;
    
    let sql = `-- Row-Level Security: Owner Policy for ${table}
-- Generated: ${new Date().toISOString()}
-- Owner column: ${ownerCol}

`;

    // Add owner column if requested
    if (addOwnerCol) {
      sql += this.generateAddOwnerColumn(table, ownerCol);
    }

    sql += `
-- Enable Row-Level Security on the table
ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (idempotent using DO block)
DO $$
BEGIN
  -- Policy: SELECT - Users can only see their own rows
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = '${table}' 
    AND policyname = 'select_own'
  ) THEN
    CREATE POLICY select_own ON public."${table}"
      FOR SELECT 
      USING ("${ownerCol}" = auth_uid());
  END IF;

  -- Policy: INSERT - Users can only insert rows they own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = '${table}' 
    AND policyname = 'insert_own'
  ) THEN
    CREATE POLICY insert_own ON public."${table}"
      FOR INSERT 
      WITH CHECK ("${ownerCol}" = auth_uid());
  END IF;

  -- Policy: UPDATE - Users can only update their own rows
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = '${table}' 
    AND policyname = 'update_own'
  ) THEN
    CREATE POLICY update_own ON public."${table}"
      FOR UPDATE 
      USING ("${ownerCol}" = auth_uid())
      WITH CHECK ("${ownerCol}" = auth_uid());
  END IF;

  -- Policy: DELETE - Users can only delete their own rows
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = '${table}' 
    AND policyname = 'delete_own'
  ) THEN
    CREATE POLICY delete_own ON public."${table}"
      FOR DELETE 
      USING ("${ownerCol}" = auth_uid());
  END IF;
END$$;

-- Grant appropriate permissions
-- Authenticated users can perform all operations (subject to RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public."${table}" TO authenticated;

-- Revoke all permissions from anonymous users
REVOKE ALL ON public."${table}" FROM anon;

-- Add comments for documentation
COMMENT ON POLICY select_own ON public."${table}" IS 'Users can only see rows where ${ownerCol} matches their auth_uid()';
COMMENT ON POLICY insert_own ON public."${table}" IS 'Users can only insert rows where ${ownerCol} matches their auth_uid()';
COMMENT ON POLICY update_own ON public."${table}" IS 'Users can only update rows where ${ownerCol} matches their auth_uid()';
COMMENT ON POLICY delete_own ON public."${table}" IS 'Users can only delete rows where ${ownerCol} matches their auth_uid()';
`;

    return sql;
  }

  /**
   * Generates SQL to check if a column exists
   */
  static generateColumnCheckQuery(table: string, column: string): string {
    return `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${table}' 
        AND column_name = '${column}'
      );
    `;
  }

  /**
   * Generates SQL to list current policies on a table
   */
  static generateListPoliciesQuery(table: string): string {
    return `
      SELECT 
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = '${table}'
      ORDER BY policyname;
    `;
  }
}