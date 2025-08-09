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
exports.registerNewCommand = registerNewCommand;
const inquirer = __importStar(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ai_planner_1 = require("../../../orchestrator/src/ai-planner");
const plan_compiler_1 = require("../../../orchestrator/src/plan-compiler");
const manifest_1 = require("../../../orchestrator/src/manifest");
const database_1 = require("../services/database");
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
function registerNewCommand(program) {
    program
        .command('new')
        .description('Generate a complete backend system from natural language')
        .argument('[request]', 'Natural language description of your backend')
        .option('--name <name>', 'Project name')
        .option('--no-interactive', 'Skip interactive prompts')
        .option('--dry-run', 'Preview the plan without applying changes')
        .option('--template <template>', 'Use a template (saas, blog, chat, marketplace)')
        .action(async (request, options) => {
        const spinner = (0, ora_1.default)('Initializing KickStack AI');
        try {
            // Get project details
            let projectName = options.name;
            let nlRequest = request;
            if (!options.interactive === false) {
                spinner.stop();
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'projectName',
                        message: 'What would you like to name your project?',
                        default: 'my-backend',
                        when: !projectName
                    },
                    {
                        type: 'input',
                        name: 'request',
                        message: 'Describe your backend in natural language:',
                        when: !nlRequest,
                        validate: (input) => input.length > 10 || 'Please provide a meaningful description'
                    }
                ]);
                projectName = projectName || answers.projectName;
                nlRequest = nlRequest || answers.request;
            }
            if (!nlRequest && options.template) {
                // Use template description
                nlRequest = getTemplateDescription(options.template);
            }
            if (!nlRequest) {
                console.error(chalk_1.default.red('Error: Please provide a backend description'));
                process.exit(1);
            }
            // Initialize services
            spinner.start('Connecting to AI planner...');
            const planner = new ai_planner_1.AIPlanner();
            const compiler = new plan_compiler_1.PlanCompiler();
            const manifestManager = new manifest_1.ManifestManager();
            const db = new database_1.DatabaseService();
            // Create new manifest
            spinner.text = 'Creating project manifest...';
            const manifest = await manifestManager.create(projectName || 'my-backend');
            // Generate plan
            spinner.text = 'AI is planning your backend architecture...';
            console.log(chalk_1.default.gray(`\n📝 Request: "${nlRequest}"\n`));
            const plan = await planner.generatePlanWithFallback(nlRequest, manifest);
            // Display plan summary
            spinner.succeed('AI plan generated successfully');
            console.log(chalk_1.default.cyan('\n📋 Plan Summary:'));
            console.log(chalk_1.default.white(`   ${plan.summary}\n`));
            if (plan.steps.length > 0) {
                console.log(chalk_1.default.cyan('📦 Components to create:'));
                const tableSteps = plan.steps.filter(s => s.kind === 'table');
                const functionSteps = plan.steps.filter(s => s.kind === 'function');
                const policySteps = plan.steps.filter(s => s.kind === 'policy');
                if (tableSteps.length > 0) {
                    console.log(chalk_1.default.white(`   • ${tableSteps.length} tables: ${tableSteps.map(s => s.name).join(', ')}`));
                }
                if (policySteps.length > 0) {
                    console.log(chalk_1.default.white(`   • ${policySteps.length} security policies`));
                }
                if (functionSteps.length > 0) {
                    console.log(chalk_1.default.white(`   • ${functionSteps.length} edge functions: ${functionSteps.map(s => s.function?.name).join(', ')}`));
                }
                if (plan.sdk?.generate) {
                    console.log(chalk_1.default.white(`   • TypeScript SDK with ${plan.sdk.framework} hooks`));
                }
            }
            if (plan.safety?.warnings && plan.safety.warnings.length > 0) {
                console.log(chalk_1.default.yellow('\n⚠️  Warnings:'));
                plan.safety.warnings.forEach(w => console.log(chalk_1.default.yellow(`   • ${w}`)));
            }
            // Ask for confirmation
            if (!options.dryRun && !options.interactive === false) {
                const { proceed } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'proceed',
                        message: 'Apply this plan to your database?',
                        default: true
                    }]);
                if (!proceed) {
                    console.log(chalk_1.default.gray('Plan cancelled'));
                    return;
                }
            }
            if (options.dryRun) {
                console.log(chalk_1.default.gray('\n(Dry run - no changes applied)'));
                return;
            }
            // Compile and apply
            spinner.start('Compiling plan to SQL and code...');
            const compileResult = await compiler.compile(plan);
            // Apply migrations
            spinner.text = 'Applying database migrations...';
            for (const migration of compileResult.migrations) {
                await db.runQuery(migration.content);
                console.log(chalk_1.default.green(`   ✓ Applied: ${migration.filename}`));
            }
            // Write functions
            if (compileResult.functions.length > 0) {
                spinner.text = 'Creating edge functions...';
                for (const func of compileResult.functions) {
                    const funcPath = path.join(process.cwd(), func.path);
                    const funcDir = path.dirname(funcPath);
                    if (!fs.existsSync(funcDir)) {
                        fs.mkdirSync(funcDir, { recursive: true });
                    }
                    fs.writeFileSync(funcPath, func.content);
                    console.log(chalk_1.default.green(`   ✓ Created: ${func.path}`));
                }
            }
            // Generate SDK
            if (compileResult.sdkFiles && compileResult.sdkFiles.length > 0) {
                spinner.text = 'Generating TypeScript SDK...';
                for (const file of compileResult.sdkFiles) {
                    const sdkPath = path.join(process.cwd(), file.path);
                    const sdkDir = path.dirname(sdkPath);
                    if (!fs.existsSync(sdkDir)) {
                        fs.mkdirSync(sdkDir, { recursive: true });
                    }
                    fs.writeFileSync(sdkPath, file.content);
                    console.log(chalk_1.default.green(`   ✓ Generated: ${file.path}`));
                }
            }
            // Write tests
            if (compileResult.tests && compileResult.tests.length > 0) {
                spinner.text = 'Creating test suite...';
                for (const test of compileResult.tests) {
                    const testPath = path.join(process.cwd(), test.path);
                    const testDir = path.dirname(testPath);
                    if (!fs.existsSync(testDir)) {
                        fs.mkdirSync(testDir, { recursive: true });
                    }
                    fs.writeFileSync(testPath, test.content);
                    console.log(chalk_1.default.green(`   ✓ Created: ${test.path}`));
                }
            }
            // Update manifest with plan results
            spinner.text = 'Updating project manifest...';
            // Add tables to manifest
            for (const step of plan.steps) {
                if (step.kind === 'table' && step.columns) {
                    await manifestManager.addTable({
                        name: step.name || 'unnamed',
                        columns: step.columns.map(col => ({
                            name: col.name,
                            type: col.type,
                            pk: col.pk,
                            nullable: col.nullable,
                            default: col.default,
                            unique: col.unique,
                            references: col.references
                        })),
                        constraints: step.constraints?.map(c => c.sql),
                        rlsEnabled: step.rls?.enable || false,
                        createdAt: new Date().toISOString(),
                        lastModified: new Date().toISOString()
                    });
                }
            }
            // Record change event
            await manifestManager.recordChange({
                timestamp: new Date().toISOString(),
                type: 'create',
                prompt: nlRequest,
                summary: plan.summary,
                changes: plan.steps.map(s => `${s.kind}: ${s.name || 'unnamed'}`)
            });
            // Reload PostgREST schema
            spinner.text = 'Reloading API schema...';
            try {
                (0, child_process_1.execSync)('npm run kickstack reload-schema', { stdio: 'ignore' });
            }
            catch (e) {
                // Schema reload is optional
            }
            spinner.succeed('Backend generated successfully!');
            // Next steps
            console.log(chalk_1.default.cyan('\n🚀 Next Steps:'));
            console.log(chalk_1.default.white('   1. Review generated files in your project'));
            console.log(chalk_1.default.white('   2. Test your API: curl http://localhost:3050/<table>'));
            if (plan.sdk?.generate) {
                console.log(chalk_1.default.white('   3. Use the generated SDK in /sdk/'));
            }
            console.log(chalk_1.default.white(`   4. Evolve your backend: kickstack evolve "add feature..."`));
            // Show API examples
            const tables = plan.steps.filter(s => s.kind === 'table').map(s => s.name);
            if (tables.length > 0) {
                console.log(chalk_1.default.cyan('\n📡 API Endpoints:'));
                tables.forEach(table => {
                    console.log(chalk_1.default.gray(`   GET    http://localhost:3050/${table}`));
                    console.log(chalk_1.default.gray(`   POST   http://localhost:3050/${table}`));
                    console.log(chalk_1.default.gray(`   PATCH  http://localhost:3050/${table}?id=eq.<id>`));
                    console.log(chalk_1.default.gray(`   DELETE http://localhost:3050/${table}?id=eq.<id>\n`));
                });
            }
        }
        catch (error) {
            spinner.fail('Failed to generate backend');
            console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
            // Provide helpful suggestions
            if (error instanceof Error) {
                if (error.message.includes('OPENAI_API_KEY')) {
                    console.log(chalk_1.default.yellow('\n💡 Set your OpenAI API key:'));
                    console.log(chalk_1.default.gray('   export OPENAI_API_KEY="sk-..."'));
                }
                else if (error.message.includes('database')) {
                    console.log(chalk_1.default.yellow('\n💡 Make sure PostgreSQL is running:'));
                    console.log(chalk_1.default.gray('   cd infra && docker-compose up -d'));
                }
            }
            process.exit(1);
        }
    });
}
function getTemplateDescription(template) {
    const templates = {
        'saas': 'Multi-tenant SaaS backend with organizations, users, projects, billing, and team invites',
        'blog': 'Blog platform with posts, comments, categories, tags, and author profiles',
        'chat': 'Real-time chat application with rooms, messages, reactions, and user presence',
        'marketplace': 'Marketplace with products, sellers, buyers, orders, reviews, and payments',
        'social': 'Social network with profiles, posts, follows, likes, comments, and notifications',
        'crm': 'CRM system with contacts, companies, deals, activities, and pipeline management',
        'ecommerce': 'E-commerce backend with products, cart, checkout, orders, inventory, and shipping'
    };
    return templates[template] || `Create a ${template} application`;
}
//# sourceMappingURL=new.js.map