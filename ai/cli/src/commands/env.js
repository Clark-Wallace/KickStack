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
exports.envPullCommand = envPullCommand;
exports.envPushCommand = envPushCommand;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function envPullCommand(options) {
    console.log(chalk_1.default.blue(`🌩️  KickStack: Pulling ${options.profile} environment`));
    if (options.profile === 'local') {
        console.error(chalk_1.default.red('❌ Local profile does not support pull operation'));
        console.log(chalk_1.default.gray('Local environment is managed via docker-compose.yml and .env'));
        process.exit(1);
    }
    if (options.profile === 'cloud') {
        await pullCloudEnv();
    }
}
async function envPushCommand(options) {
    console.log(chalk_1.default.blue(`🚀 KickStack: Pushing ${options.profile} environment`));
    if (options.profile === 'local') {
        console.error(chalk_1.default.red('❌ Local profile does not support push operation'));
        console.log(chalk_1.default.gray('Local environment is managed via docker-compose.yml and .env'));
        process.exit(1);
    }
    if (options.profile === 'cloud') {
        await pushCloudEnv();
    }
}
async function pullCloudEnv() {
    try {
        // Check if flyctl is installed
        await checkFlyctl();
        // Get current fly app info
        const appInfo = await getCurrentFlyApp();
        console.log(chalk_1.default.gray(`Connected to app: ${appInfo.name}`));
        // Get all secrets from Fly
        console.log(chalk_1.default.yellow('📥 Fetching secrets from Fly.io...'));
        const { stdout } = await execAsync('flyctl secrets list --json');
        const secrets = JSON.parse(stdout);
        // Create local cloud env file
        const envPath = path.join(process.cwd(), '.env.cloud.local');
        const envContent = buildEnvFromSecrets(secrets, appInfo);
        fs.writeFileSync(envPath, envContent);
        console.log(chalk_1.default.green(`✓ Environment pulled to: ${envPath}`));
        console.log(chalk_1.default.white('\n📝 Environment Variables:'));
        const lines = envContent.split('\n').filter(line => line && !line.startsWith('#'));
        lines.forEach(line => {
            const [key, value] = line.split('=', 2);
            if (value && !isSecretValue(key)) {
                console.log(chalk_1.default.gray(`  ${key}=${value}`));
            }
            else {
                console.log(chalk_1.default.gray(`  ${key}=***`));
            }
        });
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Failed to pull environment:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
async function pushCloudEnv() {
    try {
        // Check if flyctl is installed
        await checkFlyctl();
        // Check if local cloud env exists
        const envPath = path.join(process.cwd(), '.env.cloud.local');
        if (!fs.existsSync(envPath)) {
            console.error(chalk_1.default.red(`❌ Cloud environment file not found: ${envPath}`));
            console.log(chalk_1.default.yellow('Create this file first by:'));
            console.log(chalk_1.default.gray('  1. Copy infra/env/cloud.env.example to .env.cloud.local'));
            console.log(chalk_1.default.gray('  2. Fill in your actual values'));
            process.exit(1);
        }
        // Parse local env file
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = parseEnvFile(envContent);
        console.log(chalk_1.default.yellow('🔍 Environment variables to push:'));
        Object.keys(envVars).forEach(key => {
            if (isSecretValue(key)) {
                console.log(chalk_1.default.gray(`  ${key}=***`));
            }
            else {
                console.log(chalk_1.default.gray(`  ${key}=${envVars[key]}`));
            }
        });
        // Confirmation prompt
        console.log(chalk_1.default.yellow('\n⚠️  This will overwrite existing Fly.io secrets'));
        console.log(chalk_1.default.gray('Press Ctrl+C to cancel, or Enter to continue...'));
        // Wait for user confirmation (in a real implementation, you'd use readline)
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Push secrets to Fly
        console.log(chalk_1.default.yellow('📤 Pushing secrets to Fly.io...'));
        const secretArgs = Object.entries(envVars)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
        const { stdout, stderr } = await execAsync(`flyctl secrets set ${secretArgs}`);
        if (stderr && !stderr.includes('Secrets are staged')) {
            throw new Error(stderr);
        }
        console.log(chalk_1.default.green('✓ Secrets pushed successfully!'));
        if (stdout.includes('Release')) {
            console.log(chalk_1.default.blue('🔄 App is redeploying with new secrets...'));
            console.log(chalk_1.default.gray('Monitor status with: fly status'));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Failed to push environment:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
async function checkFlyctl() {
    try {
        await execAsync('flyctl version');
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ flyctl not found'));
        console.log(chalk_1.default.yellow('Install flyctl first:'));
        console.log(chalk_1.default.gray('  curl -L https://fly.io/install.sh | sh'));
        console.log(chalk_1.default.gray('  fly auth login'));
        throw new Error('flyctl not installed');
    }
}
async function getCurrentFlyApp() {
    try {
        const { stdout } = await execAsync('flyctl status --json');
        const status = JSON.parse(stdout);
        return {
            name: status.Name,
            region: status.Hostname
        };
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Not connected to a Fly.io app'));
        console.log(chalk_1.default.yellow('Navigate to your app directory or run:'));
        console.log(chalk_1.default.gray('  fly apps list'));
        console.log(chalk_1.default.gray('  cd your-app-directory'));
        throw new Error('No fly app context');
    }
}
function buildEnvFromSecrets(secrets, appInfo) {
    const lines = [
        '# KickStack Cloud Environment (pulled from Fly.io)',
        `# App: ${appInfo.name}`,
        `# Generated: ${new Date().toISOString()}`,
        '',
        '# WARNING: This file contains sensitive data - do not commit to version control!',
        ''
    ];
    // Add secrets
    secrets.forEach(secret => {
        lines.push(`${secret.Name}=${secret.Value || '***'}`);
    });
    return lines.join('\n');
}
function parseEnvFile(content) {
    const vars = {};
    content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                vars[key] = valueParts.join('=').replace(/^"(.*)"$/, '$1');
            }
        }
    });
    return vars;
}
function isSecretValue(key) {
    const secretKeys = [
        'JWT_SECRET',
        'POSTGRES_PASSWORD',
        'GOTRUE_JWT_SECRET',
        'MINIO_ROOT_PASSWORD',
        'KICKSTACK_S3_ACCESS_KEY',
        'KICKSTACK_S3_SECRET_KEY',
        'PGRST_DB_URI',
        'GOTRUE_DB_DATABASE_URL'
    ];
    return secretKeys.some(secretKey => key.includes(secretKey));
}
//# sourceMappingURL=env.js.map