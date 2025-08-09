import { ModelAdapter, NLTableSpec, TableSQL } from '../types';
export declare class OpenAIAdapter implements ModelAdapter {
    private openai;
    constructor();
    isAvailable(): Promise<boolean>;
    generateSQL(prompt: string): Promise<string>;
    nlToCreateTable(spec: NLTableSpec): Promise<TableSQL>;
    private extractSQL;
    private extractTableName;
}
//# sourceMappingURL=openai-adapter.d.ts.map