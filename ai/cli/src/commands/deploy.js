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
exports.deployFlyCommand = deployFlyCommand;
exports.openCommand = openCommand;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function deployFlyCommand(options) {
    console.log(chalk_1.default.blue('🚀 KickStack: Deploying to Fly.io'));
    if (options.profile !== 'cloud') {
        console.error(chalk_1.default.red('❌ Only cloud profile is supported for Fly.io deployment'));
        process.exit(1);
    }
    try {
        // Pre-flight checks
        await preFlightChecks();
        // Build for cloud
        if (!options.skipBuild) {
            await buildForCloud();
        }
        // Deploy to Fly
        await deployToFly();
        // Generate deployment summary
        await generateDeploymentSummary();
        console.log(chalk_1.default.green('\n🎉 Deployment successful!'));
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ Deployment failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
async function preFlightChecks() {
    console.log(chalk_1.default.yellow('🔍 Running pre-flight checks...'));
    // Check flyctl is installed
    try {
        await execAsync('flyctl version');
        console.log(chalk_1.default.green('  ✓ flyctl is installed'));
    }
    catch (error) {
        throw new Error('flyctl not found. Install: curl -L https://fly.io/install.sh | sh');
    }
    // Check if logged in
    try {
        await execAsync('flyctl auth whoami');
        console.log(chalk_1.default.green('  ✓ Authenticated with Fly.io'));
    }
    catch (error) {
        throw new Error('Not logged in to Fly.io. Run: fly auth login');
    }
    // Check fly.toml exists
    const flyTomlPath = path.join(process.cwd(), 'infra', 'fly', 'fly.toml');
    if (!fs.existsSync(flyTomlPath)) {
        throw new Error(`fly.toml not found at ${flyTomlPath}`);
    }
    console.log(chalk_1.default.green('  ✓ fly.toml configuration found'));
    // Check cloud environment file
    const envPath = path.join(process.cwd(), '.env.cloud.local');
    if (!fs.existsSync(envPath)) {
        console.log(chalk_1.default.yellow('  ⚠️  .env.cloud.local not found'));
        console.log(chalk_1.default.gray('    Create it by copying infra/env/cloud.env.example'));
        throw new Error('Cloud environment not configured');
    }
    console.log(chalk_1.default.green('  ✓ Cloud environment configuration found'));
    // Validate cloud environment
    await validateCloudEnv(envPath);
    console.log(chalk_1.default.green('  ✓ Cloud environment validated'));
}
async function validateCloudEnv(envPath) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
        'JWT_SECRET',
        'PGRST_DB_URI',
        'GOTRUE_DB_DATABASE_URL',
        'FLY_APP_NAME'
    ];
    const missingVars = requiredVars.filter(varName => !envContent.includes(`${varName}=`) ||
        envContent.includes(`${varName}=your-`) ||
        envContent.includes(`${varName}=changeme`));
    if (missingVars.length > 0) {
        throw new Error(`Missing or placeholder values in .env.cloud.local: ${missingVars.join(', ')}`);
    }
}
async function buildForCloud() {
    console.log(chalk_1.default.yellow('🔨 Building for cloud deployment...'));
    // Install dependencies
    console.log(chalk_1.default.gray('  Installing dependencies...'));
    await execAsync('npm install');
    // Build Functions Gateway
    console.log(chalk_1.default.gray('  Building Functions Gateway...'));
    await execAsync('cd api/fngw && npm run build');
    // Build Realtime service
    console.log(chalk_1.default.gray('  Building Realtime service...'));
    await execAsync('cd api/realtime && npm run build');
    // Build Web app
    console.log(chalk_1.default.gray('  Building Web application...'));
    await execAsync('cd web && npm run build');
    console.log(chalk_1.default.green('  ✓ Build completed'));
}
async function deployToFly() {
    console.log(chalk_1.default.yellow('🚁 Deploying to Fly.io...'));
    const flyTomlPath = path.join(process.cwd(), 'infra', 'fly', 'fly.toml');
    try {
        // Push environment variables as secrets first
        await pushSecretsToFly();
        // Deploy the application
        console.log(chalk_1.default.gray('  Executing fly deploy...'));
        const { stdout, stderr } = await execAsync(`flyctl deploy -c ${flyTomlPath} --verbose`);
        if (stderr && stderr.includes('ERROR')) {
            throw new Error(stderr);
        }
        console.log(chalk_1.default.green('  ✓ Application deployed successfully'));
        // Wait for deployment to be healthy
        console.log(chalk_1.default.gray('  Waiting for deployment to be healthy...'));
        await waitForHealthy();
        console.log(chalk_1.default.green('  ✓ Deployment is healthy'));
    }
    catch (error) {
        console.error(chalk_1.default.red('  Deployment failed:'), error);
        throw error;
    }
}
async function pushSecretsToFly() {
    console.log(chalk_1.default.gray('  Pushing environment variables as secrets...'));
    const envPath = path.join(process.cwd(), '.env.cloud.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = parseEnvFile(envContent);
    // Filter out non-secret variables (these go in fly.toml [env])
    const nonSecretVars = [
        'NODE_ENV',
        'PGRST_DB_SCHEMA',
        'PGRST_DB_ANON_ROLE',
        'GOTRUE_DB_DRIVER',
        'GOTRUE_JWT_EXP',
        'GOTRUE_JWT_AUD',
        'GOTRUE_JWT_DEFAULT_GROUP_NAME',
        'FNGW_PORT',
        'INTERNAL_'
    ];
    const secrets = Object.entries(envVars).filter(([key, value]) => !nonSecretVars.some(nonSecret => key.startsWith(nonSecret)) &&
        value &&
        !value.includes('your-') &&
        value !== 'changeme');
    if (secrets.length === 0) {
        console.log(chalk_1.default.gray('    No secrets to push'));
        return;
    }
    const secretArgs = secrets
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
    try {
        await execAsync(`flyctl secrets set ${secretArgs}`);
        console.log(chalk_1.default.green(`    ✓ Pushed ${secrets.length} secrets`));
    }
    catch (error) {
        throw new Error(`Failed to push secrets: ${error}`);
    }
}
async function waitForHealthy() {
    const maxAttempts = 30;
    let attempts = 0;
    while (attempts < maxAttempts) {
        try {
            const { stdout } = await execAsync('flyctl status --json');
            const status = JSON.parse(stdout);
            if (status.Status === 'running') {
                return;
            }
            console.log(chalk_1.default.gray(`    Waiting... (${status.Status})`));
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            attempts++;
        }
        catch (error) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    throw new Error('Deployment did not become healthy within 5 minutes');
}
async function generateDeploymentSummary() {
    console.log(chalk_1.default.yellow('📝 Generating deployment summary...'));
    try {
        const { stdout } = await execAsync('flyctl status --json');
        const status = JSON.parse(stdout);
        const appName = status.Name;
        const hostname = status.Hostname;
        const summary = `# KickStack Deployment Summary

## Application Details
- **App Name**: ${appName}
- **URL**: https://${hostname}
- **Region**: ${status.Allocations?.[0]?.Region || 'Unknown'}
- **Status**: ${status.Status}
- **Deployed**: ${new Date().toISOString()}

## API Endpoints
- **Main API**: https://${hostname}/
- **Authentication**: https://${hostname}/auth/
- **Functions**: https://${hostname}/fn/
- **Realtime**: wss://${hostname}/realtime
- **Health Check**: https://${hostname}/health

## Quick Tests
\`\`\`bash
# Test health
curl https://${hostname}/health

# Test API (if you have public tables)
curl https://${hostname}/your-table-name

# Test auth
curl -X POST https://${hostname}/auth/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com","password":"password123"}'
\`\`\`

## Management Commands
\`\`\`bash
# View logs
fly logs

# Check status
fly status

# Scale resources
fly scale count 2

# SSH into container
fly ssh console
\`\`\`

## Next Steps
1. Update your web app's environment variables to point to: https://${hostname}
2. Test all functionality in production
3. Set up monitoring and alerts
4. Configure custom domain (optional)

---
Generated by KickStack at ${new Date().toISOString()}
`;
        const summaryDir = path.join(process.cwd(), '.deploy');
        fs.mkdirSync(summaryDir, { recursive: true });
        const summaryPath = path.join(summaryDir, 'summary.md');
        fs.writeFileSync(summaryPath, summary);
        console.log(chalk_1.default.green(`  ✓ Summary saved to: ${summaryPath}`));
        // Also log key info to console
        console.log(chalk_1.default.white('\n🌐 Deployment URLs:'));
        console.log(chalk_1.default.cyan(`  Main API: https://${hostname}/`));
        console.log(chalk_1.default.cyan(`  Auth: https://${hostname}/auth/`));
        console.log(chalk_1.default.cyan(`  Functions: https://${hostname}/fn/`));
        console.log(chalk_1.default.cyan(`  Health: https://${hostname}/health`));
    }
    catch (error) {
        console.log(chalk_1.default.yellow('  ⚠️  Could not generate detailed summary'));
    }
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
async function openCommand() {
    console.log(chalk_1.default.blue('🌐 Opening deployed application...'));
    try {
        const { stdout } = await execAsync('flyctl status --json');
        const status = JSON.parse(stdout);
        const hostname = status.Hostname;
        if (!hostname) {
            throw new Error('Could not determine app hostname');
        }
        const url = `https://${hostname}`;
        console.log(chalk_1.default.cyan(`Opening: ${url}`));
        // Open in default browser
        const open = process.platform === 'darwin' ? 'open' :
            process.platform === 'win32' ? 'start' : 'xdg-open';
        await execAsync(`${open} ${url}`);
        console.log(chalk_1.default.green('✓ Opened in browser'));
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Failed to open app:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
//# sourceMappingURL=deploy.js.map