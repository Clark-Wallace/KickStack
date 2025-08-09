"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCommand = applyCommand;
const chalk_1 = __importDefault(require("chalk"));
const orchestrate_1 = require("../../../orchestrator/src/orchestrate");
const apply_1 = require("../../../orchestrator/src/apply");
const verify_1 = require("../../../orchestrator/src/verify");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
async function applyCommand(options) {
    console.log(chalk_1.default.blue('🚀 KickStack: Apply Plan'));
    const orchestrator = new orchestrate_1.Orchestrator();
    const applyService = new apply_1.ApplyService();
    const verifyService = new verify_1.VerifyService();
    try {
        // Resolve file path
        let planPath = options.file;
        if (!path.isAbsolute(planPath)) {
            // Try relative to plans directory first
            const plansPath = path.join(process.cwd(), 'plans', planPath);
            if (fs.existsSync(plansPath)) {
                planPath = plansPath;
            }
            else {
                // Try relative to current directory
                planPath = path.resolve(planPath);
            }
        }
        if (!fs.existsSync(planPath)) {
            throw new Error(`Plan file not found: ${planPath}`);
        }
        console.log(chalk_1.default.gray(`Loading plan: ${planPath}`));
        // Load the plan
        const plan = await orchestrator.loadPlan(planPath);
        console.log(chalk_1.default.cyan(`Applying: ${plan.summary}`));
        // Apply the plan
        const applyResult = await applyService.apply(plan, {
            force: options.force,
            noVerify: options.noVerify
        });
        if (!applyResult.success) {
            console.error(chalk_1.default.red('\n❌ Apply failed:'));
            applyResult.errors?.forEach(error => {
                console.error(chalk_1.default.red(`  • ${error}`));
            });
            console.log(chalk_1.default.yellow('\n💡 To rollback: kickstack rollback --last'));
            process.exit(1);
        }
        // Run verification unless disabled
        if (!options.noVerify) {
            console.log(''); // Add spacing
            const verifyResult = await verifyService.verify(plan);
            if (!verifyResult.success) {
                console.log(chalk_1.default.yellow('\n⚠️  Verification failed, but apply was successful'));
                console.log(chalk_1.default.yellow('You may want to investigate the failed checks'));
                console.log(chalk_1.default.yellow('To rollback: kickstack rollback --last'));
                process.exit(1);
            }
        }
        console.log(chalk_1.default.white('\n🎉 Deployment Complete!'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // Show API endpoints
        const tables = plan.steps.filter(s => s.kind === 'table');
        if (tables.length > 0) {
            console.log(chalk_1.default.white('📡 API Endpoints:'));
            tables.forEach(table => {
                const t = table;
                console.log(chalk_1.default.gray(`  • GET/POST/PATCH/DELETE http://localhost:3000/${t.name}`));
            });
        }
        // Show functions
        const functions = plan.steps.filter(s => s.kind === 'function');
        if (functions.length > 0) {
            console.log(chalk_1.default.white('\n⚡ Edge Functions:'));
            functions.forEach(func => {
                const f = func;
                console.log(chalk_1.default.gray(`  • POST http://localhost:8787/fn/${f.name}`));
            });
        }
        console.log(chalk_1.default.white('\n🌐 Dashboard:'));
        console.log(chalk_1.default.gray('  • http://localhost:3001 (Web UI)'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.green('✅ All done! Your KickStack application is ready.'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ Apply failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
//# sourceMappingURL=apply.js.map