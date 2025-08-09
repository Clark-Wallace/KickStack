import { Plan, RenderResult } from './types';
export declare class Orchestrator {
    private adapter;
    private promptTemplate;
    private templateManager;
    constructor();
    parseIntent(naturalLanguage: string): Promise<Plan>;
    renderPlan(plan: Plan): RenderResult;
    private generateCreateTableSQL;
    private generatePolicySQL;
    private generateOwnerPolicySQL;
    private generatePublicReadPolicySQL;
    private generateRealtimeSQL;
    private generateFunctionCode;
    private generateTriggerSQL;
    stageArtifacts(rendered: RenderResult): Promise<void>;
    printSummary(plan: Plan, rendered: RenderResult): void;
    savePlan(plan: Plan, name?: string): Promise<string>;
    loadPlan(filePath: string): Promise<Plan>;
    private findMatchingTemplates;
    private getTemplateContents;
}
//# sourceMappingURL=orchestrate.d.ts.map