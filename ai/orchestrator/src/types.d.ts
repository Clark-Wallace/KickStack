export interface Column {
    name: string;
    type: string;
    pk?: boolean;
    nullable?: boolean;
    default?: string;
    ref?: string;
}
export interface TableStep {
    kind: 'table';
    name: string;
    columns: Column[];
    policy?: {
        preset: 'owner' | 'public_read';
        owner_col: string;
    };
    realtime?: boolean;
}
export interface FunctionStep {
    kind: 'function';
    name: string;
    runtime: 'edge';
    path: string;
    trigger?: {
        table: string;
        when: 'after_insert' | 'after_update' | 'after_delete';
    };
    env?: string[];
}
export type Step = TableStep | FunctionStep;
export interface VerificationCheck {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    body?: any;
    expect: number;
    token?: string;
}
export interface Plan {
    version: number;
    summary: string;
    steps: Step[];
    verification?: {
        smoke?: VerificationCheck[];
    };
    notes?: string;
}
export interface SqlFile {
    name: string;
    content: string;
}
export interface CodeFile {
    path: string;
    content: string;
}
export interface RenderResult {
    migrations: SqlFile[];
    functions: CodeFile[];
}
export interface ApplyResult {
    success: boolean;
    appliedMigrations: string[];
    createdFunctions: string[];
    errors?: string[];
}
export interface VerifyResult {
    success: boolean;
    passed: string[];
    failed: string[];
    errors?: string[];
}
//# sourceMappingURL=types.d.ts.map