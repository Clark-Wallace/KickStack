import * as fs from 'fs';
import * as path from 'path';
import { Plan, PlanStep, ColumnSpec } from './ai-planner';
import { ManifestManager, TableDefinition, PolicyDefinition, FunctionDefinition } from './manifest';

export interface CompileResult {
  migrations: MigrationFile[];
  functions: FunctionFile[];
  sdkFiles?: SdkFile[];
  tests?: TestFile[];
  warnings?: string[];
}

export interface MigrationFile {
  filename: string;
  content: string;
  order: number;
}

export interface FunctionFile {
  path: string;
  content: string;
}

export interface SdkFile {
  path: string;
  content: string;
}

export interface TestFile {
  path: string;
  content: string;
}

export class PlanCompiler {
  private manifestManager: ManifestManager;
  
  constructor() {
    this.manifestManager = new ManifestManager();
  }

  async compile(plan: Plan): Promise<CompileResult> {
    const result: CompileResult = {
      migrations: [],
      functions: [],
      warnings: plan.safety?.warnings || []
    };

    // Load current manifest
    const manifest = await this.manifestManager.load();
    
    // Process each step
    for (const step of plan.steps) {
      switch (step.kind) {
        case 'table':
          result.migrations.push(this.compileTable(step));
          break;
          
        case 'policy':
          result.migrations.push(this.compilePolicy(step));
          break;
          
        case 'function':
          if (step.function) {
            result.functions.push(this.compileFunction(step));
          }
          break;
          
        case 'realtime':
          if (step.realtime) {
            result.migrations.push(this.compileRealtime(step));
          }
          break;
          
        case 'index':
          if (step.index) {
            result.migrations.push(this.compileIndex(step));
          }
          break;
          
        case 'seed':
          if (step.seed) {
            result.migrations.push(this.compileSeed(step));
          }
          break;
          
        case 'note':
          // Notes are just for human context
          break;
      }
    }

    // Generate SDK if requested
    if (plan.sdk?.generate) {
      result.sdkFiles = await this.generateSDK(plan, manifest);
    }

    // Generate tests if verification specified
    if (plan.verification?.smoke) {
      result.tests = this.generateTests(plan);
    }

    return result;
  }

  private compileTable(step: PlanStep): MigrationFile {
    const tableName = step.name || 'unnamed_table';
    const columns = step.columns || [];
    
    let sql = '';
    
    // Create table
    if (step.ifNotExists) {
      sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    } else {
      sql += `CREATE TABLE ${tableName} (\n`;
    }
    
    // Add columns
    const columnDefs = columns.map(col => this.compileColumn(col));
    sql += columnDefs.join(',\n');
    
    // Add constraints
    if (step.constraints) {
      sql += ',\n' + step.constraints.map(c => `  ${c.sql}`).join(',\n');
    }
    
    sql += '\n);\n\n';
    
    // Enable RLS if specified
    if (step.rls?.enable) {
      sql += `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;\n\n`;
    }
    
    // Add policy if specified
    if (step.policy) {
      sql += this.compilePolicyForTable(tableName, step.policy);
    }
    
    // Add automatic permissions for API access
    sql += `-- Grant API access\n`;
    sql += `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tableName} TO anon;\n`;
    sql += `GRANT SELECT, INSERT, UPDATE, DELETE ON ${tableName} TO authenticated;\n\n`;
    
    return {
      filename: `${Date.now()}_create_${tableName}.sql`,
      content: sql,
      order: 1
    };
  }

  private compileColumn(col: ColumnSpec): string {
    let def = `  ${col.name} ${col.type.toUpperCase()}`;
    
    if (col.pk) {
      def += ' PRIMARY KEY';
    }
    
    if (col.default) {
      def += ` DEFAULT ${col.default}`;
    }
    
    if (!col.nullable && !col.pk) {
      def += ' NOT NULL';
    }
    
    if (col.unique && !col.pk) {
      def += ' UNIQUE';
    }
    
    if (col.references) {
      def += ` REFERENCES ${col.references}`;
    }
    
    return def;
  }

  private compilePolicyForTable(tableName: string, policy: any): string {
    let sql = `-- RLS Policies for ${tableName}\n`;
    
    switch (policy.preset) {
      case 'owner':
        sql += this.compileOwnerPolicy(tableName, policy.owner_col || 'user_id');
        break;
        
      case 'public_read':
        sql += this.compilePublicReadPolicy(tableName, policy.owner_col || 'user_id');
        break;
        
      case 'team_scope':
        sql += this.compileTeamScopePolicy(tableName, policy.org_col || 'org_id', policy.owner_col);
        break;
        
      case 'admin_override':
        sql += this.compileAdminOverridePolicy(tableName);
        break;
    }
    
    return sql;
  }

