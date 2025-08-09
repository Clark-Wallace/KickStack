"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addRealtimeCommand = addRealtimeCommand;
const chalk_1 = __importDefault(require("chalk"));
const database_1 = require("../services/database");
const migration_1 = require("../services/migration");
const trigger_generator_1 = require("../services/trigger-generator");
async function addRealtimeCommand(tableName) {
    console.log(chalk_1.default.blue('🚀 KickStack: Adding realtime triggers...'));
    console.log(chalk_1.default.gray(`Table: "${tableName}"`));
    const db = new database_1.DatabaseService();
    const migrationService = new migration_1.MigrationService();
    try {
        // Check if table exists
        console.log(chalk_1.default.yellow(`🔍 Checking if table '${tableName}' exists...`));
        const exists = await db.tableExists(tableName);
        if (!exists) {
            console.error(chalk_1.default.red(`❌ Table '${tableName}' does not exist!`));
            console.log(chalk_1.default.yellow('Please create the table first using:'));
            console.log(chalk_1.default.gray(`  kickstack add-table "${tableName} with ..."`));
            process.exit(1);
        }
        // Generate triggers SQL
        console.log(chalk_1.default.yellow('🤖 Generating realtime triggers...'));
        const triggersSql = trigger_generator_1.TriggerGenerator.generateTriggers(tableName);
        console.log(chalk_1.default.gray('\nGenerated SQL:'));
        console.log(chalk_1.default.cyan(triggersSql));
        // Write migration file
        console.log(chalk_1.default.yellow('📝 Writing migration file...'));
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
        const migrationPath = await migrationService.writeMigration({
            tableName: `realtime_triggers_${tableName}`,
            sql: triggersSql
        });
        console.log(chalk_1.default.green(`✓ Migration saved to: ${migrationPath}`));
        // Apply migration to database
        console.log(chalk_1.default.yellow('🗄️  Applying triggers to database...'));
        await db.executeMigration(triggersSql);
        console.log(chalk_1.default.green('✓ Triggers created successfully'));
        // Verify triggers exist
        const triggers = await db.getTriggers(tableName);
        console.log(chalk_1.default.green('\n✨ Realtime enabled successfully!'));
        console.log(chalk_1.default.white('\n📊 Created Triggers:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.cyan(`Table: ${tableName}`));
        console.log(chalk_1.default.gray('Triggers:'));
        triggers.forEach(trigger => {
            console.log(chalk_1.default.gray(`  • ${trigger}`));
        });
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // Display usage information
        console.log(chalk_1.default.white('\n🔗 Realtime Usage:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.green('1. Start realtime service:'));
        console.log(chalk_1.default.gray('   npm run realtime:dev'));
        console.log(chalk_1.default.green('2. Connect WebSocket client:'));
        console.log(chalk_1.default.gray(`   ws://localhost:8081?table=${tableName}`));
        console.log(chalk_1.default.green('3. Changes will broadcast automatically'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.yellow('\n📝 Note: Ensure kickstack_changes table exists:'));
        console.log(chalk_1.default.gray('  Apply migration: infra/migrations/00000000_0000_kickstack_changes.sql'));
        console.log(chalk_1.default.green('\n✅ Done! Table is now realtime-enabled.'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ Error adding realtime:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
//# sourceMappingURL=add-realtime.js.map