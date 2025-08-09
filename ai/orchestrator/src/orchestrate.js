"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orchestrator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const chalk_1 = __importDefault(require("chalk"));
const ollama_adapter_1 = require("../../cli/src/adapters/ollama-adapter");
const openai_adapter_1 = require("../../cli/src/adapters/openai-adapter");
const template_manager_1 = require("../../cli/src/lib/template-manager");
class Orchestrator {
    adapter;
    promptTemplate;
    templateManager;
    constructor() {
        // Try Ollama first, fallback to OpenAI
        const ollamaAdapter = new ollama_adapter_1.OllamaAdapter();
        if (ollamaAdapter.isAvailable()) {
            this.adapter = ollamaAdapter;
        }
        else {
            this.adapter = new openai_adapter_1.OpenAIAdapter();
        }
        // Load prompt template
        const promptPath = path.join(__dirname, '../prompts/plan.md');
        this.promptTemplate = fs.readFileSync(promptPath, 'utf8');
        // Initialize template manager
        this.templateManager = new template_manager_1.TemplateManager();
    }
    async parseIntent(naturalLanguage) {
        console.log(chalk_1.default.yellow('🤖 Analyzing requirements...'));
        // Check for matching templates
        const suggestedTemplates = await this.findMatchingTemplates(naturalLanguage);
        let prompt = this.promptTemplate;
        // Add template suggestions to prompt if found
        if (suggestedTemplates.length > 0) {
            console.log(chalk_1.default.blue(`💡 Found ${suggestedTemplates.length} matching template(s) that could help:`));
            for (const template of suggestedTemplates) {
                console.log(`   • ${template.display_name}: ${template.description}`);
            }
            const templateInfo = suggestedTemplates.map(t => `- ${t.name}: ${t.description} (tables: ${t.contents?.tables?.join(', ') || 'unknown'})`).join('\n');
            prompt += `\n\nAVAILABLE TEMPLATES:\nThe following templates are available and may match parts of this requirement:\n${templateInfo}\n\nYou can suggest using these templates in your plan by referencing them in the 'notes' section.`;
        }
        prompt += `\n\nUser requirement: ${naturalLanguage}\n\nGenerate the Plan JSON:`;
        try {
            const response = await this.adapter.generateSQL(prompt);
            // Extract JSON from response (between ```json and ```)
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch) {
                // Try to parse the whole response as JSON
                return JSON.parse(response);
            }
            const planJson = JSON.parse(jsonMatch[1]);
            // Validate plan structure
            if (!planJson.version || !planJson.steps || !Array.isArray(planJson.steps)) {
                throw new Error('Invalid plan structure');
            }
            return planJson;
        }
        catch (error) {
            console.error(chalk_1.default.red('Failed to generate plan:'), error);
            throw new Error(`Plan generation failed: ${error instanceof Error ? error.message : error}`);
        }
    }
    renderPlan(plan) {
        const migrations = [];
        const functions = [];
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
        for (const step of plan.steps) {
            if (step.kind === 'table') {
                // Generate CREATE TABLE migration
                const createTableSql = this.generateCreateTableSQL(step);
                migrations.push({
                    name: `${timestamp}_create_${step.name}.sql`,
                    content: createTableSql
                });
                // Generate RLS policy migration if specified
                if (step.policy) {
                    const policySql = this.generatePolicySQL(step);
                    migrations.push({
                        name: `${timestamp}_rls_${step.policy.preset}_${step.name}.sql`,
                        content: policySql
                    });
                }
                // Generate realtime triggers if specified
                if (step.realtime) {
                    const realtimeSql = this.generateRealtimeSQL(step.name);
                    migrations.push({
                        name: `${timestamp}_realtime_${step.name}.sql`,
                        content: realtimeSql
                    });
                }
            }
            else if (step.kind === 'function') {
                // Generate edge function
                const functionCode = this.generateFunctionCode(step);
                functions.push({
                    path: step.path,
                    content: functionCode
                });
                // Generate trigger migration if specified
                if (step.trigger) {
                    const triggerSql = this.generateTriggerSQL(step);
                    migrations.push({
                        name: `${timestamp}_trigger_${step.name}.sql`,
                        content: triggerSql
                    });
                }
            }
        }
        return { migrations, functions };
    }
    generateCreateTableSQL(step) {
        const columns = step.columns.map((col) => {
            let def = `  "${col.name}" ${col.type.toUpperCase()}`;
            if (col.pk) {
                def += ' PRIMARY KEY';
            }
            if (col.default) {
                def += ` DEFAULT ${col.default}`;
            }
            if (col.nullable === false) {
                def += ' NOT NULL';
            }
            if (col.ref) {
                const [refTable, refCol] = col.ref.replace(')', '').split('(');
                def += ` REFERENCES ${refTable}(${refCol})`;
            }
            return def;
        }).join(',\n');
        return `-- Create table: ${step.name}
CREATE TABLE IF NOT EXISTS public."${step.name}" (
${columns}
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_${step.name}_created_at ON public."${step.name}"(created_at);
${step.policy ? `CREATE INDEX IF NOT EXISTS idx_${step.name}_${step.policy.owner_col} ON public."${step.name}"(${step.policy.owner_col});` : ''}

-- Add comments
COMMENT ON TABLE public."${step.name}" IS 'Generated by KickStack AI Orchestrator';`;
    }
    generatePolicySQL(step) {
        const { preset, owner_col } = step.policy;
        if (preset === 'owner') {
            return this.generateOwnerPolicySQL(step.name, owner_col);
        }
        else if (preset === 'public_read') {
            return this.generatePublicReadPolicySQL(step.name, owner_col);
        }
        throw new Error(`Unknown policy preset: ${preset}`);
    }
    generateOwnerPolicySQL(table, ownerCol) {
        return `-- Enable RLS for ${table}
ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;

-- Policy: select_own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'select_own'
  ) THEN
    CREATE POLICY select_own ON public."${table}"
      FOR SELECT
      USING ("${ownerCol}" = auth_uid());
  END IF;
END $$;

-- Policy: insert_own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'insert_own'
  ) THEN
    CREATE POLICY insert_own ON public."${table}"
      FOR INSERT
      WITH CHECK ("${ownerCol}" = auth_uid());
  END IF;
END $$;

-- Policy: update_own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'update_own'
  ) THEN
    CREATE POLICY update_own ON public."${table}"
      FOR UPDATE
      USING ("${ownerCol}" = auth_uid())
      WITH CHECK ("${ownerCol}" = auth_uid());
  END IF;
END $$;

-- Policy: delete_own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'delete_own'
  ) THEN
    CREATE POLICY delete_own ON public."${table}"
      FOR DELETE
      USING ("${ownerCol}" = auth_uid());
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public."${table}" TO authenticated;
REVOKE ALL ON public."${table}" FROM anon;`;
    }
    generatePublicReadPolicySQL(table, ownerCol) {
        return `-- Enable RLS for ${table}
ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;

-- Policy: select_public
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'select_public'
  ) THEN
    CREATE POLICY select_public ON public."${table}"
      FOR SELECT
      USING (TRUE);
  END IF;
END $$;

-- Policy: insert_own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'insert_own'
  ) THEN
    CREATE POLICY insert_own ON public."${table}"
      FOR INSERT
      WITH CHECK ("${ownerCol}" = auth_uid());
  END IF;
END $$;

-- Policy: update_own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'update_own'
  ) THEN
    CREATE POLICY update_own ON public."${table}"
      FOR UPDATE
      USING ("${ownerCol}" = auth_uid())
      WITH CHECK ("${ownerCol}" = auth_uid());
  END IF;
END $$;

-- Policy: delete_own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '${table}' 
    AND policyname = 'delete_own'
  ) THEN
    CREATE POLICY delete_own ON public."${table}"
      FOR DELETE
      USING ("${ownerCol}" = auth_uid());
  END IF;
END $$;

-- Grants
GRANT SELECT ON public."${table}" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."${table}" TO authenticated;`;
    }
    generateRealtimeSQL(table) {
        return `-- Create realtime triggers for ${table}
CREATE OR REPLACE FUNCTION notify_${table}_changes() RETURNS trigger AS $$
BEGIN
  INSERT INTO kickstack_changes (table_name, op, row_id, ts)
  VALUES (
    '${table}',
    TG_OP,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    EXTRACT(EPOCH FROM NOW()) * 1000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS ${table}_insert_trigger ON public."${table}";
CREATE TRIGGER ${table}_insert_trigger
  AFTER INSERT ON public."${table}"
  FOR EACH ROW EXECUTE FUNCTION notify_${table}_changes();

DROP TRIGGER IF EXISTS ${table}_update_trigger ON public."${table}";
CREATE TRIGGER ${table}_update_trigger
  AFTER UPDATE ON public."${table}"
  FOR EACH ROW EXECUTE FUNCTION notify_${table}_changes();

DROP TRIGGER IF EXISTS ${table}_delete_trigger ON public."${table}";
CREATE TRIGGER ${table}_delete_trigger
  AFTER DELETE ON public."${table}"
  FOR EACH ROW EXECUTE FUNCTION notify_${table}_changes();`;
    }
    generateFunctionCode(step) {
        const envVars = step.env?.map((e) => `  const ${e.replace('KICKSTACK_FN_', '').toLowerCase()} = ctx.env['${e}'];`).join('\n') || '';
        return `import type { KickContext, KickEvent } from "../types";

export default async function handler(event: KickEvent, ctx: KickContext) {
  ctx.log("${step.name} function called", { 
    user: ctx.user?.sub,
    trigger: ${step.trigger ? `'${step.trigger.when}'` : 'null'}
  });
  
${envVars}
  
  // TODO: Implement ${step.name} logic
  ${step.trigger ? `// This function is triggered ${step.trigger.when} on ${step.trigger.table}` : ''}
  
  return {
    ok: true,
    message: "${step.name} executed successfully",
    user: ctx.user,
    timestamp: new Date().toISOString()
  };
}`;
    }
    generateTriggerSQL(step) {
        const { trigger, name } = step;
        return `-- Create database trigger to call edge function
