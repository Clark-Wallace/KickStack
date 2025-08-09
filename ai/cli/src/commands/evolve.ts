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

export function registerEvolveCommand(program: Command) {
  program
    .command('evolve')
    .description('Evolve your backend with AI-powered changes')
    .argument('[request]', 'Natural language description of changes')
    .option('--no-interactive', 'Skip interactive prompts')
    .option('--dry-run', 'Preview changes without applying')
    .option('--rollback', 'Rollback to previous version')
    .option('--history', 'Show evolution history')
    .action(async (request: string | undefined, options) => {
      const spinner = ora('Loading project manifest');
      
      try {
        // Check for manifest
        const manifestManager = new ManifestManager();
        
        if (!manifestManager.exists()) {
          spinner.fail('No KickStack project found');
          console.log(chalk.yellow('\n💡 Initialize a project first:'));
          console.log(chalk.gray('   kickstack new "your backend description"'));
          process.exit(1);
        }
        
        spinner.text = 'Loading project state...';
        const manifest = await manifestManager.load();
        
        if (!manifest) {
          throw new Error('Failed to load project manifest');
        }
        
        // Show history if requested
        if (options.history) {
          spinner.stop();
          showHistory(manifest);
          return;
        }
        
        // Handle rollback
        if (options.rollback) {
          spinner.stop();
          await handleRollback(manifest, manifestManager);
          return;
        }
        
        // Get evolution request
        let nlRequest = request;
        
        if (!nlRequest && !options.interactive === false) {
          spinner.stop();
          
          // Show current state
          console.log(chalk.cyan('\n📊 Current Backend:'));
          console.log(chalk.white(`   Project: ${manifest.projectName}`));
          console.log(chalk.white(`   Tables: ${manifest.schema.tables.map(t => t.name).join(', ') || 'none'}`));
          console.log(chalk.white(`   Functions: ${manifest.schema.functions.map(f => f.name).join(', ') || 'none'}`));
          
          const { request: userRequest } = await inquirer.prompt([{
            type: 'input',
            name: 'request',
            message: 'What would you like to change or add?',
            validate: (input) => input.length > 10 || 'Please describe the changes you want'
          }]);
          
          nlRequest = userRequest;
        }
        
        if (!nlRequest) {
          console.error(chalk.red('Error: Please provide a change description'));
          process.exit(1);
        }
        
        // Initialize services
        spinner.start('Analyzing requested changes...');
        const planner = new AIPlanner();
        const compiler = new PlanCompiler();
        const db = new DatabaseService();
        
        // Generate evolution plan
        spinner.text = 'AI is planning your changes...';
        console.log(chalk.gray(`\n📝 Evolution request: "${nlRequest}"\n`));
        
        const plan = await planner.generatePlanWithFallback(nlRequest, manifest);
        
        // Display plan
        spinner.succeed('Evolution plan generated');
        console.log(chalk.cyan('\n📋 Changes Summary:'));
        console.log(chalk.white(`   ${plan.summary}\n`));
        
        // Show what will change
        const additions = plan.steps.filter(s => s.ifNotExists);
        const modifications = plan.steps.filter(s => !s.ifNotExists);
        
        if (additions.length > 0) {
          console.log(chalk.green('➕ Additions:'));
          additions.forEach(step => {
            if (step.kind === 'table') {
              console.log(chalk.green(`   • New table: ${step.name}`));
            } else if (step.kind === 'function') {
              console.log(chalk.green(`   • New function: ${step.function?.name}`));
            } else if (step.kind === 'policy') {
              console.log(chalk.green(`   • New policy on ${step.name}`));
            }
          });
        }
        
        if (modifications.length > 0) {
          console.log(chalk.yellow('✏️  Modifications:'));
          modifications.forEach(step => {
            if (step.kind === 'table') {
              console.log(chalk.yellow(`   • Modify table: ${step.name}`));
            } else if (step.kind === 'function') {
              console.log(chalk.yellow(`   • Update function: ${step.function?.name}`));
            }
          });
        }
        
        // Show warnings
        if (plan.safety?.breaking) {
          console.log(chalk.red('\n⚠️  BREAKING CHANGES DETECTED:'));
          plan.safety.warnings?.forEach(w => console.log(chalk.red(`   • ${w}`)));
          
          if (!options.interactive === false) {
            const { confirmBreaking } = await inquirer.prompt([{
              type: 'confirm',
              name: 'confirmBreaking',
              message: 'These changes may break existing code. Continue?',
              default: false
            }]);
            
            if (!confirmBreaking) {
              console.log(chalk.gray('Evolution cancelled'));
              return;
            }
          }
        } else if (plan.safety?.warnings && plan.safety.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          plan.safety.warnings.forEach(w => console.log(chalk.yellow(`   • ${w}`)));
        }
        
        // Confirmation
        if (!options.dryRun && !options.interactive === false) {
          const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Apply these changes?',
            default: true
          }]);
          
          if (!proceed) {
            console.log(chalk.gray('Evolution cancelled'));
            return;
          }
        }
        
        if (options.dryRun) {
          console.log(chalk.gray('\n(Dry run - no changes applied)'));
          
          // Show SQL preview
          console.log(chalk.cyan('\n📄 SQL Preview:'));
          const result = await compiler.compile(plan);
          result.migrations.forEach(m => {
            console.log(chalk.gray(`\n-- ${m.filename}`));
            console.log(chalk.gray(m.content.split('\n').map(l => '   ' + l).join('\n')));
          });
          
          return;
        }
        
        // Create backup point
        spinner.start('Creating backup point...');
        const backupPath = path.join(process.cwd(), '.kickstack', 'backups', `${Date.now()}.json`);
        const backupDir = path.dirname(backupPath);
        
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        fs.writeFileSync(backupPath, JSON.stringify(manifest, null, 2));
        
        // Compile and apply
        spinner.text = 'Compiling changes...';
        const compileResult = await compiler.compile(plan);
        
        // Apply migrations
        if (compileResult.migrations.length > 0) {
          spinner.text = 'Applying database changes...';
          
          try {
            for (const migration of compileResult.migrations) {
              await db.runQuery(migration.content);
              console.log(chalk.green(`   ✓ Applied: ${migration.filename}`));
            }
          } catch (error) {
            spinner.fail('Migration failed');
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
            
            console.log(chalk.yellow('\n💡 You can rollback to the previous version:'));
            console.log(chalk.gray('   kickstack evolve --rollback'));
            
            process.exit(1);
          }
        }
        
        // Write functions
        if (compileResult.functions.length > 0) {
          spinner.text = 'Updating functions...';
          for (const func of compileResult.functions) {
            const funcPath = path.join(process.cwd(), func.path);
            const funcDir = path.dirname(funcPath);
            
            if (!fs.existsSync(funcDir)) {
              fs.mkdirSync(funcDir, { recursive: true });
            }
            
            fs.writeFileSync(funcPath, func.content);
            console.log(chalk.green(`   ✓ Updated: ${func.path}`));
          }
        }
        
        // Update SDK if needed
        if (compileResult.sdkFiles && compileResult.sdkFiles.length > 0) {
          spinner.text = 'Regenerating SDK...';
          for (const file of compileResult.sdkFiles) {
            const sdkPath = path.join(process.cwd(), file.path);
            const sdkDir = path.dirname(sdkPath);
            
            if (!fs.existsSync(sdkDir)) {
              fs.mkdirSync(sdkDir, { recursive: true });
            }
            
            fs.writeFileSync(sdkPath, file.content);
            console.log(chalk.green(`   ✓ Regenerated: ${file.path}`));
          }
        }
        
        // Update manifest
        spinner.text = 'Updating project manifest...';
        
        // Apply changes to manifest
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
          } else if (step.kind === 'policy' && step.policy) {
            await manifestManager.addPolicy({
              table: step.name || '',
              preset: step.policy.preset,
              ownerCol: step.policy.owner_col,
              orgCol: step.policy.org_col,
              createdAt: new Date().toISOString()
            });
          } else if (step.kind === 'function' && step.function) {
            await manifestManager.addFunction({
              name: step.function.name,
              runtime: step.function.runtime as 'edge' | 'node',
              path: step.function.path,
              triggers: step.function.triggers?.map(t => ({
                table: t.table,
                when: t.when as any
              })),
              env: step.function.env,
              signature: step.function.signature,
              createdAt: new Date().toISOString()
            });
          }
        }
        
        // Record evolution
        await manifestManager.recordChange({
          timestamp: new Date().toISOString(),
          type: 'evolve',
          prompt: nlRequest,
          summary: plan.summary,
          changes: plan.steps.map(s => `${s.kind}: ${s.name || s.function?.name || 'unnamed'}`)
        });
        
        // Reload schema
        spinner.text = 'Reloading API schema...';
        try {
          execSync('npm run kickstack reload-schema', { stdio: 'ignore' });
        } catch (e) {
          // Optional
        }
        
        spinner.succeed('Backend evolved successfully!');
        
        // Show what's new
        console.log(chalk.cyan('\n✨ Evolution Complete:'));
        const newManifest = await manifestManager.load();
        if (newManifest) {
          const newTables = newManifest.schema.tables.filter(t => 
            !manifest.schema.tables.find(old => old.name === t.name)
          );
          const newFunctions = newManifest.schema.functions.filter(f => 
            !manifest.schema.functions.find(old => old.name === f.name)
          );
          
          if (newTables.length > 0) {
            console.log(chalk.white(`   New tables: ${newTables.map(t => t.name).join(', ')}`));
          }
          if (newFunctions.length > 0) {
            console.log(chalk.white(`   New functions: ${newFunctions.map(f => f.name).join(', ')}`));
          }
        }
        
        console.log(chalk.cyan('\n🎯 What\'s Next:'));
        console.log(chalk.white('   • Test your changes: npm run test'));
        console.log(chalk.white('   • View history: kickstack evolve --history'));
        console.log(chalk.white('   • Continue evolving: kickstack evolve "add more features..."'));
        
      } catch (error) {
        spinner.fail('Evolution failed');
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        
        if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
          console.log(chalk.yellow('\n💡 Using fallback templates. For better AI:'));
          console.log(chalk.gray('   export OPENAI_API_KEY="sk-..."'));
        }
        
        process.exit(1);
      }
    });
}

