import chalk from 'chalk';
import { DatabaseService } from '../services/database';
import { MigrationService } from '../services/migration';
import { TriggerGenerator } from '../services/trigger-generator';

export async function addRealtimeCommand(tableName: string): Promise<void> {
  console.log(chalk.blue('🚀 KickStack: Adding realtime triggers...'));
  console.log(chalk.gray(`Table: "${tableName}"`));
  
  const db = new DatabaseService();
  const migrationService = new MigrationService();
  
  try {
    // Check if table exists
    console.log(chalk.yellow(`🔍 Checking if table '${tableName}' exists...`));
    const exists = await db.tableExists(tableName);
    
    if (!exists) {
      console.error(chalk.red(`❌ Table '${tableName}' does not exist!`));
      console.log(chalk.yellow('Please create the table first using:'));
      console.log(chalk.gray(`  kickstack add-table "${tableName} with ..."`));
      process.exit(1);
    }
    
    // Generate triggers SQL
    console.log(chalk.yellow('🤖 Generating realtime triggers...'));
    const triggersSql = TriggerGenerator.generateTriggers(tableName);
    
    console.log(chalk.gray('\nGenerated SQL:'));
    console.log(chalk.cyan(triggersSql));
    
    // Write migration file
    console.log(chalk.yellow('📝 Writing migration file...'));
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
    const migrationPath = await migrationService.writeMigration({
      tableName: `realtime_triggers_${tableName}`,
      sql: triggersSql
    });
    console.log(chalk.green(`✓ Migration saved to: ${migrationPath}`));
    
    // Apply migration to database
    console.log(chalk.yellow('🗄️  Applying triggers to database...'));
    await db.executeMigration(triggersSql);
    console.log(chalk.green('✓ Triggers created successfully'));
    
    // Verify triggers exist
    const triggers = await db.getTriggers(tableName);
    
    console.log(chalk.green('\n✨ Realtime enabled successfully!'));
    console.log(chalk.white('\n📊 Created Triggers:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.cyan(`Table: ${tableName}`));
    console.log(chalk.gray('Triggers:'));
    triggers.forEach(trigger => {
      console.log(chalk.gray(`  • ${trigger}`));
    });
    console.log(chalk.gray('─'.repeat(50)));
    
    // Display usage information
    console.log(chalk.white('\n🔗 Realtime Usage:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('1. Start realtime service:'));
    console.log(chalk.gray('   npm run realtime:dev'));
    console.log(chalk.green('2. Connect WebSocket client:'));
    console.log(chalk.gray(`   ws://localhost:8081?table=${tableName}`));
    console.log(chalk.green('3. Changes will broadcast automatically'));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.yellow('\n📝 Note: Ensure kickstack_changes table exists:'));
    console.log(chalk.gray('  Apply migration: infra/migrations/00000000_0000_kickstack_changes.sql'));
    
    console.log(chalk.green('\n✅ Done! Table is now realtime-enabled.'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error adding realtime:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}