import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectManifest, ManifestManager } from './manifest';

export interface Plan {
  version: number;
  summary: string;
  steps: PlanStep[];
  verification?: {
    smoke?: SmokeTest[];
  };
  safety?: {
    warnings?: string[];
    breaking?: boolean;
  };
  sdk?: {
    generate?: boolean;
    framework?: string;
    hooks?: string[];
  };
  dependencies?: {
    payments?: boolean;
    email?: boolean;
    webhooks?: boolean;
  };
}

export interface PlanStep {
  kind: 'table' | 'policy' | 'function' | 'realtime' | 'seed' | 'index' | 'note';
  name?: string;
  ifNotExists?: boolean;
  columns?: ColumnSpec[];
  constraints?: { sql: string }[];
  rls?: { enable: boolean };
  policy?: {
    preset: 'owner' | 'public_read' | 'team_scope' | 'admin_override';
    owner_col?: string;
    org_col?: string;
  };
  function?: {
    name: string;
    runtime: string;
    path: string;
    triggers?: Array<{
      table: string;
      when: string;
    }>;
    env?: string[];
    signature?: {
      input: string;
      output: string;
    };
  };
  realtime?: {
    table: string;
    enabled: boolean;
  };
  index?: {
    table: string;
    columns: string[];
    unique?: boolean;
    ifNotExists?: boolean;
  };
  seed?: {
    table: string;
    rows: Record<string, any>[];
  };
  note?: {
    text: string;
  };
}

export interface ColumnSpec {
  name: string;
  type: string;
  pk?: boolean;
  nullable?: boolean;
  default?: string | null;
  unique?: boolean;
  references?: string | null;
}

export interface SmokeTest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  expect: number;
  token?: string;
  body?: any;
}

export class AIPlanner {
  private openai: OpenAI | null = null;
  private systemPrompt: string;
  private manifestManager: ManifestManager;

  constructor() {
    // Initialize OpenAI if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }

    // Load system prompt
    const promptPath = path.join(__dirname, '../prompts/system_prompt.md');
    this.systemPrompt = fs.readFileSync(promptPath, 'utf8');
    
    this.manifestManager = new ManifestManager();
  }

