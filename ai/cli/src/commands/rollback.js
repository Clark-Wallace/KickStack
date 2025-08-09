"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollbackCommand = rollbackCommand;
const chalk_1 = __importDefault(require("chalk"));
const apply_1 = require("../../../orchestrator/src/apply");
async function rollbackCommand(options) {
    console.log(chalk_1.default.blue('🔄 KickStack: Rollback'));
    if (!options.last) {
        console.error(chalk_1.default.red('❌ Currently only --last rollback is supported'));
        console.log(chalk_1.default.gray('Usage: kickstack rollback --last'));
        process.exit(1);
    }
    const applyService = new apply_1.ApplyService();
    try {
        console.log(chalk_1.default.yellow('⚠️  This will restore the database to the previous schema snapshot'));
        console.log(chalk_1.default.yellow('⚠️  All data changes since the last apply will be lost'));
        // In a real implementation, you might want to add a confirmation prompt
        console.log(chalk_1.default.gray('\nProceeding with rollback...'));
        await applyService.rollback();
        console.log(chalk_1.default.green('\n✅ Rollback completed successfully'));
        console.log(chalk_1.default.white('\n🔧 Recommended next steps:'));
        console.log(chalk_1.default.gray('  1. Restart PostgREST to reload schema: docker-compose restart postgrest'));
        console.log(chalk_1.default.gray('  2. Check your application functionality'));
        console.log(chalk_1.default.gray('  3. Review what went wrong with the previous deployment'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ Rollback failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
//# sourceMappingURL=rollback.js.map