export declare function demoListCommand(): Promise<void>;
export declare function demoUpCommand(name: string, options: any): Promise<void>;
export declare function demoDeployCommand(name: string, options: any): Promise<void>;
export declare const demoCommand: {
    list: typeof demoListCommand;
    up: typeof demoUpCommand;
    deploy: typeof demoDeployCommand;
};
//# sourceMappingURL=demo.d.ts.map