  async generatePlan(nlRequest: string, manifest?: ProjectManifest): Promise<Plan> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    // Load manifest if not provided
    const currentManifest = manifest || await this.manifestManager.load() || {
      version: 1,
      projectName: 'new-project',
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

    // Build the prompt with template variables
    const prompt = this.systemPrompt
      .replace('{{PROJECT_MANIFEST_JSON}}', JSON.stringify(currentManifest, null, 2))
      .replace('{{NL_REQUEST}}', nlRequest)
      .replace('{{DEPLOY_TARGET}}', currentManifest.environment.deploymentTarget || 'local')
      .replace('{{HAS_AUTH}}', String(currentManifest.environment.hasAuth || false))
      .replace('{{JWT_SECRET_CONFIGURED}}', String(currentManifest.environment.jwtSecretConfigured || false));

    try {
      // Call OpenAI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are KickStack\'s backend planner. Output JSON first, then markdown rationale.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON from the first line
      const lines = response.split('\n');
      const jsonLine = lines[0];
      
      try {
        const plan = JSON.parse(jsonLine) as Plan;
        
        // Store the rationale if present
        const rationaleIndex = lines.findIndex(line => line === '---');
        if (rationaleIndex > 0 && rationaleIndex < lines.length - 1) {
          const rationale = lines.slice(rationaleIndex + 1).join('\n');
          console.log('\n📝 AI Rationale:', rationale);
        }
        
        return plan;
      } catch (parseError) {
        // Try to extract JSON from the response if not on first line
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as Plan;
        }
        throw new Error(`Failed to parse plan JSON: ${parseError}`);
      }
    } catch (error) {
      throw new Error(`AI planning failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async generatePlanWithFallback(nlRequest: string, manifest?: ProjectManifest): Promise<Plan> {
    try {
      // Try OpenAI first
      return await this.generatePlan(nlRequest, manifest);
    } catch (error) {
      console.warn('OpenAI unavailable, using fallback templates');
      
      // Fallback to template-based generation for common requests
      return this.generateFallbackPlan(nlRequest, manifest);
    }
  }

  private generateFallbackPlan(nlRequest: string, manifest?: ProjectManifest): Plan {
    const request = nlRequest.toLowerCase();
    
    // Check for common patterns
    if (request.includes('multi-tenant') && request.includes('saas')) {
      return this.getMultiTenantSaaSTemplate();
    }
    
    if (request.includes('blog')) {
      return this.getBlogTemplate();
    }
    
    if (request.includes('chat') || request.includes('messaging')) {
      return this.getChatTemplate();
    }
    
    // Default simple CRUD
    return this.getSimpleCRUDTemplate(nlRequest);
  }

  private getMultiTenantSaaSTemplate(): Plan {
    return {
      version: 1,
      summary: "Multi-tenant SaaS with organizations, users, projects, and invites",
      steps: [
        {
          kind: 'table',
          name: 'organizations',
          ifNotExists: true,
          columns: [
            { name: 'id', type: 'uuid', pk: true, nullable: false, default: 'gen_random_uuid()' },
            { name: 'name', type: 'text', nullable: false },
            { name: 'slug', type: 'text', nullable: false, unique: true },
            { name: 'settings', type: 'jsonb', nullable: true, default: "'{}'" },
            { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
            { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' }
          ],
          rls: { enable: true }
        },
        {
          kind: 'table',
          name: 'users',
          ifNotExists: true,
          columns: [
            { name: 'id', type: 'uuid', pk: true, nullable: false, default: 'gen_random_uuid()' },
            { name: 'org_id', type: 'uuid', nullable: false, references: 'organizations(id)' },
            { name: 'email', type: 'text', nullable: false, unique: true },
            { name: 'name', type: 'text', nullable: false },
            { name: 'role', type: 'text', nullable: false, default: "'member'" },
            { name: 'is_admin', type: 'boolean', nullable: false, default: 'false' },
            { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' }
          ],
          rls: { enable: true },
          policy: { preset: 'team_scope', org_col: 'org_id' }
        },
        {
          kind: 'table',
          name: 'projects',
          ifNotExists: true,
          columns: [
            { name: 'id', type: 'uuid', pk: true, nullable: false, default: 'gen_random_uuid()' },
            { name: 'org_id', type: 'uuid', nullable: false, references: 'organizations(id)' },
            { name: 'name', type: 'text', nullable: false },
            { name: 'description', type: 'text', nullable: true },
            { name: 'status', type: 'text', nullable: false, default: "'active'" },
            { name: 'owner_id', type: 'uuid', nullable: false, references: 'users(id)' },
            { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
            { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' }
          ],
          rls: { enable: true },
          policy: { preset: 'team_scope', org_col: 'org_id', owner_col: 'owner_id' }
        }
      ],
      verification: {
        smoke: [
          { method: 'GET', path: '/organizations', expect: 200, token: 'AUTH_A' },
          { method: 'GET', path: '/projects', expect: 200, token: 'AUTH_A' }
        ]
      },
      safety: {
        warnings: [],
        breaking: false
      },
      sdk: {
        generate: true,
        framework: 'react',
        hooks: ['useOrganizations', 'useProjects', 'useUsers']
      },
      dependencies: {
        payments: false,
        email: true,
        webhooks: false
      }
    };
  }

  private getBlogTemplate(): Plan {
    return {
      version: 1,
      summary: "Blog with posts, comments, and categories",
      steps: [
        {
          kind: 'table',
          name: 'posts',
          ifNotExists: true,
          columns: [
            { name: 'id', type: 'uuid', pk: true, nullable: false, default: 'gen_random_uuid()' },
            { name: 'title', type: 'text', nullable: false },
            { name: 'slug', type: 'text', nullable: false, unique: true },
            { name: 'content', type: 'text', nullable: false },
            { name: 'author_id', type: 'uuid', nullable: false },
            { name: 'published', type: 'boolean', nullable: false, default: 'false' },
            { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
            { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' }
          ],
          rls: { enable: true },
          policy: { preset: 'public_read', owner_col: 'author_id' }
        }
      ],
      sdk: {
        generate: true,
        framework: 'react',
        hooks: ['usePosts', 'usePost', 'useCreatePost']
      }
    };
  }

  private getChatTemplate(): Plan {
    return {
      version: 1,
      summary: "Chat system with rooms and messages",
      steps: [
        {
          kind: 'table',
          name: 'chat_rooms',
          ifNotExists: true,
          columns: [
            { name: 'id', type: 'uuid', pk: true, nullable: false, default: 'gen_random_uuid()' },
            { name: 'name', type: 'text', nullable: false },
            { name: 'type', type: 'text', nullable: false, default: "'public'" },
            { name: 'created_by', type: 'uuid', nullable: false },
            { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' }
          ],
          rls: { enable: true }
        },
        {
          kind: 'table',
          name: 'messages',
          ifNotExists: true,
          columns: [
            { name: 'id', type: 'uuid', pk: true, nullable: false, default: 'gen_random_uuid()' },
            { name: 'room_id', type: 'uuid', nullable: false, references: 'chat_rooms(id)' },
            { name: 'user_id', type: 'uuid', nullable: false },
            { name: 'content', type: 'text', nullable: false },
            { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' }
          ],
          rls: { enable: true },
          realtime: { table: 'messages', enabled: true }
        }
      ],
      sdk: {
        generate: true,
        framework: 'react',
        hooks: ['useMessages', 'useSendMessage', 'useRooms']
      }
    };
  }

  private getSimpleCRUDTemplate(nlRequest: string): Plan {
    // Extract table name from request
    const words = nlRequest.split(' ');
    const tableName = words[0]?.toLowerCase() || 'items';
    
    return {
      version: 1,
      summary: `Simple CRUD for ${tableName}`,
      steps: [
        {
          kind: 'table',
          name: tableName,
          ifNotExists: true,
          columns: [
            { name: 'id', type: 'uuid', pk: true, nullable: false, default: 'gen_random_uuid()' },
            { name: 'name', type: 'text', nullable: false },
            { name: 'description', type: 'text', nullable: true },
            { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' },
            { name: 'updated_at', type: 'timestamptz', nullable: false, default: 'now()' }
          ],
          rls: { enable: true },
          policy: { preset: 'owner', owner_col: 'user_id' }
        }
      ],
      sdk: {
        generate: true,
        framework: 'react'
      }
    };
  }
}