  private compileOwnerPolicy(table: string, ownerCol: string): string {
    return `
-- Owner-only access
CREATE POLICY ${table}_owner_select ON ${table}
  FOR SELECT USING (${ownerCol} = auth.uid());
  
CREATE POLICY ${table}_owner_insert ON ${table}
  FOR INSERT WITH CHECK (${ownerCol} = auth.uid());
  
CREATE POLICY ${table}_owner_update ON ${table}
  FOR UPDATE USING (${ownerCol} = auth.uid())
  WITH CHECK (${ownerCol} = auth.uid());
  
CREATE POLICY ${table}_owner_delete ON ${table}
  FOR DELETE USING (${ownerCol} = auth.uid());
`;
  }

  private compilePublicReadPolicy(table: string, ownerCol: string): string {
    return `
-- Public read, owner write
CREATE POLICY ${table}_public_read ON ${table}
  FOR SELECT USING (true);
  
CREATE POLICY ${table}_owner_insert ON ${table}
  FOR INSERT WITH CHECK (${ownerCol} = auth.uid());
  
CREATE POLICY ${table}_owner_update ON ${table}
  FOR UPDATE USING (${ownerCol} = auth.uid())
  WITH CHECK (${ownerCol} = auth.uid());
  
CREATE POLICY ${table}_owner_delete ON ${table}
  FOR DELETE USING (${ownerCol} = auth.uid());
`;
  }

  private compileTeamScopePolicy(table: string, orgCol: string, ownerCol?: string): string {
    let sql = `
-- Team scope access
CREATE POLICY ${table}_team_select ON ${table}
  FOR SELECT USING (${orgCol} = auth_org());
`;
    
    if (ownerCol) {
      sql += `
CREATE POLICY ${table}_owner_insert ON ${table}
  FOR INSERT WITH CHECK (${orgCol} = auth_org() AND ${ownerCol} = auth.uid());
  
CREATE POLICY ${table}_owner_update ON ${table}
  FOR UPDATE USING (${orgCol} = auth_org() AND ${ownerCol} = auth.uid())
  WITH CHECK (${orgCol} = auth_org() AND ${ownerCol} = auth.uid());
  
CREATE POLICY ${table}_owner_delete ON ${table}
  FOR DELETE USING (${orgCol} = auth_org() AND ${ownerCol} = auth.uid());
`;
    } else {
      sql += `
CREATE POLICY ${table}_team_insert ON ${table}
  FOR INSERT WITH CHECK (${orgCol} = auth_org());
  
CREATE POLICY ${table}_team_update ON ${table}
  FOR UPDATE USING (${orgCol} = auth_org())
  WITH CHECK (${orgCol} = auth_org());
  
CREATE POLICY ${table}_team_delete ON ${table}
  FOR DELETE USING (${orgCol} = auth_org());
`;
    }
    
    return sql;
  }

  private compileAdminOverridePolicy(table: string): string {
    return `
-- Admin override access
CREATE POLICY ${table}_admin_all ON ${table}
  USING (is_admin())
  WITH CHECK (is_admin());
`;
  }

  private compilePolicy(step: PlanStep): MigrationFile {
    // Standalone policy compilation
    const sql = '-- Policy implementation';
    
    return {
      filename: `${Date.now()}_add_policy.sql`,
      content: sql,
      order: 2
    };
  }

  private compileFunction(step: PlanStep): FunctionFile {
    const func = step.function!;
    const content = `
// ${func.name} - Edge Function
// Auto-generated by KickStack AI

export default async function handler(req: Request): Promise<Response> {
  try {
    const { method } = req;
    
    // Parse request body if needed
    const body = method === 'POST' || method === 'PUT' 
      ? await req.json() 
      : null;
    
    // TODO: Implement your business logic here
    
    // Example response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '${func.name} executed successfully' 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
`;
    
    return {
      path: func.path || `/functions/${func.name}.ts`,
      content
    };
  }

  private compileRealtime(step: PlanStep): MigrationFile {
    const rt = step.realtime!;
    const sql = `
-- Enable realtime for ${rt.table}
ALTER PUBLICATION supabase_realtime ADD TABLE ${rt.table};

-- Create trigger for change notifications
CREATE OR REPLACE FUNCTION notify_${rt.table}_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'table_changes',
    json_build_object(
      'table', '${rt.table}',
      'type', TG_OP,
      'id', CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.id 
        ELSE NEW.id 
      END,
      'data', CASE
        WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
        ELSE row_to_json(NEW)
      END
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ${rt.table}_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON ${rt.table}
FOR EACH ROW EXECUTE FUNCTION notify_${rt.table}_changes();
`;
    
    return {
      filename: `${Date.now()}_enable_realtime_${rt.table}.sql`,
      content: sql,
      order: 3
    };
  }

  private compileIndex(step: PlanStep): MigrationFile {
    const idx = step.index!;
    const indexName = `idx_${idx.table}_${idx.columns.join('_')}`;
    
    let sql = 'CREATE ';
    if (idx.unique) sql += 'UNIQUE ';
    sql += 'INDEX ';
    if (idx.ifNotExists) sql += 'IF NOT EXISTS ';
    sql += `${indexName} ON ${idx.table} (${idx.columns.join(', ')});`;
    
    return {
      filename: `${Date.now()}_add_index_${idx.table}.sql`,
      content: sql,
      order: 4
    };
  }

