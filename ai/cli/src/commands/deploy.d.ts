interface DeployOptions {
    profile: 'cloud';
    force?: boolean;
    skipBuild?: boolean;
}
export declare function deployFlyCommand(options: DeployOptions): Promise<void>;
export declare function openCommand(): Promise<void>;
export {};
//# sourceMappingURL=deploy.d.ts.map