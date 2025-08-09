import chalk from 'chalk';
import { ApplyService } from '../../../orchestrator/src/apply';

interface RollbackOptions {
  last?: boolean;
}

export async function rollbackCommand(options: RollbackOptions): Promise<void> {
  console.log(chalk.blue('🔄 KickStack: Rollback'));
  
  if (!options.last) {
    console.error(chalk.red('❌ Currently only --last rollback is supported'));
    console.log(chalk.gray('Usage: kickstack rollback --last'));
    process.exit(1);
  }
  
  const applyService = new ApplyService();
  
  try {
    console.log(chalk.yellow('⚠️  This will restore the database to the previous schema snapshot'));
    console.log(chalk.yellow('⚠️  All data changes since the last apply will be lost'));
    
    // In a real implementation, you might want to add a confirmation prompt
    console.log(chalk.gray('\nProceeding with rollback...'));
    
    await applyService.rollback();
    
    console.log(chalk.green('\n✅ Rollback completed successfully'));
    console.log(chalk.white('\n🔧 Recommended next steps:'));
    console.log(chalk.gray('  1. Restart PostgREST to reload schema: docker-compose restart postgrest'));
    console.log(chalk.gray('  2. Check your application functionality'));
    console.log(chalk.gray('  3. Review what went wrong with the previous deployment'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Rollback failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}