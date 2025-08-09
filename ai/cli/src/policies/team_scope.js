"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamScopePolicy = void 0;
/**
 * Team Scope Policy Generator
 *
 * Creates RLS policies that restrict access to rows within the same organization.
 * - READ: Users can see all rows in their organization
 * - WRITE: Users can only modify rows they own (unless owner-col is not specified)
 *
 * @param table - The table name to apply policies to
 * @param orgCol - The column containing the organization ID (default: 'org_id')
 * @param ownerCol - Optional column for row ownership (default: 'user_id')
 */
exports.teamScopePolicy = {
    name: 'team_scope',
    description: 'Organization/team-scoped access with optional owner restrictions',
    generate: (table, options = {}) => {
        const orgCol = options.orgCol || 'org_id';
        const ownerCol = options.ownerCol || 'user_id';
        const addOrgCol = options.addOrgCol || false;
        const addOwnerCol = options.addOwnerCol || false;
        let sql = `-- Team Scope RLS Policy for ${table}\n`;
        sql += `-- Organization-scoped access with owner write restrictions\n\n`;
        // Add columns if requested
        if (addOrgCol) {
            sql += `-- Add organization column if it doesn't exist\n`;
            sql += `DO $$\n`;
            sql += `BEGIN\n`;
            sql += `  IF NOT EXISTS (\n`;
            sql += `    SELECT 1 FROM information_schema.columns\n`;
            sql += `    WHERE table_name = '${table}'\n`;
            sql += `    AND column_name = '${orgCol}'\n`;
            sql += `  ) THEN\n`;
            sql += `    ALTER TABLE public."${table}" ADD COLUMN "${orgCol}" UUID;\n`;
            sql += `  END IF;\n`;
            sql += `END $$;\n\n`;
        }
        if (addOwnerCol && ownerCol) {
            sql += `-- Add owner column if it doesn't exist\n`;
            sql += `DO $$\n`;
            sql += `BEGIN\n`;
            sql += `  IF NOT EXISTS (\n`;
            sql += `    SELECT 1 FROM information_schema.columns\n`;
            sql += `    WHERE table_name = '${table}'\n`;
            sql += `    AND column_name = '${ownerCol}'\n`;
            sql += `  ) THEN\n`;
            sql += `    ALTER TABLE public."${table}" ADD COLUMN "${ownerCol}" UUID;\n`;
            sql += `  END IF;\n`;
            sql += `END $$;\n\n`;
        }
        // Enable RLS
        sql += `-- Enable Row Level Security\n`;
        sql += `ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;\n\n`;
        // SELECT policy - users can see all rows in their organization
        sql += `-- Policy: team_select - Users can see all rows in their organization\n`;
        sql += `DO $$\n`;
        sql += `BEGIN\n`;
        sql += `  IF NOT EXISTS (\n`;
        sql += `    SELECT 1 FROM pg_policies\n`;
        sql += `    WHERE tablename = '${table}'\n`;
        sql += `    AND policyname = 'team_select'\n`;
        sql += `  ) THEN\n`;
        sql += `    CREATE POLICY team_select ON public."${table}"\n`;
        sql += `      FOR SELECT\n`;
        sql += `      USING (\n`;
        sql += `        "${orgCol}" = auth_org()\n`;
        sql += `        OR is_admin()\n`;
        sql += `      );\n`;
        sql += `  END IF;\n`;
        sql += `END $$;\n\n`;
        // INSERT policy - users can insert rows for their organization
        if (ownerCol) {
            sql += `-- Policy: team_insert - Users can insert rows they own in their organization\n`;
            sql += `DO $$\n`;
            sql += `BEGIN\n`;
            sql += `  IF NOT EXISTS (\n`;
            sql += `    SELECT 1 FROM pg_policies\n`;
            sql += `    WHERE tablename = '${table}'\n`;
            sql += `    AND policyname = 'team_insert'\n`;
            sql += `  ) THEN\n`;
            sql += `    CREATE POLICY team_insert ON public."${table}"\n`;
            sql += `      FOR INSERT\n`;
            sql += `      WITH CHECK (\n`;
            sql += `        ("${orgCol}" = auth_org() AND "${ownerCol}" = auth_uid())\n`;
            sql += `        OR is_admin()\n`;
            sql += `      );\n`;
            sql += `  END IF;\n`;
            sql += `END $$;\n\n`;
        }
        else {
            // No owner column - any user in org can insert
            sql += `-- Policy: team_insert - Users can insert rows for their organization\n`;
            sql += `DO $$\n`;
            sql += `BEGIN\n`;
            sql += `  IF NOT EXISTS (\n`;
            sql += `    SELECT 1 FROM pg_policies\n`;
            sql += `    WHERE tablename = '${table}'\n`;
            sql += `    AND policyname = 'team_insert'\n`;
            sql += `  ) THEN\n`;
            sql += `    CREATE POLICY team_insert ON public."${table}"\n`;
            sql += `      FOR INSERT\n`;
            sql += `      WITH CHECK (\n`;
            sql += `        "${orgCol}" = auth_org()\n`;
            sql += `        OR is_admin()\n`;
            sql += `      );\n`;
            sql += `  END IF;\n`;
            sql += `END $$;\n\n`;
        }
        // UPDATE policy
        if (ownerCol) {
            sql += `-- Policy: team_update - Users can update rows they own in their organization\n`;
            sql += `DO $$\n`;
            sql += `BEGIN\n`;
            sql += `  IF NOT EXISTS (\n`;
            sql += `    SELECT 1 FROM pg_policies\n`;
            sql += `    WHERE tablename = '${table}'\n`;
            sql += `    AND policyname = 'team_update'\n`;
            sql += `  ) THEN\n`;
            sql += `    CREATE POLICY team_update ON public."${table}"\n`;
            sql += `      FOR UPDATE\n`;
            sql += `      USING (\n`;
            sql += `        ("${orgCol}" = auth_org() AND "${ownerCol}" = auth_uid())\n`;
            sql += `        OR is_admin()\n`;
            sql += `      )\n`;
            sql += `      WITH CHECK (\n`;
            sql += `        ("${orgCol}" = auth_org() AND "${ownerCol}" = auth_uid())\n`;
            sql += `        OR is_admin()\n`;
            sql += `      );\n`;
            sql += `  END IF;\n`;
            sql += `END $$;\n\n`;
        }
        else {
            // No owner column - any user in org can update
            sql += `-- Policy: team_update - Users can update rows in their organization\n`;
            sql += `DO $$\n`;
            sql += `BEGIN\n`;
            sql += `  IF NOT EXISTS (\n`;
            sql += `    SELECT 1 FROM pg_policies\n`;
            sql += `    WHERE tablename = '${table}'\n`;
            sql += `    AND policyname = 'team_update'\n`;
            sql += `  ) THEN\n`;
            sql += `    CREATE POLICY team_update ON public."${table}"\n`;
            sql += `      FOR UPDATE\n`;
            sql += `      USING (\n`;
            sql += `        "${orgCol}" = auth_org()\n`;
            sql += `        OR is_admin()\n`;
            sql += `      )\n`;
            sql += `      WITH CHECK (\n`;
            sql += `        "${orgCol}" = auth_org()\n`;
            sql += `        OR is_admin()\n`;
            sql += `      );\n`;
            sql += `  END IF;\n`;
            sql += `END $$;\n\n`;
        }
        // DELETE policy
        if (ownerCol) {
            sql += `-- Policy: team_delete - Users can delete rows they own in their organization\n`;
            sql += `DO $$\n`;
            sql += `BEGIN\n`;
            sql += `  IF NOT EXISTS (\n`;
            sql += `    SELECT 1 FROM pg_policies\n`;
            sql += `    WHERE tablename = '${table}'\n`;
            sql += `    AND policyname = 'team_delete'\n`;
            sql += `  ) THEN\n`;
            sql += `    CREATE POLICY team_delete ON public."${table}"\n`;
            sql += `      FOR DELETE\n`;
            sql += `      USING (\n`;
            sql += `        ("${orgCol}" = auth_org() AND "${ownerCol}" = auth_uid())\n`;
            sql += `        OR is_admin()\n`;
            sql += `      );\n`;
            sql += `  END IF;\n`;
            sql += `END $$;\n\n`;
        }
        else {
            // No owner column - any user in org can delete
            sql += `-- Policy: team_delete - Users can delete rows in their organization\n`;
            sql += `DO $$\n`;
            sql += `BEGIN\n`;
            sql += `  IF NOT EXISTS (\n`;
            sql += `    SELECT 1 FROM pg_policies\n`;
            sql += `    WHERE tablename = '${table}'\n`;
            sql += `    AND policyname = 'team_delete'\n`;
            sql += `  ) THEN\n`;
            sql += `    CREATE POLICY team_delete ON public."${table}"\n`;
            sql += `      FOR DELETE\n`;
            sql += `      USING (\n`;
            sql += `        "${orgCol}" = auth_org()\n`;
            sql += `        OR is_admin()\n`;
            sql += `      );\n`;
            sql += `  END IF;\n`;
            sql += `END $$;\n\n`;
        }
        // Grants
        sql += `-- Grant permissions\n`;
        sql += `GRANT SELECT, INSERT, UPDATE, DELETE ON public."${table}" TO authenticated;\n`;
        sql += `GRANT SELECT ON public."${table}" TO anon; -- Optional: remove if no anonymous access needed\n`;
        return sql;
    },
    validate: async (table, options = {}) => {
        const errors = [];
        if (!table || typeof table !== 'string') {
            errors.push('Table name is required');
        }
        const orgCol = options.orgCol || 'org_id';
        const ownerCol = options.ownerCol || 'user_id';
        if (!/^[a-z_][a-z0-9_]*$/.test(orgCol)) {
            errors.push('Invalid organization column name');
        }
        if (ownerCol && !/^[a-z_][a-z0-9_]*$/.test(ownerCol)) {
            errors.push('Invalid owner column name');
        }
        return { valid: errors.length === 0, errors };
    }
};
//# sourceMappingURL=team_scope.js.map