export interface NLTableSpec {
    raw: string;
}
export interface TableSQL {
    tableName: string;
    sql: string;
}
export interface ModelAdapter {
    nlToCreateTable(spec: NLTableSpec): Promise<TableSQL>;
    isAvailable(): Promise<boolean>;
}
export interface PolicyGenerator {
    name: string;
    description?: string;
    generate: (table: string, options?: any) => string;
    validate?: (table: string, options?: any) => Promise<{
        valid: boolean;
        errors?: string[];
    }>;
}
//# sourceMappingURL=types.d.ts.map