import { PolicyGenerator } from '../types';
/**
 * Admin Override Policy Generator
 *
 * Adds admin bypass policies to existing RLS rules.
 * Admins (role='admin' or 'service_role') get full read/write access.
 * This should be applied AFTER other policies (owner, public_read, team_scope).
 *
 * @param table - The table name to add admin override to
 */
export declare const adminOverridePolicy: PolicyGenerator;
//# sourceMappingURL=admin_override.d.ts.map