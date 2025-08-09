"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTableCommand = addTableCommand;
const chalk_1 = __importDefault(require("chalk"));
const adapters_1 = require("../adapters");
const database_1 = require("../services/database");
const migration_1 = require("../services/migration");
const trigger_generator_1 = require("../services/trigger-generator");
async function addTableCommand(description, options = { realtime: true }) {
    console.log(chalk_1.default.blue('🚀 KickStack: Creating table from description...'));
    console.log(chalk_1.default.gray(`Description: "${description}"`));
    // Initialize services
    const db = new database_1.DatabaseService();
    const migrationService = new migration_1.MigrationService();
    try {
        // Get AI model adapter
        const adapter = await adapters_1.ModelAdapterFactory.create();
        // Generate SQL from natural language
        console.log(chalk_1.default.yellow('🤖 Generating SQL schema...'));
        const tableSQL = await adapter.nlToCreateTable({ raw: description });
        console.log(chalk_1.default.gray('\nGenerated SQL:'));
        console.log(chalk_1.default.cyan(tableSQL.sql));
        // Check if table already exists
        console.log(chalk_1.default.yellow(`\n🔍 Checking if table '${tableSQL.tableName}' exists...`));
        const exists = await db.tableExists(tableSQL.tableName);
        if (exists) {
            console.error(chalk_1.default.red(`\n❌ Table '${tableSQL.tableName}' already exists!`));
            console.log(chalk_1.default.yellow('Please use a different table name or drop the existing table first.'));
            process.exit(1);
        }
        // Write migration file
        console.log(chalk_1.default.yellow('📝 Writing migration file...'));
        const migrationPath = await migrationService.writeMigration(tableSQL);
        console.log(chalk_1.default.green(`✓ Migration saved to: ${migrationPath}`));
        // Apply migration to database
        console.log(chalk_1.default.yellow('🗄️  Applying migration to database...'));
        await db.executeMigration(tableSQL.sql);
        console.log(chalk_1.default.green('✓ Migration applied successfully'));
        // Add realtime triggers if enabled
        if (options.realtime) {
            console.log(chalk_1.default.yellow('🔄 Adding realtime triggers...'));
            const triggersSql = trigger_generator_1.TriggerGenerator.generateTriggers(tableSQL.tableName);
            await db.executeMigration(triggersSql);
            console.log(chalk_1.default.green('✓ Realtime triggers added successfully'));
        }
        // Get and display table structure
        const columns = await db.getTableColumns(tableSQL.tableName);
        console.log(chalk_1.default.green('\n✨ Table created successfully!'));
        console.log(chalk_1.default.white('\n📊 Table Structure:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.cyan(`Table: ${tableSQL.tableName}`));
        console.log(chalk_1.default.gray('Columns:'));
        columns.forEach(col => {
            console.log(chalk_1.default.gray(`  • ${col}`));
        });
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // Display API endpoint information
        console.log(chalk_1.default.white('\n🔗 API Endpoints:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.green(`GET    http://localhost:3050/${tableSQL.tableName}`), chalk_1.default.gray('- List all records'));
        console.log(chalk_1.default.green(`POST   http://localhost:3050/${tableSQL.tableName}`), chalk_1.default.gray('- Create new record'));
        console.log(chalk_1.default.green(`GET    http://localhost:3050/${tableSQL.tableName}?id=eq.1`), chalk_1.default.gray('- Get by ID'));
        console.log(chalk_1.default.green(`PATCH  http://localhost:3050/${tableSQL.tableName}?id=eq.1`), chalk_1.default.gray('- Update record'));
        console.log(chalk_1.default.green(`DELETE http://localhost:3050/${tableSQL.tableName}?id=eq.1`), chalk_1.default.gray('- Delete record'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        if (options.realtime) {
            console.log(chalk_1.default.white('\n⚡ Realtime Status:'));
            console.log(chalk_1.default.gray('─'.repeat(50)));
            console.log(chalk_1.default.green('✓ Realtime triggers enabled'));
            console.log(chalk_1.default.gray('  Connect to: ws://localhost:8081?table=' + tableSQL.tableName));
            console.log(chalk_1.default.gray('─'.repeat(50)));
        }
        console.log(chalk_1.default.yellow('\n📝 Note: You may need to restart PostgREST container for changes to take effect:'));
        console.log(chalk_1.default.gray('  docker-compose -f infra/docker-compose.yml restart postgrest'));
        console.log(chalk_1.default.green('\n✅ Done! Your table is ready to use.'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ Error creating table:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
//# sourceMappingURL=add-table.js.map