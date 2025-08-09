export interface PublicReadPolicyOptions {
    table: string;
    ownerCol: string;
    addOwnerCol?: boolean;
}
export declare class PublicReadPolicyGenerator {
    static generatePolicies(options: PublicReadPolicyOptions): string;
    static generateAddOwnerColumn(table: string, ownerCol: string): string;
    static generateColumnCheckQuery(table: string, ownerCol: string): string;
    static generateListPoliciesQuery(table: string): string;
}
//# sourceMappingURL=public_read.d.ts.map