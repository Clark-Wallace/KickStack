import { Plan, ApplyResult } from './types';
export declare class ApplyService {
    private db;
    constructor();
    apply(plan: Plan, options?: {
        force?: boolean;
        noVerify?: boolean;
    }): Promise<ApplyResult>;
    private applyMigrations;
    private applyFunctions;
    private saveSchemaSnapshot;
    rollback(): Promise<void>;
}
//# sourceMappingURL=apply.d.ts.map