  private compileSeed(step: PlanStep): MigrationFile {
    const seed = step.seed!;
    const values = seed.rows.map(row => {
      const cols = Object.keys(row);
      const vals = Object.values(row).map(v => 
        typeof v === 'string' ? `'${v}'` : v
      );
      return `(${vals.join(', ')})`;
    });
    
    const cols = Object.keys(seed.rows[0] || {});
    const sql = `
-- Seed data for ${seed.table}
INSERT INTO ${seed.table} (${cols.join(', ')})
VALUES ${values.join(',\n       ')}
ON CONFLICT DO NOTHING;
`;
    
    return {
      filename: `${Date.now()}_seed_${seed.table}.sql`,
      content: sql,
      order: 5
    };
  }

  private async generateSDK(plan: Plan, manifest: any): Promise<SdkFile[]> {
    const files: SdkFile[] = [];
    
    // Generate TypeScript types
    const typesContent = this.generateTypes(plan, manifest);
    files.push({
      path: '/sdk/types.ts',
      content: typesContent
    });
    
    // Generate React hooks if specified
    if (plan.sdk?.framework === 'react' && plan.sdk.hooks) {
      const hooksContent = this.generateReactHooks(plan);
      files.push({
        path: '/sdk/hooks.ts',
        content: hooksContent
      });
    }
    
    // Generate API client
    const clientContent = this.generateAPIClient(plan);
    files.push({
      path: '/sdk/client.ts',
      content: clientContent
    });
    
    return files;
  }

  private generateTypes(plan: Plan, manifest: any): string {
    let content = `// Auto-generated TypeScript types\n\n`;
    
    // Generate types for each table
    for (const step of plan.steps) {
      if (step.kind === 'table' && step.columns) {
        const typeName = this.toPascalCase(step.name || 'Unknown');
        content += `export interface ${typeName} {\n`;
        
        for (const col of step.columns) {
          const tsType = this.pgToTsType(col.type);
          const optional = col.nullable ? '?' : '';
          content += `  ${col.name}${optional}: ${tsType};\n`;
        }
        
        content += `}\n\n`;
      }
    }
    
    return content;
  }

  private generateReactHooks(plan: Plan): string {
    let content = `// Auto-generated React hooks
import { useState, useEffect } from 'react';
import { apiClient } from './client';

`;
    
    if (!plan.sdk?.hooks) return content;
    
    for (const hookName of plan.sdk.hooks) {
      content += `export function ${hookName}() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // TODO: Implement fetch logic
    setLoading(false);
  }, []);
  
  return { data, loading, error };
}\n\n`;
    }
    
    return content;
  }

  private generateAPIClient(plan: Plan): string {
    return `// Auto-generated API client
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3050';

class APIClient {
  private token: string | null = null;
  
  setToken(token: string) {
    this.token = token;
  }
  
  async request(path: string, options: RequestInit = {}) {
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (this.token) {
      headers['Authorization'] = \`Bearer \${this.token}\`;
    }
    
    const response = await fetch(\`\${API_URL}\${path}\`, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      throw new Error(\`API error: \${response.statusText}\`);
    }
    
    return response.json();
  }
  
  get(path: string) {
    return this.request(path, { method: 'GET' });
  }
  
  post(path: string, data: any) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  patch(path: string, data: any) {
    return this.request(path, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  
  delete(path: string) {
    return this.request(path, { method: 'DELETE' });
  }
}

export const apiClient = new APIClient();
`;
  }

  private generateTests(plan: Plan): TestFile[] {
    const tests: TestFile[] = [];
    
    if (!plan.verification?.smoke) return tests;
    
    const content = `// Auto-generated integration tests
import { apiClient } from '../sdk/client';

describe('API Integration Tests', () => {
${plan.verification.smoke.map(test => `
  test('${test.method} ${test.path}', async () => {
    ${test.token ? `apiClient.setToken('${test.token}');` : ''}
    const response = await apiClient.${test.method.toLowerCase()}('${test.path}'${test.body ? `, ${JSON.stringify(test.body)}` : ''});
    expect(response).toBeDefined();
  });
`).join('\n')}
});
`;
    
    tests.push({
      path: '/tests/integration.test.ts',
      content
    });
    
    return tests;
  }

  private pgToTsType(pgType: string): string {
    const typeMap: Record<string, string> = {
      'uuid': 'string',
      'text': 'string',
      'varchar': 'string',
      'char': 'string',
      'integer': 'number',
      'bigint': 'number',
      'numeric': 'number',
      'decimal': 'number',
      'boolean': 'boolean',
      'timestamptz': 'string',
      'timestamp': 'string',
      'date': 'string',
      'jsonb': 'any',
      'json': 'any'
    };
    
    return typeMap[pgType.toLowerCase()] || 'any';
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}