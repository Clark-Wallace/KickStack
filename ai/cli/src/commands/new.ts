import { Command } from 'commander';
import * as inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { AIPlanner } from '../../../orchestrator/src/ai-planner';
import { PlanCompiler } from '../../../orchestrator/src/plan-compiler';
import { ManifestManager } from '../../../orchestrator/src/manifest';
import { DatabaseService } from '../services/database';
import { execSync } from 'child_process';
import chalk from 'chalk';

export function registerNewCommand(program: Command) {
  program
    .command('new')
    .description('Generate a complete backend system from natural language')
    .argument('[request]', 'Natural language description of your backend')
    .option('--name <name>', 'Project name')
    .option('--no-interactive', 'Skip interactive prompts')
    .option('--dry-run', 'Preview the plan without applying changes')
    .option('--template <template>', 'Use a template (saas, blog, chat, marketplace)')
    .action(async (request: string | undefined, options) => {
      const spinner = ora('Initializing KickStack AI');
      
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
          console.error(chalk.red('Error: Please provide a backend description'));
          process.exit(1);
        }
        
        // Initialize services
        spinner.start('Connecting to AI planner...');
        const planner = new AIPlanner();
        const compiler = new PlanCompiler();
        const manifestManager = new ManifestManager();
        const db = new DatabaseService();
        
        // Create new manifest
        spinner.text = 'Creating project manifest...';
        const manifest = await manifestManager.create(projectName || 'my-backend');
        
        // Generate plan
        spinner.text = 'AI is planning your backend architecture...';
        console.log(chalk.gray(`\n📝 Request: "${nlRequest}"\n`));
        
        const plan = await planner.generatePlanWithFallback(nlRequest, manifest);
        
        // Display plan summary
        spinner.succeed('AI plan generated successfully');
        console.log(chalk.cyan('\n📋 Plan Summary:'));
        console.log(chalk.white(`   ${plan.summary}\n`));
        
        if (plan.steps.length > 0) {
          console.log(chalk.cyan('📦 Components to create:'));
          const tableSteps = plan.steps.filter(s => s.kind === 'table');
          const functionSteps = plan.steps.filter(s => s.kind === 'function');
          const policySteps = plan.steps.filter(s => s.kind === 'policy');
          
          if (tableSteps.length > 0) {
            console.log(chalk.white(`   • ${tableSteps.length} tables: ${tableSteps.map(s => s.name).join(', ')}`));
          }
          if (policySteps.length > 0) {
            console.log(chalk.white(`   • ${policySteps.length} security policies`));
          }
          if (functionSteps.length > 0) {
            console.log(chalk.white(`   • ${functionSteps.length} edge functions: ${functionSteps.map(s => s.function?.name).join(', ')}`));
          }
          
          if (plan.sdk?.generate) {
            console.log(chalk.white(`   • TypeScript SDK with ${plan.sdk.framework} hooks`));
          }
        }
        
        if (plan.safety?.warnings && plan.safety.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          plan.safety.warnings.forEach(w => console.log(chalk.yellow(`   • ${w}`)));
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
            console.log(chalk.gray('Plan cancelled'));
            return;
          }
        }
        
        if (options.dryRun) {
          console.log(chalk.gray('\n(Dry run - no changes applied)'));
          return;
        }
        
        // Compile and apply
        spinner.start('Compiling plan to SQL and code...');
        const compileResult = await compiler.compile(plan);
        
        // Apply migrations
        spinner.text = 'Applying database migrations...';
        for (const migration of compileResult.migrations) {
          await db.runQuery(migration.content);
          console.log(chalk.green(`   ✓ Applied: ${migration.filename}`));
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
            console.log(chalk.green(`   ✓ Created: ${func.path}`));
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
            console.log(chalk.green(`   ✓ Generated: ${file.path}`));
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
            console.log(chalk.green(`   ✓ Created: ${test.path}`));
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
          execSync('npm run kickstack reload-schema', { stdio: 'ignore' });
        } catch (e) {
          // Schema reload is optional
        }
        
        spinner.succeed('Backend generated successfully!');
        
        // Next steps
        console.log(chalk.cyan('\n🚀 Next Steps:'));
        console.log(chalk.white('   1. Review generated files in your project'));
        console.log(chalk.white('   2. Test your API: curl http://localhost:3050/<table>'));
        if (plan.sdk?.generate) {
          console.log(chalk.white('   3. Use the generated SDK in /sdk/'));
        }
        console.log(chalk.white(`   4. Evolve your backend: kickstack evolve "add feature..."`));
        
        // Show API examples
        const tables = plan.steps.filter(s => s.kind === 'table').map(s => s.name);
        if (tables.length > 0) {
          console.log(chalk.cyan('\n📡 API Endpoints:'));
          tables.forEach(table => {
            console.log(chalk.gray(`   GET    http://localhost:3050/${table}`));
            console.log(chalk.gray(`   POST   http://localhost:3050/${table}`));
            console.log(chalk.gray(`   PATCH  http://localhost:3050/${table}?id=eq.<id>`));
            console.log(chalk.gray(`   DELETE http://localhost:3050/${table}?id=eq.<id>\n`));
          });
        }
        
      } catch (error) {
        spinner.fail('Failed to generate backend');
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        
        // Provide helpful suggestions
        if (error instanceof Error) {
          if (error.message.includes('OPENAI_API_KEY')) {
            console.log(chalk.yellow('\n💡 Set your OpenAI API key:'));
            console.log(chalk.gray('   export OPENAI_API_KEY="sk-..."'));
          } else if (error.message.includes('database')) {
            console.log(chalk.yellow('\n💡 Make sure PostgreSQL is running:'));
            console.log(chalk.gray('   cd infra && docker-compose up -d'));
          }
        }
        
        process.exit(1);
      }
    });
}

function getTemplateDescription(template: string): string {
  const templates: Record<string, string> = {
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