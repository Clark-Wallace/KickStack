"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reloadSchemaCommand = reloadSchemaCommand;
const database_1 = require("../services/database");
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
async function reloadSchemaCommand() {
    console.log(chalk_1.default.cyan('🔄 Reloading PostgREST schema cache...'));
    try {
        // Try database NOTIFY first
        const db = new database_1.DatabaseService();
        await db.runQuery('NOTIFY pgrst, \'reload schema\';');
        console.log(chalk_1.default.green('✓ Schema reload triggered via NOTIFY'));
    }
    catch (error) {
        // Fallback to script
        try {
            (0, child_process_1.execSync)('./scripts/reload-postgrest.sh', { stdio: 'inherit' });
            console.log(chalk_1.default.green('✓ Schema reloaded via service restart'));
        }
        catch (scriptError) {
            console.error(chalk_1.default.yellow('⚠️  Could not reload schema automatically'));
            console.log(chalk_1.default.gray('   You may need to restart PostgREST manually'));
        }
    }
}
//# sourceMappingURL=reload-schema.js.map