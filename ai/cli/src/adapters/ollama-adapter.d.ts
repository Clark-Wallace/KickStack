import { ModelAdapter, NLTableSpec, TableSQL } from '../types';
export declare class OllamaAdapter implements ModelAdapter {
    private model;
    generateSQL(prompt: string): Promise<string>;
    isAvailable(): Promise<boolean>;
    nlToCreateTable(spec: NLTableSpec): Promise<TableSQL>;
    private extractSQL;
    private extractTableName;
}
//# sourceMappingURL=ollama-adapter.d.ts.map