import * as fs from 'fs';
import * as path from 'path';

export interface ProjectManifest {
  version: number;
  projectName: string;
  created: string;
  lastModified: string;
  environment: {
    deploymentTarget: 'local' | 'fly.io' | 'vercel' | 'railway';
    hasAuth: boolean;
    jwtSecretConfigured: boolean;
  };
  schema: {
    tables: TableDefinition[];
    policies: PolicyDefinition[];
    indexes: IndexDefinition[];
    functions: FunctionDefinition[];
    realtime: RealtimeDefinition[];
  };
  frontend: {
    framework?: 'react' | 'nextjs' | 'vue' | 'svelte';
    sdkGenerated?: boolean;
    sdkPath?: string;
  } | null;
  dependencies: {
    payments?: 'stripe' | 'paddle' | null;
    email?: 'sendgrid' | 'resend' | 'mailgun' | null;
    storage?: 'minio' | 's3' | null;
    webhooks?: boolean;
  };
  history: ChangeEvent[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  constraints?: string[];
  rlsEnabled: boolean;
  createdAt: string;
  lastModified: string;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  pk?: boolean;
  nullable?: boolean;
  default?: string | null;
  unique?: boolean;
  references?: string | null;
}

export interface PolicyDefinition {
  table: string;
  preset: 'owner' | 'public_read' | 'team_scope' | 'admin_override';
  ownerCol?: string;
  orgCol?: string;
  createdAt: string;
}

export interface IndexDefinition {
  table: string;
  columns: string[];
  unique?: boolean;
  name?: string;
  createdAt: string;
}

export interface FunctionDefinition {
  name: string;
  runtime: 'edge' | 'node';
  path: string;
  triggers?: TriggerDefinition[];
  env?: string[];
  signature?: {
    input: string;
    output: string;
  };
  createdAt: string;
}

export interface TriggerDefinition {
  table: string;
  when: 'after_insert' | 'after_update' | 'after_delete' | 'before_insert' | 'before_update' | 'before_delete';
}

export interface RealtimeDefinition {
  table: string;
  enabled: boolean;
  createdAt: string;
}

export interface ChangeEvent {
  timestamp: string;
  type: 'create' | 'evolve' | 'rollback';
  prompt: string;
  summary: string;
  changes: string[];
}

export class ManifestManager {
  private manifestPath: string;
  private manifest: ProjectManifest | null = null;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.manifestPath = path.join(root, '.kickstack', 'project.json');
  }

  async load(): Promise<ProjectManifest | null> {
    try {
      if (!fs.existsSync(this.manifestPath)) {
        return null;
      }
      
      const content = fs.readFileSync(this.manifestPath, 'utf8');
      this.manifest = JSON.parse(content);
      return this.manifest;
    } catch (error) {
      console.error('Failed to load manifest:', error);
      return null;
    }
  }

  async save(manifest: ProjectManifest): Promise<void> {
    const dir = path.dirname(this.manifestPath);
    
    // Ensure .kickstack directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Update lastModified
    manifest.lastModified = new Date().toISOString();
    
    // Save with pretty formatting
    fs.writeFileSync(
      this.manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
    
    this.manifest = manifest;
  }

  async create(projectName: string): Promise<ProjectManifest> {
    const manifest: ProjectManifest = {
      version: 1,
      projectName,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      environment: {
        deploymentTarget: 'local',
        hasAuth: true,
        jwtSecretConfigured: false
      },
      schema: {
        tables: [],
        policies: [],
        indexes: [],
        functions: [],
        realtime: []
      },
      frontend: null,
      dependencies: {},
      history: []
    };
    
    await this.save(manifest);
    return manifest;
  }

  async addTable(table: TableDefinition): Promise<void> {
    if (!this.manifest) {
      throw new Error('No manifest loaded');
    }
    
    // Remove existing table with same name if exists
    this.manifest.schema.tables = this.manifest.schema.tables.filter(
      t => t.name !== table.name
    );
    
    // Add new table
    this.manifest.schema.tables.push(table);
    
    await this.save(this.manifest);
  }

  async addPolicy(policy: PolicyDefinition): Promise<void> {
    if (!this.manifest) {
      throw new Error('No manifest loaded');
    }
    
    // Check if policy already exists for this table/preset combo
    const existing = this.manifest.schema.policies.find(
      p => p.table === policy.table && p.preset === policy.preset
    );
    
    if (!existing) {
      this.manifest.schema.policies.push(policy);
      await this.save(this.manifest);
    }
  }

  async addFunction(func: FunctionDefinition): Promise<void> {
    if (!this.manifest) {
      throw new Error('No manifest loaded');
    }
    
    // Remove existing function with same name
    this.manifest.schema.functions = this.manifest.schema.functions.filter(
      f => f.name !== func.name
    );
    
    // Add new function
    this.manifest.schema.functions.push(func);
    
    await this.save(this.manifest);
  }

  async recordChange(event: ChangeEvent): Promise<void> {
    if (!this.manifest) {
      throw new Error('No manifest loaded');
    }
    
    this.manifest.history.push(event);
    
    // Keep only last 50 events
    if (this.manifest.history.length > 50) {
      this.manifest.history = this.manifest.history.slice(-50);
    }
    
    await this.save(this.manifest);
  }

  getManifest(): ProjectManifest | null {
    return this.manifest;
  }

  exists(): boolean {
    return fs.existsSync(this.manifestPath);
  }
}