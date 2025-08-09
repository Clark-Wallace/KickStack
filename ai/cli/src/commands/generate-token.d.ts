interface TokenOptions {
    role?: string;
    userId?: string;
    orgId?: string;
    email?: string;
    expiresIn?: string;
    claims?: Record<string, any>;
}
export declare function generateTokenCommand(type: string, options: TokenOptions): Promise<void>;
export {};
//# sourceMappingURL=generate-token.d.ts.map