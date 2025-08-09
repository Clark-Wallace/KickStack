import { DatabaseService } from '../services/database';
import chalk from 'chalk';
import { execSync } from 'child_process';

export async function reloadSchemaCommand(): Promise<void> {
  console.log(chalk.cyan('🔄 Reloading PostgREST schema cache...'));
  
  try {
    // Try database NOTIFY first
    const db = new DatabaseService();
    await db.runQuery('NOTIFY pgrst, \'reload schema\';');
    console.log(chalk.green('✓ Schema reload triggered via NOTIFY'));
  } catch (error) {
    // Fallback to script
    try {
      execSync('./scripts/reload-postgrest.sh', { stdio: 'inherit' });
      console.log(chalk.green('✓ Schema reloaded via service restart'));
    } catch (scriptError) {
      console.error(chalk.yellow('⚠️  Could not reload schema automatically'));
      console.log(chalk.gray('   You may need to restart PostgREST manually'));
    }
  }
}