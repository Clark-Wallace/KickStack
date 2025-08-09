export interface TemplateManifest {
    version: number;
    name: string;
    display_name: string;
    description: string;
    category: string;
    tags: string[];
    author?: string;
    license?: string;
    verified?: boolean;
    kickstack_min_version?: string;
    contents?: {
        tables?: string[];
        policies?: string[];
        functions?: string[];
        assets?: string[];
    };
    dependencies?: string[];
    env_vars?: string[];
}
export interface TemplateIndexEntry {
    name: string;
    display_name: string;
    description: string;
    category: string;
    tags: string[];
    url: string;
    verified: boolean;
    version?: string;
    size?: number;
    checksum?: string;
    signature?: string;
}
export interface InstallOptions {
    apply?: boolean;
    force?: boolean;
}
export interface InstallResult {
    migrations: string[];
    functions: string[];
    assets: string[];
}
export declare class TemplateManager {
    private cacheDir;
    private configDir;
    private defaultIndexUrl;
    constructor();
    ensureDirsExist(): Promise<void>;
    getTemplateIndex(): Promise<TemplateIndexEntry[]>;
    searchTemplates(query?: string, options?: any): Promise<TemplateIndexEntry[]>;
    getTemplateInfo(name: string): Promise<TemplateIndexEntry>;
    getTemplateReadme(name: string): Promise<string | null>;
    downloadTemplate(template: TemplateIndexEntry): Promise<string>;
    extractTemplate(archivePath: string, extractPath: string): Promise<TemplateManifest>;
    installTemplate(name: string, options?: InstallOptions): Promise<InstallResult>;
    applyTemplate(manifest: TemplateManifest, result: InstallResult): Promise<void>;
    packageTemplate(templatePath: string, outputPath?: string): Promise<{
        filename: string;
        size: number;
    }>;
    validateTemplate(templatePath: string): Promise<void>;
    loadManifest(templatePath: string): Promise<TemplateManifest>;
    validateManifest(manifest: TemplateManifest): void;
    publishTemplate(filePath: string, options?: any): Promise<{
        registry: string;
        url: string;
        verified: boolean;
    }>;
    recordInstallation(manifest: TemplateManifest): Promise<void>;
    listInstalledTemplates(): Promise<any[]>;
    updateIndex(): Promise<void>;
    addCustomIndex(url: string): Promise<void>;
    private compareVersions;
}
//# sourceMappingURL=template-manager.d.ts.map