import chalk from 'chalk';
import { ModelAdapterFactory } from '../adapters';
import { DatabaseService } from '../services/database';
import { MigrationService } from '../services/migration';
import { TriggerGenerator } from '../services/trigger-generator';
import { NLTableSpec } from '../types';

interface AddTableOptions {
  realtime: boolean;
}

export async function addTableCommand(description: string, options: AddTableOptions = { realtime: true }): Promise<void> {
  console.log(chalk.blue('🚀 KickStack: Creating table from description...'));
  console.log(chalk.gray(`Description: "${description}"`));
  
  // Initialize services
  const db = new DatabaseService();
  const migrationService = new MigrationService();
  
  try {
    // Get AI model adapter
    const adapter = await ModelAdapterFactory.create();
    
    // Generate SQL from natural language
    console.log(chalk.yellow('🤖 Generating SQL schema...'));
    const tableSQL = await adapter.nlToCreateTable({ raw: description });
    
    console.log(chalk.gray('\nGenerated SQL:'));
    console.log(chalk.cyan(tableSQL.sql));
    
    // Check if table already exists
    console.log(chalk.yellow(`\n🔍 Checking if table '${tableSQL.tableName}' exists...`));
    const exists = await db.tableExists(tableSQL.tableName);
    
    if (exists) {
      console.error(chalk.red(`\n❌ Table '${tableSQL.tableName}' already exists!`));
      console.log(chalk.yellow('Please use a different table name or drop the existing table first.'));
      process.exit(1);
    }
    
    // Write migration file
    console.log(chalk.yellow('📝 Writing migration file...'));
    const migrationPath = await migrationService.writeMigration(tableSQL);
    console.log(chalk.green(`✓ Migration saved to: ${migrationPath}`));
    
    // Apply migration to database
    console.log(chalk.yellow('🗄️  Applying migration to database...'));
    await db.executeMigration(tableSQL.sql);
    console.log(chalk.green('✓ Migration applied successfully'));
    
    // Add realtime triggers if enabled
    if (options.realtime) {
      console.log(chalk.yellow('🔄 Adding realtime triggers...'));
      const triggersSql = TriggerGenerator.generateTriggers(tableSQL.tableName);
      await db.executeMigration(triggersSql);
      console.log(chalk.green('✓ Realtime triggers added successfully'));
    }
    
    // Get and display table structure
    const columns = await db.getTableColumns(tableSQL.tableName);
    
    console.log(chalk.green('\n✨ Table created successfully!'));
    console.log(chalk.white('\n📊 Table Structure:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.cyan(`Table: ${tableSQL.tableName}`));
    console.log(chalk.gray('Columns:'));
    columns.forEach(col => {
      console.log(chalk.gray(`  • ${col}`));
    });
    console.log(chalk.gray('─'.repeat(50)));
    
    // Display API endpoint information
    console.log(chalk.white('\n🔗 API Endpoints:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green(`GET    http://localhost:3000/${tableSQL.tableName}`), chalk.gray('- List all records'));
    console.log(chalk.green(`POST   http://localhost:3000/${tableSQL.tableName}`), chalk.gray('- Create new record'));
    console.log(chalk.green(`GET    http://localhost:3000/${tableSQL.tableName}?id=eq.1`), chalk.gray('- Get by ID'));
    console.log(chalk.green(`PATCH  http://localhost:3000/${tableSQL.tableName}?id=eq.1`), chalk.gray('- Update record'));
    console.log(chalk.green(`DELETE http://localhost:3000/${tableSQL.tableName}?id=eq.1`), chalk.gray('- Delete record'));
    console.log(chalk.gray('─'.repeat(50)));
    
    if (options.realtime) {
      console.log(chalk.white('\n⚡ Realtime Status:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.green('✓ Realtime triggers enabled'));
      console.log(chalk.gray('  Connect to: ws://localhost:8081?table=' + tableSQL.tableName));
      console.log(chalk.gray('─'.repeat(50)));
    }
    
    console.log(chalk.yellow('\n📝 Note: You may need to restart PostgREST container for changes to take effect:'));
    console.log(chalk.gray('  docker-compose -f infra/docker-compose.yml restart postgrest'));
    
    console.log(chalk.green('\n✅ Done! Your table is ready to use.'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error creating table:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}