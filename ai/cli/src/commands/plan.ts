import chalk from 'chalk';
import { Orchestrator } from '../../../orchestrator/src/orchestrate';
import * as path from 'path';
import * as fs from 'fs';

interface PlanOptions {
  file: string;
}

export async function planCommand(options: PlanOptions): Promise<void> {
  console.log(chalk.blue('📋 KickStack: Plan Review'));
  
  const orchestrator = new Orchestrator();
  
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
    const plan = orchestrator.loadPlan(planPath);
    
    // Render the plan to artifacts
    const rendered = orchestrator.renderPlan(plan);
    
    // Print summary
    console.log(chalk.cyan('\n📋 Plan Summary:'));
    console.log(chalk.white(`   Version: ${plan.version}`));
    console.log(chalk.white(`   Summary: ${plan.summary}`));
    console.log(chalk.white(`   Tables: ${rendered.migrations.length}`));
    console.log(chalk.white(`   Functions: ${rendered.functions.length}`));
    
    console.log(chalk.white('\n📁 Artifacts staged:'));
    console.log(chalk.gray('  • Migrations in: infra/migrations/_staged/'));
    console.log(chalk.gray('  • Functions in: api/functions/_staged/'));
    
    console.log(chalk.white('\n🚀 Next steps:'));
    console.log(chalk.gray(`  1. Apply with: kickstack apply --file ${path.basename(planPath)}`));
    console.log(chalk.gray('  2. Or force apply: kickstack apply --file --force (overwrite existing)'));
    
    console.log(chalk.green('\n✅ Plan loaded and staged successfully!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Plan loading failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}