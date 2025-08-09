"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOverridePolicy = void 0;
/**
 * Admin Override Policy Generator
 *
 * Adds admin bypass policies to existing RLS rules.
 * Admins (role='admin' or 'service_role') get full read/write access.
 * This should be applied AFTER other policies (owner, public_read, team_scope).
 *
 * @param table - The table name to add admin override to
 */
exports.adminOverridePolicy = {
    name: 'admin_override',
    description: 'Grant full access to admin and service_role tokens',
    generate: (table, options = {}) => {
        let sql = `-- Admin Override RLS Policy for ${table}\n`;
        sql += `-- Grants full access to admin and service_role tokens\n\n`;
        // Ensure RLS is enabled
        sql += `-- Ensure Row Level Security is enabled\n`;
        sql += `ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;\n\n`;
        // Admin SELECT policy
        sql += `-- Policy: admin_select - Admins can see all rows\n`;
        sql += `DO $$\n`;
        sql += `BEGIN\n`;
        sql += `  -- Drop existing admin_select policy if it exists\n`;
        sql += `  DROP POLICY IF EXISTS admin_select ON public."${table}";\n`;
        sql += `  \n`;
        sql += `  CREATE POLICY admin_select ON public."${table}"\n`;
        sql += `    FOR SELECT\n`;
        sql += `    USING (is_admin());\n`;
        sql += `END $$;\n\n`;
        // Admin INSERT policy
        sql += `-- Policy: admin_insert - Admins can insert any rows\n`;
        sql += `DO $$\n`;
        sql += `BEGIN\n`;
        sql += `  -- Drop existing admin_insert policy if it exists\n`;
        sql += `  DROP POLICY IF EXISTS admin_insert ON public."${table}";\n`;
        sql += `  \n`;
        sql += `  CREATE POLICY admin_insert ON public."${table}"\n`;
        sql += `    FOR INSERT\n`;
        sql += `    WITH CHECK (is_admin());\n`;
        sql += `END $$;\n\n`;
        // Admin UPDATE policy
        sql += `-- Policy: admin_update - Admins can update any rows\n`;
        sql += `DO $$\n`;
        sql += `BEGIN\n`;
        sql += `  -- Drop existing admin_update policy if it exists\n`;
        sql += `  DROP POLICY IF EXISTS admin_update ON public."${table}";\n`;
        sql += `  \n`;
        sql += `  CREATE POLICY admin_update ON public."${table}"\n`;
        sql += `    FOR UPDATE\n`;
        sql += `    USING (is_admin())\n`;
        sql += `    WITH CHECK (is_admin());\n`;
        sql += `END $$;\n\n`;
        // Admin DELETE policy
        sql += `-- Policy: admin_delete - Admins can delete any rows\n`;
        sql += `DO $$\n`;
        sql += `BEGIN\n`;
        sql += `  -- Drop existing admin_delete policy if it exists\n`;
        sql += `  DROP POLICY IF EXISTS admin_delete ON public."${table}";\n`;
        sql += `  \n`;
        sql += `  CREATE POLICY admin_delete ON public."${table}"\n`;
        sql += `    FOR DELETE\n`;
        sql += `    USING (is_admin());\n`;
        sql += `END $$;\n\n`;
        // Note about policy combination
        sql += `-- Note: PostgreSQL RLS policies are combined with OR logic for the same operation.\n`;
        sql += `-- This means admins will have access even if other policies would deny it.\n`;
        sql += `-- Ensure other policies are properly configured to work alongside admin override.\n\n`;
        // Grants for admin role (if it exists)
        sql += `-- Grant permissions to authenticated users (includes admins)\n`;
        sql += `GRANT SELECT, INSERT, UPDATE, DELETE ON public."${table}" TO authenticated;\n`;
        return sql;
    },
    validate: async (table, options = {}) => {
        const errors = [];
        if (!table || typeof table !== 'string') {
            errors.push('Table name is required');
        }
        if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
            errors.push('Invalid table name');
        }
        return { valid: errors.length === 0, errors };
    }
};
//# sourceMappingURL=admin_override.js.map