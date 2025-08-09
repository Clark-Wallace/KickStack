export declare class DatabaseService {
    private connectionString;
    constructor();
    tableExists(tableName: string): Promise<boolean>;
    executeMigration(sql: string): Promise<void>;
    getTableColumns(tableName: string): Promise<string[]>;
    getTriggers(tableName: string): Promise<string[]>;
    runQuery(query: string): Promise<string>;
    runQueryBoolean(query: string): Promise<boolean>;
    runQueryJson(query: string): Promise<any>;
    getConnectionString(): string;
}
//# sourceMappingURL=database.d.ts.map