import chalk from 'chalk';
import { Orchestrator } from '../../../orchestrator/src/orchestrate';
import { ApplyService } from '../../../orchestrator/src/apply';
import { VerifyService } from '../../../orchestrator/src/verify';
import * as path from 'path';
import * as fs from 'fs';

interface ApplyOptions {
  file: string;
  force?: boolean;
  noVerify?: boolean;
}

export async function applyCommand(options: ApplyOptions): Promise<void> {
  console.log(chalk.blue('🚀 KickStack: Apply Plan'));
  
  const orchestrator = new Orchestrator();
  const applyService = new ApplyService();
  const verifyService = new VerifyService();
  
  try {
    // Resolve file path
    let planPath = options.file;
    if (!path.isAbsolute(planPath)) {
      // Try relative to plans directory first
      const plansPath = path.join(process.cwd(), 'plans', planPath);
      if (fs.existsSync(plansPath)) {
        planPath = plansPath;
      } else {
        // Try relative to current directory
        planPath = path.resolve(planPath);
      }
    }
    
    if (!fs.existsSync(planPath)) {
      throw new Error(`Plan file not found: ${planPath}`);
    }
    
    console.log(chalk.gray(`Loading plan: ${planPath}`));
    
    // Load the plan
    const plan = await orchestrator.loadPlan(planPath);
    
    console.log(chalk.cyan(`Applying: ${plan.summary}`));
    
    // Apply the plan
    const applyResult = await applyService.apply(plan, {
      force: options.force,
      noVerify: options.noVerify
    });
    
    if (!applyResult.success) {
      console.error(chalk.red('\n❌ Apply failed:'));
      applyResult.errors?.forEach(error => {
        console.error(chalk.red(`  • ${error}`));
      });
      
      console.log(chalk.yellow('\n💡 To rollback: kickstack rollback --last'));
      process.exit(1);
    }
    
    // Run verification unless disabled
    if (!options.noVerify) {
      console.log(''); // Add spacing
      const verifyResult = await verifyService.verify(plan);
      
      if (!verifyResult.success) {
        console.log(chalk.yellow('\n⚠️  Verification failed, but apply was successful'));
        console.log(chalk.yellow('You may want to investigate the failed checks'));
        console.log(chalk.yellow('To rollback: kickstack rollback --last'));
        process.exit(1);
      }
    }
    
    console.log(chalk.white('\n🎉 Deployment Complete!'));
    console.log(chalk.gray('─'.repeat(50)));
    
    // Show API endpoints
    const tables = plan.steps.filter(s => s.kind === 'table');
    if (tables.length > 0) {
      console.log(chalk.white('📡 API Endpoints:'));
      tables.forEach(table => {
        const t = table as any;
        console.log(chalk.gray(`  • GET/POST/PATCH/DELETE http://localhost:3000/${t.name}`));
      });
    }
    
    // Show functions
    const functions = plan.steps.filter(s => s.kind === 'function');
    if (functions.length > 0) {
      console.log(chalk.white('\n⚡ Edge Functions:'));
      functions.forEach(func => {
        const f = func as any;
        console.log(chalk.gray(`  • POST http://localhost:8787/fn/${f.name}`));
      });
    }
    
    console.log(chalk.white('\n🌐 Dashboard:'));
    console.log(chalk.gray('  • http://localhost:3001 (Web UI)'));
    
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('✅ All done! Your KickStack application is ready.'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Apply failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}