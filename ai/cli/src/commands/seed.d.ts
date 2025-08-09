interface SeedOptions {
    type?: string;
    clean?: boolean;
}
export declare function seedCommand(options?: SeedOptions): Promise<void>;
export declare const seedTypes: string[];
export declare function validateSeedType(type: string): boolean;
export {};
//# sourceMappingURL=seed.d.ts.map