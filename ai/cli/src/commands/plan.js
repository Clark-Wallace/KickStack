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
exports.planCommand = planCommand;
const chalk_1 = __importDefault(require("chalk"));
const orchestrate_1 = require("../../../orchestrator/src/orchestrate");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
async function planCommand(options) {
    console.log(chalk_1.default.blue('📋 KickStack: Plan Review'));
    const orchestrator = new orchestrate_1.Orchestrator();
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
        // Render the plan to artifacts
        const rendered = await orchestrator.renderPlan(plan);
        // Stage the artifacts
        await orchestrator.stageArtifacts(rendered);
        // Print summary
        orchestrator.printSummary(plan, rendered);
        console.log(chalk_1.default.white('\n📁 Artifacts staged:'));
        console.log(chalk_1.default.gray('  • Migrations in: infra/migrations/_staged/'));
        console.log(chalk_1.default.gray('  • Functions in: api/functions/_staged/'));
        console.log(chalk_1.default.white('\n🚀 Next steps:'));
        console.log(chalk_1.default.gray(`  1. Apply with: kickstack apply --file ${path.basename(planPath)}`));
        console.log(chalk_1.default.gray('  2. Or force apply: kickstack apply --file --force (overwrite existing)'));
        console.log(chalk_1.default.green('\n✅ Plan loaded and staged successfully!'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ Plan loading failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
//# sourceMappingURL=plan.js.map