CREATE OR REPLACE FUNCTION kickstack_fn_call_${name}() RETURNS trigger AS $$
BEGIN
  -- Call edge function via pg_net or similar (placeholder)
  -- In production, use pg_net extension or NOTIFY/LISTEN
  PERFORM pg_notify('kickstack_function', json_build_object(
    'function', '${name}',
    'trigger', '${trigger.when}',
    'table', '${trigger.table}',
    'row', row_to_json(NEW)
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to table
DROP TRIGGER IF EXISTS ${name}_trigger ON public."${trigger.table}";
CREATE TRIGGER ${name}_trigger
  ${trigger.when.replace('_', ' ').toUpperCase()} ON public."${trigger.table}"
  FOR EACH ROW EXECUTE FUNCTION kickstack_fn_call_${name}();`;
    }
    async stageArtifacts(rendered) {
        // Create staging directories
        const migrationsStagingDir = path.join(process.cwd(), 'infra', 'migrations', '_staged');
        const functionsStagingDir = path.join(process.cwd(), 'api', 'functions', '_staged');
        fs.mkdirSync(migrationsStagingDir, { recursive: true });
        fs.mkdirSync(functionsStagingDir, { recursive: true });
        // Stage migrations
        for (const migration of rendered.migrations) {
            const filePath = path.join(migrationsStagingDir, migration.name);
            fs.writeFileSync(filePath, migration.content);
            console.log(chalk_1.default.gray(`  Staged migration: ${migration.name}`));
        }
        // Stage functions
        for (const func of rendered.functions) {
            const fileName = path.basename(func.path);
            const filePath = path.join(functionsStagingDir, fileName);
            fs.writeFileSync(filePath, func.content);
            console.log(chalk_1.default.gray(`  Staged function: ${fileName}`));
        }
    }
    printSummary(plan, rendered) {
        console.log(chalk_1.default.white('\n📋 Plan Summary'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.cyan(`Summary: ${plan.summary}`));
        console.log(chalk_1.default.cyan(`Version: ${plan.version}`));
        // Tables
        const tables = plan.steps.filter(s => s.kind === 'table');
        if (tables.length > 0) {
            console.log(chalk_1.default.white('\n📊 Tables:'));
            for (const table of tables) {
                const t = table;
                console.log(chalk_1.default.gray(`  • ${t.name} (${t.columns.length} columns)`));
                if (t.policy) {
                    console.log(chalk_1.default.gray(`    └─ Policy: ${t.policy.preset} (owner: ${t.policy.owner_col})`));
                }
            }
        }
        // Functions
        const functions = plan.steps.filter(s => s.kind === 'function');
        if (functions.length > 0) {
            console.log(chalk_1.default.white('\n⚡ Functions:'));
            for (const func of functions) {
                const f = func;
                console.log(chalk_1.default.gray(`  • ${f.name}`));
                if (f.trigger) {
                    console.log(chalk_1.default.gray(`    └─ Trigger: ${f.trigger.when} on ${f.trigger.table}`));
                }
            }
        }
        // Artifacts
        console.log(chalk_1.default.white('\n📁 Staged Artifacts:'));
        console.log(chalk_1.default.gray(`  • ${rendered.migrations.length} migrations`));
        console.log(chalk_1.default.gray(`  • ${rendered.functions.length} functions`));
        console.log(chalk_1.default.gray('─'.repeat(50)));
    }
    async savePlan(plan, name) {
        const plansDir = path.join(process.cwd(), 'plans');
        fs.mkdirSync(plansDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
        const fileName = `${timestamp}_${name || 'plan'}.yaml`;
        const filePath = path.join(plansDir, fileName);
        const yamlContent = yaml.dump(plan, {
            indent: 2,
            lineWidth: -1,
            noRefs: true
        });
        fs.writeFileSync(filePath, yamlContent);
        return filePath;
    }
    async loadPlan(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        return yaml.load(content);
    }
    async findMatchingTemplates(naturalLanguage) {
        try {
            // Get all available templates
            const templates = await this.templateManager.getTemplateIndex();
            // Simple keyword matching - could be enhanced with ML in the future
            const lowerQuery = naturalLanguage.toLowerCase();
            const keywords = lowerQuery.split(' ').filter(w => w.length > 3);
            const matches = templates.filter(template => {
                // Check name, description, and tags for matches
                const searchText = [
                    template.name,
                    template.display_name,
                    template.description,
                    ...(template.tags || [])
                ].join(' ').toLowerCase();
                // Count keyword matches
                const matchCount = keywords.filter(keyword => searchText.includes(keyword)).length;
                // Template matches if it has at least 1 relevant keyword
                return matchCount > 0;
            });
            // Sort by relevance (more matches = more relevant)
            matches.sort((a, b) => {
                const aMatches = keywords.filter(k => [a.name, a.display_name, a.description, ...(a.tags || [])].join(' ').toLowerCase().includes(k)).length;
                const bMatches = keywords.filter(k => [b.name, b.display_name, b.description, ...(b.tags || [])].join(' ').toLowerCase().includes(k)).length;
                return bMatches - aMatches;
            });
            // Add contents info from manifest (mock for now since we don't download)
            return matches.slice(0, 3).map(template => ({
                ...template,
                contents: this.getTemplateContents(template.name)
            }));
        }
        catch (error) {
            console.warn('Could not fetch template suggestions:', error.message);
            return [];
        }
    }
    getTemplateContents(templateName) {
        // Mock contents based on known templates - in production this would be fetched
        const knownContents = {
            'blog-basic': {
                tables: ['posts', 'comments'],
                policies: ['public_read', 'owner'],
                functions: ['notify_comment']
            },
            'ecommerce-basic': {
                tables: ['products', 'orders', 'order_items'],
                policies: ['public_read', 'owner'],
                functions: ['payment_webhook']
            }
        };
        return knownContents[templateName] || {};
    }
}
exports.Orchestrator = Orchestrator;
//# sourceMappingURL=orchestrate.js.map