function showHistory(manifest: any) {
  console.log(chalk.cyan('\n📜 Evolution History:\n'));
  
  if (!manifest.history || manifest.history.length === 0) {
    console.log(chalk.gray('   No evolution history yet'));
    return;
  }
  
  manifest.history.slice(-10).forEach((event: any, index: number) => {
    const date = new Date(event.timestamp);
    const timeAgo = getTimeAgo(date);
    
    console.log(chalk.white(`${index + 1}. ${event.type.toUpperCase()} - ${timeAgo}`));
    console.log(chalk.gray(`   Prompt: "${event.prompt}"`));
    console.log(chalk.gray(`   Summary: ${event.summary}`));
    
    if (event.changes && event.changes.length > 0) {
      console.log(chalk.gray(`   Changes: ${event.changes.slice(0, 3).join(', ')}${event.changes.length > 3 ? '...' : ''}`));
    }
    console.log();
  });
}

async function handleRollback(manifest: any, manifestManager: ManifestManager) {
  // Find latest backup
  const backupDir = path.join(process.cwd(), '.kickstack', 'backups');
  
  if (!fs.existsSync(backupDir)) {
    console.log(chalk.yellow('No backups found'));
    return;
  }
  
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    console.log(chalk.yellow('No backups found'));
    return;
  }
  
  // Show available backups
  console.log(chalk.cyan('\n📦 Available Backups:\n'));
  
  const choices = backups.slice(0, 5).map((backup, index) => {
    const timestamp = parseInt(backup.replace('.json', ''));
    const date = new Date(timestamp);
    const timeAgo = getTimeAgo(date);
    
    return {
      name: `${index + 1}. ${date.toLocaleString()} (${timeAgo})`,
      value: backup
    };
  });
  
  const { selectedBackup } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedBackup',
    message: 'Select backup to restore:',
    choices
  }]);
  
  // Load and restore backup
  const backupPath = path.join(backupDir, selectedBackup);
  const backupContent = fs.readFileSync(backupPath, 'utf8');
  const backupManifest = JSON.parse(backupContent);
  
  // Confirm
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Restore to ${backupManifest.projectName} (${backupManifest.schema.tables.length} tables)?`,
    default: false
  }]);
  
  if (!confirm) {
    console.log(chalk.gray('Rollback cancelled'));
    return;
  }
  
  // Restore
  await manifestManager.save(backupManifest);
  
  console.log(chalk.green('✓ Rolled back successfully'));
  console.log(chalk.yellow('\n⚠️  Note: This only restored the manifest.'));
  console.log(chalk.yellow('   Database changes were not reverted.'));
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}