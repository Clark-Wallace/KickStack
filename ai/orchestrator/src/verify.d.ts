import { Plan, VerifyResult } from './types';
export declare class VerifyService {
    private readonly API_BASE;
    private readonly AUTH_BASE;
    private readonly FNGW_BASE;
    private readonly JWT_SECRET;
    verify(plan: Plan): Promise<VerifyResult>;
    private verifyConnectivity;
    private verifyRLS;
    private verifyFunctions;
    private verifyCustomChecks;
    private generateTestToken;
    private generateTestRowData;
    private printResults;
}
//# sourceMappingURL=verify.d.ts.map