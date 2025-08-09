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
exports.demoCommand = void 0;
exports.demoListCommand = demoListCommand;
exports.demoUpCommand = demoUpCommand;
exports.demoDeployCommand = demoDeployCommand;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const database_1 = require("../services/database");
const apply_1 = require("./apply");
const child_process_1 = require("child_process");
const DEMOS_DIR = path.join(__dirname, '../../../../demos');
async function demoListCommand() {
    console.log(chalk_1.default.blue('🚀 KickStack Demo Showcase'));
    console.log(chalk_1.default.gray('─'.repeat(60)));
    try {
        // Read all demo directories
        const demos = fs.readdirSync(DEMOS_DIR).filter(dir => {
            const demoPath = path.join(DEMOS_DIR, dir);
            return fs.statSync(demoPath).isDirectory() &&
                fs.existsSync(path.join(demoPath, 'plan.yaml'));
        });
        if (demos.length === 0) {
            console.log(chalk_1.default.yellow('No demos found.'));
            return;
        }
        for (const demo of demos) {
            const planPath = path.join(DEMOS_DIR, demo, 'plan.yaml');
            const planContent = fs.readFileSync(planPath, 'utf8');
            const manifest = yaml.load(planContent);
            console.log(chalk_1.default.cyan(`\n📦 ${demo}`));
            console.log(chalk_1.default.white(`   ${manifest.summary}`));
            if (manifest.features && manifest.features.length > 0) {
                console.log(chalk_1.default.gray('   Features:'));
                manifest.features.slice(0, 3).forEach(feature => {
                    console.log(chalk_1.default.gray(`   • ${feature}`));
                });
            }
            console.log(chalk_1.default.gray(`\n   Install: ${chalk_1.default.green(`kickstack demo up ${demo}`)}`));
            console.log(chalk_1.default.gray(`   Deploy:  ${chalk_1.default.green(`kickstack demo deploy ${demo}`)}`));
        }
        console.log(chalk_1.default.gray('\n─'.repeat(60)));
        console.log(chalk_1.default.white('Learn more: https://github.com/Clark-Wallace/KickStack/tree/main/demos'));
    }
    catch (error) {
        console.error(chalk_1.default.red('Error listing demos:'), error);
        process.exit(1);
    }
}
async function demoUpCommand(name, options) {
    console.log(chalk_1.default.blue(`🚀 Installing ${name} demo...`));
    const demoPath = path.join(DEMOS_DIR, name);
    if (!fs.existsSync(demoPath)) {
        console.error(chalk_1.default.red(`Demo '${name}' not found.`));
        console.log(chalk_1.default.yellow('Available demos:'));
        await demoListCommand();
        process.exit(1);
    }
    try {
        const db = new database_1.DatabaseService();
        // 1. Load and validate plan
        const planPath = path.join(demoPath, 'plan.yaml');
        if (!fs.existsSync(planPath)) {
            throw new Error(`No plan.yaml found for demo '${name}'`);
        }
        console.log(chalk_1.default.yellow('📋 Loading demo plan...'));
        const planContent = fs.readFileSync(planPath, 'utf8');
        const manifest = yaml.load(planContent);
        // 2. Apply migrations if they exist
        const migrationsPath = path.join(demoPath, 'migrations');
        if (fs.existsSync(migrationsPath)) {
            console.log(chalk_1.default.yellow('🗄️  Applying migrations...'));
            const migrations = fs.readdirSync(migrationsPath)
                .filter(f => f.endsWith('.sql'))
                .sort();
            for (const migration of migrations) {
                const migrationPath = path.join(migrationsPath, migration);
                const sql = fs.readFileSync(migrationPath, 'utf8');
                console.log(chalk_1.default.gray(`   Applying ${migration}...`));
                await db.executeMigration(sql);
            }
        }
        // 3. Copy functions if they exist
        const functionsPath = path.join(demoPath, 'functions');
        if (fs.existsSync(functionsPath)) {
            console.log(chalk_1.default.yellow('⚡ Installing functions...'));
            const targetFunctionsDir = path.join(__dirname, '../../../../functions');
            if (!fs.existsSync(targetFunctionsDir)) {
                fs.mkdirSync(targetFunctionsDir, { recursive: true });
            }
            const functions = fs.readdirSync(functionsPath)
                .filter(f => f.endsWith('.ts') || f.endsWith('.js'));
            for (const func of functions) {
                const sourcePath = path.join(functionsPath, func);
                const targetPath = path.join(targetFunctionsDir, func);
                fs.copyFileSync(sourcePath, targetPath);
                console.log(chalk_1.default.gray(`   Installed function: ${func}`));
            }
        }
        // 4. Apply seed data if requested
        if (options.withSeed) {
            const seedPath = path.join(demoPath, 'seed');
            if (fs.existsSync(seedPath)) {
                console.log(chalk_1.default.yellow('🌱 Applying seed data...'));
                const seeds = fs.readdirSync(seedPath)
                    .filter(f => f.endsWith('.sql'))
                    .sort();
                for (const seed of seeds) {
                    const seedFilePath = path.join(seedPath, seed);
                    const sql = fs.readFileSync(seedFilePath, 'utf8');
                    console.log(chalk_1.default.gray(`   Seeding ${seed}...`));
                    await db.executeMigration(sql);
                }
            }
        }
        // 5. Apply the plan using orchestrator
        console.log(chalk_1.default.yellow('🔧 Applying demo configuration...'));
        // Save plan to temp file for apply command
        const tempPlanPath = path.join('/tmp', `demo-${name}-${Date.now()}.yaml`);
        fs.writeFileSync(tempPlanPath, planContent);
        // Use the existing apply command
        await (0, apply_1.applyCommand)({ file: tempPlanPath, force: true, noVerify: false });
        // Clean up temp file
        fs.unlinkSync(tempPlanPath);
        // 6. Run verification if defined (commented out for now as verification field doesn't exist in type)
        // if ((manifest as any).verification?.smoke) {
        //   console.log(chalk.yellow('✅ Running smoke tests...'));
        //   for (const test of (manifest as any).verification.smoke) {
        //     console.log(chalk.gray(`   Testing ${test.method} ${test.path}...`));
        //     // In production, actually make the HTTP requests
        //   }
        // }
        console.log(chalk_1.default.green(`\n✨ ${name} demo installed successfully!`));
        console.log(chalk_1.default.white('\n📖 Next steps:'));
        console.log(chalk_1.default.gray(`1. View the demo README: demos/${name}/README.md`));
        console.log(chalk_1.default.gray(`2. Start the dashboard: npm run web:dev`));
        console.log(chalk_1.default.gray(`3. Start functions gateway: npm run fngw:dev`));
        console.log(chalk_1.default.gray(`4. Test the API endpoints listed in the README`));
        if (manifest.features) {
            console.log(chalk_1.default.white('\n🎯 Features to explore:'));
            manifest.features.forEach(feature => {
                console.log(chalk_1.default.gray(`   • ${feature}`));
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Error installing demo:'), error);
        process.exit(1);
    }
}
async function demoDeployCommand(name, options) {
    console.log(chalk_1.default.blue(`🚀 Deploying ${name} demo to cloud...`));
    const demoPath = path.join(DEMOS_DIR, name);
    if (!fs.existsSync(demoPath)) {
        console.error(chalk_1.default.red(`Demo '${name}' not found.`));
        process.exit(1);
    }
    try {
        // First install locally
        console.log(chalk_1.default.yellow('📦 Installing demo locally first...'));
        await demoUpCommand(name, { withSeed: true });
        // Deploy to Fly.io
        console.log(chalk_1.default.yellow('☁️  Deploying to Fly.io...'));
        // Check if fly CLI is installed
        try {
            (0, child_process_1.execSync)('flyctl version', { stdio: 'ignore' });
        }
        catch {
            console.error(chalk_1.default.red('Fly CLI not found. Please install: https://fly.io/docs/hands-on/install-flyctl/'));
            process.exit(1);
        }
        // Deploy using existing deploy command
        (0, child_process_1.execSync)(`npm run kickstack deploy fly --profile cloud`, {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        console.log(chalk_1.default.green(`\n✨ ${name} demo deployed successfully!`));
        console.log(chalk_1.default.white('\n🌐 Access your demo:'));
        console.log(chalk_1.default.cyan(`   https://kickstack-${name}-demo.fly.dev`));
        console.log(chalk_1.default.gray(`\n   Note: Update the URL based on your Fly.io app name`));
    }
    catch (error) {
        console.error(chalk_1.default.red('Error deploying demo:'), error);
        process.exit(1);
    }
}
// Export for CLI
exports.demoCommand = {
    list: demoListCommand,
    up: demoUpCommand,
    deploy: demoDeployCommand
};
//# sourceMappingURL=demo.js.map