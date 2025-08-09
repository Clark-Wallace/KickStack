import { PolicyGenerator } from '../types';
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
export declare const teamScopePolicy: PolicyGenerator;
//# sourceMappingURL=team_scope.d.ts.map