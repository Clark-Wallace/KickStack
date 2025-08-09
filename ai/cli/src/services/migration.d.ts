import { TableSQL } from '../types';
export declare class MigrationService {
    private migrationsDir;
    constructor();
    writeMigration(tableSQL: TableSQL): Promise<string>;
    private getTimestamp;
}
//# sourceMappingURL=migration.d.ts.map