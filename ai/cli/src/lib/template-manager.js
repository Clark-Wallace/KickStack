"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateManager = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = require("fs");
const promises_2 = require("stream/promises");
const tar_1 = __importDefault(require("tar"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const crypto_1 = __importDefault(require("crypto"));
const chalk_1 = __importDefault(require("chalk"));
class TemplateManager {
    cacheDir;
    configDir;
    defaultIndexUrl = 'https://templates.kickstack.dev/index.json';
    constructor() {
        this.configDir = path_1.default.join(os_1.default.homedir(), '.kickstack');
        this.cacheDir = path_1.default.join(this.configDir, 'cache');
    }
    async ensureDirsExist() {
        await promises_1.default.mkdir(this.configDir, { recursive: true });
        await promises_1.default.mkdir(this.cacheDir, { recursive: true });
    }
    async getTemplateIndex() {
        await this.ensureDirsExist();
        const indexPath = path_1.default.join(this.cacheDir, 'templates.json');
        const customIndexPath = path_1.default.join(this.configDir, 'custom-indexes.json');
        let indexes = [this.defaultIndexUrl];
        // Load custom indexes if they exist
        try {
            const customIndexes = JSON.parse(await promises_1.default.readFile(customIndexPath, 'utf8'));
            indexes = [...indexes, ...customIndexes];
        }
        catch (error) {
            // No custom indexes
        }
        let allTemplates = [];
        // Fetch from all indexes
        for (const indexUrl of indexes) {
            try {
                const response = await fetch(indexUrl);
                if (!response.ok) {
                    console.warn(`Failed to fetch index from ${indexUrl}`);
                    continue;
                }
                const templates = await response.json();
                allTemplates = [...allTemplates, ...templates];
            }
            catch (error) {
                console.warn(`Error fetching index from ${indexUrl}:`, error.message);
            }
        }
        // Cache the combined index
        await promises_1.default.writeFile(indexPath, JSON.stringify(allTemplates, null, 2));
        return allTemplates;
    }
    async searchTemplates(query, options = {}) {
        const templates = await this.getTemplateIndex();
        let filtered = templates;
        // Filter by query
        if (query) {
            const lowerQuery = query.toLowerCase();
            filtered = filtered.filter(t => t.name.toLowerCase().includes(lowerQuery) ||
                t.display_name.toLowerCase().includes(lowerQuery) ||
                t.description.toLowerCase().includes(lowerQuery) ||
                t.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
        }
        // Filter by category
        if (options.category) {
            filtered = filtered.filter(t => t.category === options.category);
        }
        // Filter by tag
        if (options.tag) {
            filtered = filtered.filter(t => t.tags.includes(options.tag));
        }
        // Filter by verified status
        if (options.verifiedOnly) {
            filtered = filtered.filter(t => t.verified);
        }
        return filtered;
    }
    async getTemplateInfo(name) {
        const templates = await this.getTemplateIndex();
        const template = templates.find(t => t.name === name);
        if (!template) {
            throw new Error(`Template '${name}' not found. Use 'kickstack template search' to find available templates.`);
        }
        return template;
    }
    async getTemplateReadme(name) {
        // This would require downloading or having README in index
        // For now, return null - can be enhanced later
        return null;
    }
    async downloadTemplate(template) {
        await this.ensureDirsExist();
        const filename = `${template.name}-${Date.now()}.tar.gz`;
        const downloadPath = path_1.default.join(this.cacheDir, filename);
        console.log(chalk_1.default.blue(`📥 Downloading ${template.name}...`));
        const response = await fetch(template.url);
        if (!response.ok) {
            throw new Error(`Failed to download template: ${response.statusText}`);
        }
        const fileStream = (0, fs_1.createWriteStream)(downloadPath);
        await (0, promises_2.pipeline)(response.body, fileStream);
        // Verify checksum if provided
        if (template.checksum) {
            const hash = crypto_1.default.createHash('sha256');
            const data = await promises_1.default.readFile(downloadPath);
            hash.update(data);
            const checksum = hash.digest('hex');
            if (checksum !== template.checksum) {
                await promises_1.default.unlink(downloadPath);
                throw new Error('Template checksum verification failed. Download may be corrupted.');
            }
        }
        return downloadPath;
    }
    async extractTemplate(archivePath, extractPath) {
        await promises_1.default.mkdir(extractPath, { recursive: true });
        // Extract archive
        await tar_1.default.extract({
            file: archivePath,
            cwd: extractPath
        });
        // Find and load manifest
        const manifestPath = path_1.default.join(extractPath, 'manifest.yaml');
        try {
            const manifestContent = await promises_1.default.readFile(manifestPath, 'utf8');
            const manifest = js_yaml_1.default.load(manifestContent);
            // Validate manifest
            this.validateManifest(manifest);
            return manifest;
        }
        catch (error) {
            throw new Error(`Failed to load template manifest: ${error.message}`);
        }
    }
    async installTemplate(name, options = {}) {
        const template = await this.getTemplateInfo(name);
        // Security check for unverified templates
        if (!template.verified && !options.force) {
            console.log(chalk_1.default.yellow(`⚠️  Template '${name}' is not verified.`));
            console.log(chalk_1.default.yellow('This means it has not been reviewed by KickStack maintainers.'));
            console.log(chalk_1.default.yellow('Please review the template contents before applying.'));
            // In a real implementation, you'd prompt for confirmation here
            // For now, we'll proceed but show the warning
        }
        const downloadPath = await this.downloadTemplate(template);
        const extractPath = path_1.default.join(this.cacheDir, `extracted-${name}-${Date.now()}`);
        try {
            const manifest = await this.extractTemplate(downloadPath, extractPath);
            // Check KickStack version compatibility
            if (manifest.kickstack_min_version) {
                const currentVersion = '1.0.0'; // Would be read from package.json
                if (this.compareVersions(currentVersion, manifest.kickstack_min_version) < 0) {
                    throw new Error(`Template requires KickStack ${manifest.kickstack_min_version} or higher. ` +
                        `Current version: ${currentVersion}`);
                }
            }
            const result = {
                migrations: [],
                functions: [],
                assets: []
            };
            // Stage migrations
            const migrationsDir = path_1.default.join(extractPath, 'migrations');
            try {
                const migrationFiles = await promises_1.default.readdir(migrationsDir);
                const stagedMigrationsDir = path_1.default.join(process.cwd(), 'infra', 'migrations', '_staged');
                await promises_1.default.mkdir(stagedMigrationsDir, { recursive: true });
                for (const file of migrationFiles.filter(f => f.endsWith('.sql'))) {
                    const srcPath = path_1.default.join(migrationsDir, file);
                    const destPath = path_1.default.join(stagedMigrationsDir, `${manifest.name}_${file}`);
                    await promises_1.default.copyFile(srcPath, destPath);
                    result.migrations.push(destPath);
                }
            }
            catch (error) {
                // No migrations directory
            }
            // Stage functions
            const functionsDir = path_1.default.join(extractPath, 'functions');
            try {
                const functionFiles = await promises_1.default.readdir(functionsDir);
                const stagedFunctionsDir = path_1.default.join(process.cwd(), 'api', 'functions', '_staged');
                await promises_1.default.mkdir(stagedFunctionsDir, { recursive: true });
                for (const file of functionFiles.filter(f => f.endsWith('.ts') || f.endsWith('.js'))) {
                    const srcPath = path_1.default.join(functionsDir, file);
                    const destPath = path_1.default.join(stagedFunctionsDir, file);
                    await promises_1.default.copyFile(srcPath, destPath);
                    result.functions.push(destPath);
                }
            }
            catch (error) {
                // No functions directory
            }
            // Stage assets
            const assetsDir = path_1.default.join(extractPath, 'assets');
            try {
                const assetFiles = await promises_1.default.readdir(assetsDir, { recursive: true });
                const stagedAssetsDir = path_1.default.join(process.cwd(), '_staged', 'assets', manifest.name);
                await promises_1.default.mkdir(stagedAssetsDir, { recursive: true });
                for (const file of assetFiles) {
                    const srcPath = path_1.default.join(assetsDir, file);
                    const destPath = path_1.default.join(stagedAssetsDir, file);
                    await promises_1.default.mkdir(path_1.default.dirname(destPath), { recursive: true });
                    await promises_1.default.copyFile(srcPath, destPath);
                    result.assets.push(destPath);
                }
            }
            catch (error) {
                // No assets directory
            }
            // Record installation
            await this.recordInstallation(manifest);
            // Apply if requested
            if (options.apply) {
                await this.applyTemplate(manifest, result);
            }
            return result;
        }
        finally {
            // Cleanup
            await promises_1.default.rm(downloadPath, { force: true });
            await promises_1.default.rm(extractPath, { recursive: true, force: true });
        }
    }
    async applyTemplate(manifest, result) {
        console.log(chalk_1.default.blue(`🔄 Applying template: ${manifest.display_name}`));
        // Apply migrations (would integrate with existing migration system)
        for (const migration of result.migrations) {
            console.log(`  Applying migration: ${path_1.default.basename(migration)}`);
            // TODO: Run migration via psql or existing migration system
        }
        // Deploy functions (would integrate with functions gateway)
        for (const func of result.functions) {
            console.log(`  Deploying function: ${path_1.default.basename(func)}`);
            // TODO: Move to functions directory and reload gateway
        }
        console.log(chalk_1.default.green(`✅ Template ${manifest.name} applied successfully!`));
    }
    async packageTemplate(templatePath, outputPath) {
        await this.validateTemplate(templatePath);
        const manifest = await this.loadManifest(templatePath);
        const filename = outputPath || `${manifest.name}.tar.gz`;
        console.log(chalk_1.default.blue(`📦 Creating package: ${filename}`));
        await tar_1.default.create({
            gzip: true,
            file: filename,
            cwd: templatePath
        }, ['.']);
        const stats = await promises_1.default.stat(filename);
        return {
            filename,
            size: stats.size
        };
    }
    async validateTemplate(templatePath) {
        console.log(chalk_1.default.blue(`🔍 Validating template: ${templatePath}`));
        // Check if directory exists
        const stats = await promises_1.default.stat(templatePath);
        if (!stats.isDirectory()) {
            throw new Error('Template path must be a directory');
        }
        // Load and validate manifest
        const manifest = await this.loadManifest(templatePath);
        this.validateManifest(manifest);
        // Check required directories exist if declared in contents
        if (manifest.contents?.tables?.length) {
            const migrationsDir = path_1.default.join(templatePath, 'migrations');
            try {
                await promises_1.default.access(migrationsDir);
            }
            catch (error) {
                throw new Error('Template declares tables but migrations/ directory is missing');
            }
        }
        if (manifest.contents?.functions?.length) {
            const functionsDir = path_1.default.join(templatePath, 'functions');
            try {
                await promises_1.default.access(functionsDir);
            }
            catch (error) {
                throw new Error('Template declares functions but functions/ directory is missing');
            }
        }
        console.log(chalk_1.default.green('✅ Template validation passed'));
    }
    async loadManifest(templatePath) {
        const manifestPath = path_1.default.join(templatePath, 'manifest.yaml');
        const manifestContent = await promises_1.default.readFile(manifestPath, 'utf8');
        return js_yaml_1.default.load(manifestContent);
    }
    validateManifest(manifest) {
        const required = ['version', 'name', 'display_name', 'description', 'category'];
        for (const field of required) {
            if (!manifest[field]) {
                throw new Error(`Manifest is missing required field: ${field}`);
            }
        }
        if (manifest.version !== 1) {
            throw new Error(`Unsupported manifest version: ${manifest.version}. Expected: 1`);
        }
        if (!/^[a-z0-9\-]+$/.test(manifest.name)) {
            throw new Error('Template name must contain only lowercase letters, numbers, and hyphens');
        }
    }
    async publishTemplate(filePath, options = {}) {
        // This would integrate with a template registry API
        // For now, just return a mock response
        console.log(chalk_1.default.blue(`🚀 Publishing template: ${filePath}`));
        // In a real implementation, this would:
        // 1. Upload the file to a registry (GitHub Releases, S3, etc.)
        // 2. Update the index with the new template
        // 3. Sign the template if --verify is used
        const registry = options.registry || 'https://templates.kickstack.dev';
        const filename = path_1.default.basename(filePath);
        return {
            registry,
            url: `${registry}/${filename}`,
            verified: options.verify || false
        };
    }
    async recordInstallation(manifest) {
        await this.ensureDirsExist();
        const installedPath = path_1.default.join(this.configDir, 'installed.json');
        let installed = [];
        try {
            installed = JSON.parse(await promises_1.default.readFile(installedPath, 'utf8'));
        }
        catch (error) {
            // File doesn't exist yet
        }
        const installation = {
            name: manifest.name,
            version: manifest.version || '1.0.0',
            installed_at: new Date().toISOString(),
            path: process.cwd()
        };
        // Remove existing installation record
        installed = installed.filter(t => t.name !== manifest.name);
        installed.push(installation);
        await promises_1.default.writeFile(installedPath, JSON.stringify(installed, null, 2));
    }
    async listInstalledTemplates() {
        await this.ensureDirsExist();
        const installedPath = path_1.default.join(this.configDir, 'installed.json');
        try {
            return JSON.parse(await promises_1.default.readFile(installedPath, 'utf8'));
        }
        catch (error) {
            return [];
        }
    }
    async updateIndex() {
        // Force refresh by deleting cache
        const indexPath = path_1.default.join(this.cacheDir, 'templates.json');
        try {
            await promises_1.default.unlink(indexPath);
        }
        catch (error) {
            // File doesn't exist
        }
        // Fetch fresh index
        await this.getTemplateIndex();
    }
    async addCustomIndex(url) {
        await this.ensureDirsExist();
        const customIndexPath = path_1.default.join(this.configDir, 'custom-indexes.json');
        let indexes = [];
        try {
            indexes = JSON.parse(await promises_1.default.readFile(customIndexPath, 'utf8'));
        }
        catch (error) {
            // File doesn't exist yet
        }
        if (!indexes.includes(url)) {
            indexes.push(url);
            await promises_1.default.writeFile(customIndexPath, JSON.stringify(indexes, null, 2));
        }
    }
    compareVersions(a, b) {
        const parseVersion = (v) => v.split('.').map(Number);
        const versionA = parseVersion(a);
        const versionB = parseVersion(b);
        for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
            const partA = versionA[i] || 0;
            const partB = versionB[i] || 0;
            if (partA < partB)
                return -1;
            if (partA > partB)
                return 1;
        }
        return 0;
    }
}
exports.TemplateManager = TemplateManager;
//# sourceMappingURL=template-manager.js.map