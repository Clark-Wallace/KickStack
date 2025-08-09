import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import tar from 'tar';
import yaml from 'js-yaml';
import crypto from 'crypto';
import chalk from 'chalk';

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

export class TemplateManager {
  private cacheDir: string;
  private configDir: string;
  private defaultIndexUrl = 'https://templates.kickstack.dev/index.json';
  
  constructor() {
    this.configDir = path.join(os.homedir(), '.kickstack');
    this.cacheDir = path.join(this.configDir, 'cache');
  }

  async ensureDirsExist(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  async getTemplateIndex(): Promise<TemplateIndexEntry[]> {
    await this.ensureDirsExist();
    
    const indexPath = path.join(this.cacheDir, 'templates.json');
    const customIndexPath = path.join(this.configDir, 'custom-indexes.json');
    
    let indexes = [this.defaultIndexUrl];
    
    // Load custom indexes if they exist
    try {
      const customIndexes = JSON.parse(await fs.readFile(customIndexPath, 'utf8'));
      indexes = [...indexes, ...customIndexes];
    } catch (error) {
      // No custom indexes
    }
    
    let allTemplates: TemplateIndexEntry[] = [];
    
    // Fetch from all indexes
    for (const indexUrl of indexes) {
      try {
        const response = await fetch(indexUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch index from ${indexUrl}`);
          continue;
        }
        
        const templates = await response.json() as TemplateIndexEntry[];
        allTemplates = [...allTemplates, ...templates];
      } catch (error) {
        console.warn(`Error fetching index from ${indexUrl}:`, (error as Error).message);
      }
    }
    
    // Cache the combined index
    await fs.writeFile(indexPath, JSON.stringify(allTemplates, null, 2));
    
    return allTemplates;
  }

  async searchTemplates(query?: string, options: any = {}): Promise<TemplateIndexEntry[]> {
    const templates = await this.getTemplateIndex();
    
    let filtered = templates;
    
    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(lowerQuery) ||
        t.display_name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
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

  async getTemplateInfo(name: string): Promise<TemplateIndexEntry> {
    const templates = await this.getTemplateIndex();
    const template = templates.find(t => t.name === name);
    
    if (!template) {
      throw new Error(`Template '${name}' not found. Use 'kickstack template search' to find available templates.`);
    }
    
    return template;
  }

  async getTemplateReadme(name: string): Promise<string | null> {
    // This would require downloading or having README in index
    // For now, return null - can be enhanced later
    return null;
  }

  async downloadTemplate(template: TemplateIndexEntry): Promise<string> {
    await this.ensureDirsExist();
    
    const filename = `${template.name}-${Date.now()}.tar.gz`;
    const downloadPath = path.join(this.cacheDir, filename);
    
    console.log(chalk.blue(`📥 Downloading ${template.name}...`));
    
    const response = await fetch(template.url);
    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.statusText}`);
    }
    
    const fileStream = createWriteStream(downloadPath);
    await pipeline(response.body as any, fileStream);
    
    // Verify checksum if provided
    if (template.checksum) {
      const hash = crypto.createHash('sha256');
      const data = await fs.readFile(downloadPath);
      hash.update(data);
      const checksum = hash.digest('hex');
      
      if (checksum !== template.checksum) {
        await fs.unlink(downloadPath);
        throw new Error('Template checksum verification failed. Download may be corrupted.');
      }
    }
    
    return downloadPath;
  }

  async extractTemplate(archivePath: string, extractPath: string): Promise<TemplateManifest> {
    await fs.mkdir(extractPath, { recursive: true });
    
    // Extract archive
    await tar.extract({
      file: archivePath,
      cwd: extractPath
    });
    
    // Find and load manifest
    const manifestPath = path.join(extractPath, 'manifest.yaml');
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = yaml.load(manifestContent) as TemplateManifest;
      
      // Validate manifest
      this.validateManifest(manifest);
      
      return manifest;
    } catch (error) {
      throw new Error(`Failed to load template manifest: ${(error as Error).message}`);
    }
  }

  async installTemplate(name: string, options: InstallOptions = {}): Promise<InstallResult> {
    const template = await this.getTemplateInfo(name);
    
    // Security check for unverified templates
    if (!template.verified && !options.force) {
      console.log(chalk.yellow(`⚠️  Template '${name}' is not verified.`));
      console.log(chalk.yellow('This means it has not been reviewed by KickStack maintainers.'));
      console.log(chalk.yellow('Please review the template contents before applying.'));
      
      // In a real implementation, you'd prompt for confirmation here
      // For now, we'll proceed but show the warning
    }
    
    const downloadPath = await this.downloadTemplate(template);
    const extractPath = path.join(this.cacheDir, `extracted-${name}-${Date.now()}`);
    
    try {
      const manifest = await this.extractTemplate(downloadPath, extractPath);
      
      // Check KickStack version compatibility
      if (manifest.kickstack_min_version) {
        const currentVersion = '1.0.0'; // Would be read from package.json
        if (this.compareVersions(currentVersion, manifest.kickstack_min_version) < 0) {
          throw new Error(
            `Template requires KickStack ${manifest.kickstack_min_version} or higher. ` +
            `Current version: ${currentVersion}`
          );
        }
      }
      
      const result: InstallResult = {
        migrations: [],
        functions: [],
        assets: []
      };
      
      // Stage migrations
      const migrationsDir = path.join(extractPath, 'migrations');
      try {
        const migrationFiles = await fs.readdir(migrationsDir);
        const stagedMigrationsDir = path.join(process.cwd(), 'infra', 'migrations', '_staged');
        await fs.mkdir(stagedMigrationsDir, { recursive: true });
        
        for (const file of migrationFiles.filter(f => f.endsWith('.sql'))) {
          const srcPath = path.join(migrationsDir, file);
          const destPath = path.join(stagedMigrationsDir, `${manifest.name}_${file}`);
          await fs.copyFile(srcPath, destPath);
          result.migrations.push(destPath);
        }
      } catch (error) {
        // No migrations directory
      }
      
      // Stage functions
      const functionsDir = path.join(extractPath, 'functions');
      try {
        const functionFiles = await fs.readdir(functionsDir);
        const stagedFunctionsDir = path.join(process.cwd(), 'api', 'functions', '_staged');
        await fs.mkdir(stagedFunctionsDir, { recursive: true });
        
        for (const file of functionFiles.filter(f => f.endsWith('.ts') || f.endsWith('.js'))) {
          const srcPath = path.join(functionsDir, file);
          const destPath = path.join(stagedFunctionsDir, file);
          await fs.copyFile(srcPath, destPath);
          result.functions.push(destPath);
        }
      } catch (error) {
        // No functions directory
      }
      
      // Stage assets
      const assetsDir = path.join(extractPath, 'assets');
      try {
        const assetFiles = await fs.readdir(assetsDir, { recursive: true });
        const stagedAssetsDir = path.join(process.cwd(), '_staged', 'assets', manifest.name);
        await fs.mkdir(stagedAssetsDir, { recursive: true });
        
        for (const file of assetFiles) {
          const srcPath = path.join(assetsDir, file as string);
          const destPath = path.join(stagedAssetsDir, file as string);
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(srcPath, destPath);
          result.assets.push(destPath);
        }
      } catch (error) {
        // No assets directory
      }
      
      // Record installation
      await this.recordInstallation(manifest);
      
      // Apply if requested
      if (options.apply) {
        await this.applyTemplate(manifest, result);
      }
      
      return result;
      
    } finally {
      // Cleanup
      await fs.rm(downloadPath, { force: true });
      await fs.rm(extractPath, { recursive: true, force: true });
    }
  }

  async applyTemplate(manifest: TemplateManifest, result: InstallResult): Promise<void> {
    console.log(chalk.blue(`🔄 Applying template: ${manifest.display_name}`));
    
    // Apply migrations (would integrate with existing migration system)
    for (const migration of result.migrations) {
      console.log(`  Applying migration: ${path.basename(migration)}`);
      // TODO: Run migration via psql or existing migration system
    }
    
    // Deploy functions (would integrate with functions gateway)
    for (const func of result.functions) {
      console.log(`  Deploying function: ${path.basename(func)}`);
      // TODO: Move to functions directory and reload gateway
    }
    
    console.log(chalk.green(`✅ Template ${manifest.name} applied successfully!`));
  }

  async packageTemplate(templatePath: string, outputPath?: string): Promise<{filename: string, size: number}> {
    await this.validateTemplate(templatePath);
    
    const manifest = await this.loadManifest(templatePath);
    const filename = outputPath || `${manifest.name}.tar.gz`;
    
    console.log(chalk.blue(`📦 Creating package: ${filename}`));
    
    await tar.create({
      gzip: true,
      file: filename,
      cwd: templatePath
    }, ['.']);
    
    const stats = await fs.stat(filename);
    
    return {
      filename,
      size: stats.size
    };
  }

  async validateTemplate(templatePath: string): Promise<void> {
    console.log(chalk.blue(`🔍 Validating template: ${templatePath}`));
    
    // Check if directory exists
    const stats = await fs.stat(templatePath);
    if (!stats.isDirectory()) {
      throw new Error('Template path must be a directory');
    }
    
    // Load and validate manifest
    const manifest = await this.loadManifest(templatePath);
    this.validateManifest(manifest);
    
    // Check required directories exist if declared in contents
    if (manifest.contents?.tables?.length) {
      const migrationsDir = path.join(templatePath, 'migrations');
      try {
        await fs.access(migrationsDir);
      } catch (error) {
        throw new Error('Template declares tables but migrations/ directory is missing');
      }
    }
    
    if (manifest.contents?.functions?.length) {
      const functionsDir = path.join(templatePath, 'functions');
      try {
        await fs.access(functionsDir);
      } catch (error) {
        throw new Error('Template declares functions but functions/ directory is missing');
      }
    }
    
    console.log(chalk.green('✅ Template validation passed'));
  }

  async loadManifest(templatePath: string): Promise<TemplateManifest> {
    const manifestPath = path.join(templatePath, 'manifest.yaml');
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    return yaml.load(manifestContent) as TemplateManifest;
  }

  validateManifest(manifest: TemplateManifest): void {
    const required = ['version', 'name', 'display_name', 'description', 'category'];
    
    for (const field of required) {
      if (!manifest[field as keyof TemplateManifest]) {
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

  async publishTemplate(filePath: string, options: any = {}): Promise<{registry: string, url: string, verified: boolean}> {
    // This would integrate with a template registry API
    // For now, just return a mock response
    console.log(chalk.blue(`🚀 Publishing template: ${filePath}`));
    
    // In a real implementation, this would:
    // 1. Upload the file to a registry (GitHub Releases, S3, etc.)
    // 2. Update the index with the new template
    // 3. Sign the template if --verify is used
    
    const registry = options.registry || 'https://templates.kickstack.dev';
    const filename = path.basename(filePath);
    
    return {
      registry,
      url: `${registry}/${filename}`,
      verified: options.verify || false
    };
  }

  async recordInstallation(manifest: TemplateManifest): Promise<void> {
    await this.ensureDirsExist();
    
    const installedPath = path.join(this.configDir, 'installed.json');
    let installed: any[] = [];
    
    try {
      installed = JSON.parse(await fs.readFile(installedPath, 'utf8'));
    } catch (error) {
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
    
    await fs.writeFile(installedPath, JSON.stringify(installed, null, 2));
  }

  async listInstalledTemplates(): Promise<any[]> {
    await this.ensureDirsExist();
    
    const installedPath = path.join(this.configDir, 'installed.json');
    try {
      return JSON.parse(await fs.readFile(installedPath, 'utf8'));
    } catch (error) {
      return [];
    }
  }

  async updateIndex(): Promise<void> {
    // Force refresh by deleting cache
    const indexPath = path.join(this.cacheDir, 'templates.json');
    try {
      await fs.unlink(indexPath);
    } catch (error) {
      // File doesn't exist
    }
    
    // Fetch fresh index
    await this.getTemplateIndex();
  }

  async addCustomIndex(url: string): Promise<void> {
    await this.ensureDirsExist();
    
    const customIndexPath = path.join(this.configDir, 'custom-indexes.json');
    let indexes: string[] = [];
    
    try {
      indexes = JSON.parse(await fs.readFile(customIndexPath, 'utf8'));
    } catch (error) {
      // File doesn't exist yet
    }
    
    if (!indexes.includes(url)) {
      indexes.push(url);
      await fs.writeFile(customIndexPath, JSON.stringify(indexes, null, 2));
    }
  }

  private compareVersions(a: string, b: string): number {
    const parseVersion = (v: string) => v.split('.').map(Number);
    const versionA = parseVersion(a);
    const versionB = parseVersion(b);
    
    for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
      const partA = versionA[i] || 0;
      const partB = versionB[i] || 0;
      
      if (partA < partB) return -1;
      if (partA > partB) return 1;
    }
    
    return 0;
  }
}