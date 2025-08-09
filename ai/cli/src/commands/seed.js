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
exports.seedTypes = void 0;
exports.seedCommand = seedCommand;
exports.validateSeedType = validateSeedType;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function seedCommand(options = {}) {
    const scriptPath = path.join(__dirname, '../../../../../scripts/seed-demo-data.sh');
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Seeding script not found at: ${scriptPath}`);
    }
    // Build command
    let command = `"${scriptPath}"`;
    if (options.type && options.type !== 'all') {
        command += ` --type ${options.type}`;
    }
    if (options.clean) {
        command += ` --clean`;
    }
    console.log(chalk_1.default.blue('🌱 Starting demo data seeding...'));
    try {
        // Execute the seeding script
        const { stdout, stderr } = await execAsync(command);
        if (stdout) {
            console.log(stdout);
        }
        if (stderr && !stderr.includes('WARNING') && !stderr.includes('INFO')) {
            console.error(chalk_1.default.yellow('Warnings:'), stderr);
        }
        console.log(chalk_1.default.green('✅ Demo data seeding completed successfully!'));
        // Show next steps
        console.log(chalk_1.default.blue('\n💡 What\'s next?'));
        console.log('   • Test your API: curl http://localhost:3050/users');
        console.log('   • Generate a token: npm run kickstack generate-token user');
        console.log('   • View the dashboard: http://localhost:3001');
    }
    catch (error) {
        throw new Error(`Seeding failed: ${error.message}`);
    }
}
exports.seedTypes = [
    'all',
    'organizations',
    'users',
    'projects',
    'blog',
    'chat'
];
function validateSeedType(type) {
    return exports.seedTypes.includes(type.toLowerCase());
}
//# sourceMappingURL=seed.js.map