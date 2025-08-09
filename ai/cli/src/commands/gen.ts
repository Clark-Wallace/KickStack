import chalk from 'chalk';
import { Orchestrator } from '../../../orchestrator/src/orchestrate';
import * as path from 'path';

interface GenOptions {
  file?: string;
  name?: string;
}

export async function genCommand(
  requirement: string,
  options: GenOptions
): Promise<void> {
  console.log(chalk.blue('🎯 KickStack: AI Full-Stack Generation'));
  console.log(chalk.gray(`Requirement: ${requirement}`));
  
  const orchestrator = new Orchestrator();
  
  try {
    // Parse the natural language requirement
    const plan = await orchestrator.parseIntent(requirement);
    
    // Render the plan to artifacts
    const rendered = await orchestrator.renderPlan(plan);
    
    // Save the plan
    const planName = options.name || 'generated';
    const planPath = `${planName}.yaml`;
    orchestrator.savePlan(plan, planPath);
    
    // Print summary
    console.log(chalk.cyan('\n📋 Plan Summary:'));
    console.log(chalk.white(`   Tables: ${rendered.migrations.length}`));
    console.log(chalk.white(`   Functions: ${rendered.functions.length}`));
    
    console.log(chalk.white('\n💾 Plan saved to:'));
    console.log(chalk.cyan(`  ${planPath}`));
    
    console.log(chalk.white('\n📁 Artifacts staged (not applied yet):'));
    console.log(chalk.gray('  • Migrations in: infra/migrations/_staged/'));
    console.log(chalk.gray('  • Functions in: api/functions/_staged/'));
    
    console.log(chalk.white('\n🚀 Next steps:'));
    console.log(chalk.gray('  1. Review the plan and staged artifacts'));
    console.log(chalk.gray(`  2. Apply with: kickstack apply --file ${planPath}`));
    console.log(chalk.gray('  3. Or apply directly: kickstack apply --file --no-verify (skip verification)'));
    
    console.log(chalk.green('\n✅ Generation complete! No changes applied yet.'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Generation failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}