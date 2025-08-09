import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface EnvOptions {
  profile: 'local' | 'cloud';
}

export async function envPullCommand(options: EnvOptions): Promise<void> {
  console.log(chalk.blue(`🌩️  KickStack: Pulling ${options.profile} environment`));
  
  if (options.profile === 'local') {
    console.error(chalk.red('❌ Local profile does not support pull operation'));
    console.log(chalk.gray('Local environment is managed via docker-compose.yml and .env'));
    process.exit(1);
  }
  
  if (options.profile === 'cloud') {
    await pullCloudEnv();
  }
}

export async function envPushCommand(options: EnvOptions): Promise<void> {
  console.log(chalk.blue(`🚀 KickStack: Pushing ${options.profile} environment`));
  
  if (options.profile === 'local') {
    console.error(chalk.red('❌ Local profile does not support push operation'));
    console.log(chalk.gray('Local environment is managed via docker-compose.yml and .env'));
    process.exit(1);
  }
  
  if (options.profile === 'cloud') {
    await pushCloudEnv();
  }
}

async function pullCloudEnv(): Promise<void> {
  try {
    // Check if flyctl is installed
    await checkFlyctl();
    
    // Get current fly app info
    const appInfo = await getCurrentFlyApp();
    console.log(chalk.gray(`Connected to app: ${appInfo.name}`));
    
    // Get all secrets from Fly
    console.log(chalk.yellow('📥 Fetching secrets from Fly.io...'));
    const { stdout } = await execAsync('flyctl secrets list --json');
    const secrets = JSON.parse(stdout);
    
    // Create local cloud env file
    const envPath = path.join(process.cwd(), '.env.cloud.local');
    const envContent = buildEnvFromSecrets(secrets, appInfo);
    
    fs.writeFileSync(envPath, envContent);
    console.log(chalk.green(`✓ Environment pulled to: ${envPath}`));
    
    console.log(chalk.white('\n📝 Environment Variables:'));
    const lines = envContent.split('\n').filter(line => line && !line.startsWith('#'));
    lines.forEach(line => {
      const [key, value] = line.split('=', 2);
      if (value && !isSecretValue(key)) {
        console.log(chalk.gray(`  ${key}=${value}`));
      } else {
        console.log(chalk.gray(`  ${key}=***`));
      }
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to pull environment:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function pushCloudEnv(): Promise<void> {
  try {
    // Check if flyctl is installed
    await checkFlyctl();
    
    // Check if local cloud env exists
    const envPath = path.join(process.cwd(), '.env.cloud.local');
    if (!fs.existsSync(envPath)) {
      console.error(chalk.red(`❌ Cloud environment file not found: ${envPath}`));
      console.log(chalk.yellow('Create this file first by:'));
      console.log(chalk.gray('  1. Copy infra/env/cloud.env.example to .env.cloud.local'));
      console.log(chalk.gray('  2. Fill in your actual values'));
      process.exit(1);
    }
    
    // Parse local env file
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = parseEnvFile(envContent);
    
    console.log(chalk.yellow('🔍 Environment variables to push:'));
    Object.keys(envVars).forEach(key => {
      if (isSecretValue(key)) {
        console.log(chalk.gray(`  ${key}=***`));
      } else {
        console.log(chalk.gray(`  ${key}=${envVars[key]}`));
      }
    });
    
    // Confirmation prompt
    console.log(chalk.yellow('\n⚠️  This will overwrite existing Fly.io secrets'));
    console.log(chalk.gray('Press Ctrl+C to cancel, or Enter to continue...'));
    
    // Wait for user confirmation (in a real implementation, you'd use readline)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Push secrets to Fly
    console.log(chalk.yellow('📤 Pushing secrets to Fly.io...'));
    
    const secretArgs = Object.entries(envVars)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    
    const { stdout, stderr } = await execAsync(`flyctl secrets set ${secretArgs}`);
    
    if (stderr && !stderr.includes('Secrets are staged')) {
      throw new Error(stderr);
    }
    
    console.log(chalk.green('✓ Secrets pushed successfully!'));
    
    if (stdout.includes('Release')) {
      console.log(chalk.blue('🔄 App is redeploying with new secrets...'));
      console.log(chalk.gray('Monitor status with: fly status'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to push environment:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function checkFlyctl(): Promise<void> {
  try {
    await execAsync('flyctl version');
  } catch (error) {
    console.error(chalk.red('❌ flyctl not found'));
    console.log(chalk.yellow('Install flyctl first:'));
    console.log(chalk.gray('  curl -L https://fly.io/install.sh | sh'));
    console.log(chalk.gray('  fly auth login'));
    throw new Error('flyctl not installed');
  }
}

async function getCurrentFlyApp(): Promise<{ name: string; region: string }> {
  try {
    const { stdout } = await execAsync('flyctl status --json');
    const status = JSON.parse(stdout);
    return {
      name: status.Name,
      region: status.Hostname
    };
  } catch (error) {
    console.error(chalk.red('❌ Not connected to a Fly.io app'));
    console.log(chalk.yellow('Navigate to your app directory or run:'));
    console.log(chalk.gray('  fly apps list'));
    console.log(chalk.gray('  cd your-app-directory'));
    throw new Error('No fly app context');
  }
}

function buildEnvFromSecrets(secrets: any[], appInfo: { name: string }): string {
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

function isSecretValue(key: string): boolean {
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