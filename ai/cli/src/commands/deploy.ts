import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DeployOptions {
  profile: 'cloud';
  force?: boolean;
  skipBuild?: boolean;
}

export async function deployFlyCommand(options: DeployOptions): Promise<void> {
  console.log(chalk.blue('🚀 KickStack: Deploying to Fly.io'));
  
  if (options.profile !== 'cloud') {
    console.error(chalk.red('❌ Only cloud profile is supported for Fly.io deployment'));
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
    
    console.log(chalk.green('\n🎉 Deployment successful!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Deployment failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function preFlightChecks(): Promise<void> {
  console.log(chalk.yellow('🔍 Running pre-flight checks...'));
  
  // Check flyctl is installed
  try {
    await execAsync('flyctl version');
    console.log(chalk.green('  ✓ flyctl is installed'));
  } catch (error) {
    throw new Error('flyctl not found. Install: curl -L https://fly.io/install.sh | sh');
  }
  
  // Check if logged in
  try {
    await execAsync('flyctl auth whoami');
    console.log(chalk.green('  ✓ Authenticated with Fly.io'));
  } catch (error) {
    throw new Error('Not logged in to Fly.io. Run: fly auth login');
  }
  
  // Check fly.toml exists
  const flyTomlPath = path.join(process.cwd(), 'infra', 'fly', 'fly.toml');
  if (!fs.existsSync(flyTomlPath)) {
    throw new Error(`fly.toml not found at ${flyTomlPath}`);
  }
  console.log(chalk.green('  ✓ fly.toml configuration found'));
  
  // Check cloud environment file
  const envPath = path.join(process.cwd(), '.env.cloud.local');
  if (!fs.existsSync(envPath)) {
    console.log(chalk.yellow('  ⚠️  .env.cloud.local not found'));
    console.log(chalk.gray('    Create it by copying infra/env/cloud.env.example'));
    throw new Error('Cloud environment not configured');
  }
  console.log(chalk.green('  ✓ Cloud environment configuration found'));
  
  // Validate cloud environment
  await validateCloudEnv(envPath);
  console.log(chalk.green('  ✓ Cloud environment validated'));
}

async function validateCloudEnv(envPath: string): Promise<void> {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'JWT_SECRET',
    'PGRST_DB_URI',
    'GOTRUE_DB_DATABASE_URL',
    'FLY_APP_NAME'
  ];
  
  const missingVars = requiredVars.filter(varName => 
    !envContent.includes(`${varName}=`) || 
    envContent.includes(`${varName}=your-`) ||
    envContent.includes(`${varName}=changeme`)
  );
  
  if (missingVars.length > 0) {
    throw new Error(`Missing or placeholder values in .env.cloud.local: ${missingVars.join(', ')}`);
  }
}

async function buildForCloud(): Promise<void> {
  console.log(chalk.yellow('🔨 Building for cloud deployment...'));
  
  // Install dependencies
  console.log(chalk.gray('  Installing dependencies...'));
  await execAsync('npm install');
  
  // Build Functions Gateway
  console.log(chalk.gray('  Building Functions Gateway...'));
  await execAsync('cd api/fngw && npm run build');
  
  // Build Realtime service
  console.log(chalk.gray('  Building Realtime service...'));
  await execAsync('cd api/realtime && npm run build');
  
  // Build Web app
  console.log(chalk.gray('  Building Web application...'));
  await execAsync('cd web && npm run build');
  
  console.log(chalk.green('  ✓ Build completed'));
}

async function deployToFly(): Promise<void> {
  console.log(chalk.yellow('🚁 Deploying to Fly.io...'));
  
  const flyTomlPath = path.join(process.cwd(), 'infra', 'fly', 'fly.toml');
  
  try {
    // Push environment variables as secrets first
    await pushSecretsToFly();
    
    // Deploy the application
    console.log(chalk.gray('  Executing fly deploy...'));
    const { stdout, stderr } = await execAsync(`flyctl deploy -c ${flyTomlPath} --verbose`);
    
    if (stderr && stderr.includes('ERROR')) {
      throw new Error(stderr);
    }
    
    console.log(chalk.green('  ✓ Application deployed successfully'));
    
    // Wait for deployment to be healthy
    console.log(chalk.gray('  Waiting for deployment to be healthy...'));
    await waitForHealthy();
    console.log(chalk.green('  ✓ Deployment is healthy'));
    
  } catch (error) {
    console.error(chalk.red('  Deployment failed:'), error);
    throw error;
  }
}

async function pushSecretsToFly(): Promise<void> {
  console.log(chalk.gray('  Pushing environment variables as secrets...'));
  
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
  
  const secrets = Object.entries(envVars).filter(([key, value]) => 
    !nonSecretVars.some(nonSecret => key.startsWith(nonSecret)) &&
    value && 
    !value.includes('your-') && 
    value !== 'changeme'
  );
  
  if (secrets.length === 0) {
    console.log(chalk.gray('    No secrets to push'));
    return;
  }
  
  const secretArgs = secrets
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  try {
    await execAsync(`flyctl secrets set ${secretArgs}`);
    console.log(chalk.green(`    ✓ Pushed ${secrets.length} secrets`));
  } catch (error) {
    throw new Error(`Failed to push secrets: ${error}`);
  }
}

async function waitForHealthy(): Promise<void> {
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const { stdout } = await execAsync('flyctl status --json');
      const status = JSON.parse(stdout);
      
      if (status.Status === 'running') {
        return;
      }
      
      console.log(chalk.gray(`    Waiting... (${status.Status})`));
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
    } catch (error) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  throw new Error('Deployment did not become healthy within 5 minutes');
}

async function generateDeploymentSummary(): Promise<void> {
  console.log(chalk.yellow('📝 Generating deployment summary...'));
  
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
    
    console.log(chalk.green(`  ✓ Summary saved to: ${summaryPath}`));
    
    // Also log key info to console
    console.log(chalk.white('\n🌐 Deployment URLs:'));
    console.log(chalk.cyan(`  Main API: https://${hostname}/`));
    console.log(chalk.cyan(`  Auth: https://${hostname}/auth/`));
    console.log(chalk.cyan(`  Functions: https://${hostname}/fn/`));
    console.log(chalk.cyan(`  Health: https://${hostname}/health`));
    
  } catch (error) {
    console.log(chalk.yellow('  ⚠️  Could not generate detailed summary'));
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  
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

export async function openCommand(): Promise<void> {
  console.log(chalk.blue('🌐 Opening deployed application...'));
  
  try {
    const { stdout } = await execAsync('flyctl status --json');
    const status = JSON.parse(stdout);
    const hostname = status.Hostname;
    
    if (!hostname) {
      throw new Error('Could not determine app hostname');
    }
    
    const url = `https://${hostname}`;
    console.log(chalk.cyan(`Opening: ${url}`));
    
    // Open in default browser
    const open = process.platform === 'darwin' ? 'open' : 
                 process.platform === 'win32' ? 'start' : 'xdg-open';
    
    await execAsync(`${open} ${url}`);
    console.log(chalk.green('✓ Opened in browser'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to open app:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}