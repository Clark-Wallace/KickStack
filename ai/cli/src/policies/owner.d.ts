export interface OwnerPolicyOptions {
    table: string;
    ownerCol: string;
    addOwnerCol?: boolean;
}
export declare class OwnerPolicyGenerator {
    /**
     * Generates SQL to add an owner column if it doesn't exist
     */
    static generateAddOwnerColumn(table: string, ownerCol: string): string;
    /**
     * Generates complete RLS owner policy SQL for a table
     */
    static generatePolicies(options: OwnerPolicyOptions): string;
    /**
     * Generates SQL to check if a column exists
     */
    static generateColumnCheckQuery(table: string, column: string): string;
    /**
     * Generates SQL to list current policies on a table
     */
    static generateListPoliciesQuery(table: string): string;
}
//# sourceMappingURL=owner.d.ts.map