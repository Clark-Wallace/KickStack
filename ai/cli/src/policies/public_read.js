"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicReadPolicyGenerator = void 0;
class PublicReadPolicyGenerator {
    static generatePolicies(options) {
        const { table, ownerCol, addOwnerCol } = options;
        let sql = '';
        // Add owner column if requested
        if (addOwnerCol) {
            sql += this.generateAddOwnerColumn(table, ownerCol);
        }
        // Enable RLS
        sql += `
-- Enable Row Level Security on ${table}
ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;

-- Policy: select_public - Anyone can read all rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'select_public'
  ) THEN
    CREATE POLICY select_public ON public."${table}"
      FOR SELECT
      USING (TRUE);
  END IF;
END $$;

COMMENT ON POLICY select_public ON public."${table}" IS 
  'Allow public read access - anyone can view all rows';

-- Policy: insert_own - Users can only insert rows they own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'insert_own'
  ) THEN
    CREATE POLICY insert_own ON public."${table}"
      FOR INSERT
      WITH CHECK ("${ownerCol}" = auth_uid());
  END IF;
END $$;

COMMENT ON POLICY insert_own ON public."${table}" IS 
  'Users can only insert rows where ${ownerCol} matches their auth_uid()';

-- Policy: update_own - Users can only update their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'update_own'
  ) THEN
    CREATE POLICY update_own ON public."${table}"
      FOR UPDATE
      USING ("${ownerCol}" = auth_uid())
      WITH CHECK ("${ownerCol}" = auth_uid());
  END IF;
END $$;

COMMENT ON POLICY update_own ON public."${table}" IS 
  'Users can only update rows where ${ownerCol} matches their auth_uid()';

-- Policy: delete_own - Users can only delete their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'delete_own'
  ) THEN
    CREATE POLICY delete_own ON public."${table}"
      FOR DELETE
      USING ("${ownerCol}" = auth_uid());
  END IF;
END $$;

COMMENT ON POLICY delete_own ON public."${table}" IS 
  'Users can only delete rows where ${ownerCol} matches their auth_uid()';

-- Grant permissions
-- Anonymous users can only SELECT (public read)
GRANT SELECT ON public."${table}" TO anon;
REVOKE INSERT, UPDATE, DELETE ON public."${table}" FROM anon;

-- Authenticated users get full CRUD (policies will filter)
GRANT SELECT, INSERT, UPDATE, DELETE ON public."${table}" TO authenticated;
`;
        return sql;
    }
    static generateAddOwnerColumn(table, ownerCol) {
        return `
-- Add owner column if it doesn't exist
ALTER TABLE public."${table}"
  ADD COLUMN IF NOT EXISTS "${ownerCol}" UUID NOT NULL DEFAULT auth_uid();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_${table}_${ownerCol} 
  ON public."${table}"("${ownerCol}");
`;
    }
    static generateColumnCheckQuery(table, ownerCol) {
        return `
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = '${table}' 
    AND column_name = '${ownerCol}'
) as column_exists;
`;
    }
    static generateListPoliciesQuery(table) {
        return `
SELECT 
  policyname,
  cmd,
  qual,
  with_check,
  roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = '${table}'
ORDER BY policyname;
`;
    }
}
exports.PublicReadPolicyGenerator = PublicReadPolicyGenerator;
//# sourceMappingURL=public_read.js.map