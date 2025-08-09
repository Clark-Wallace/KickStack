import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DatabaseService } from '../services/database';
import { applyCommand } from './apply';
import { execSync } from 'child_process';

interface DemoManifest {
  name: string;
  summary: string;
  description?: string;
  features?: string[];
  steps: any[];
}

const DEMOS_DIR = path.join(__dirname, '../../../../demos');

export async function demoListCommand(): Promise<void> {
  console.log(chalk.blue('🚀 KickStack Demo Showcase'));
  console.log(chalk.gray('─'.repeat(60)));
  
  try {
    // Read all demo directories
    const demos = fs.readdirSync(DEMOS_DIR).filter(dir => {
      const demoPath = path.join(DEMOS_DIR, dir);
      return fs.statSync(demoPath).isDirectory() && 
             fs.existsSync(path.join(demoPath, 'plan.yaml'));
    });

    if (demos.length === 0) {
      console.log(chalk.yellow('No demos found.'));
      return;
    }

    for (const demo of demos) {
      const planPath = path.join(DEMOS_DIR, demo, 'plan.yaml');
      const planContent = fs.readFileSync(planPath, 'utf8');
      const manifest = yaml.load(planContent) as DemoManifest;
      
      console.log(chalk.cyan(`\n📦 ${demo}`));
      console.log(chalk.white(`   ${manifest.summary}`));
      
      if (manifest.features && manifest.features.length > 0) {
        console.log(chalk.gray('   Features:'));
        manifest.features.slice(0, 3).forEach(feature => {
          console.log(chalk.gray(`   • ${feature}`));
        });
      }
      
      console.log(chalk.gray(`\n   Install: ${chalk.green(`kickstack demo up ${demo}`)}`));
      console.log(chalk.gray(`   Deploy:  ${chalk.green(`kickstack demo deploy ${demo}`)}`));
    }
    
    console.log(chalk.gray('\n─'.repeat(60)));
    console.log(chalk.white('Learn more: https://github.com/Clark-Wallace/KickStack/tree/main/demos'));
  } catch (error) {
    console.error(chalk.red('Error listing demos:'), error);
    process.exit(1);
  }
}

export async function demoUpCommand(name: string, options: any): Promise<void> {
  console.log(chalk.blue(`🚀 Installing ${name} demo...`));
  
  const demoPath = path.join(DEMOS_DIR, name);
  
  if (!fs.existsSync(demoPath)) {
    console.error(chalk.red(`Demo '${name}' not found.`));
    console.log(chalk.yellow('Available demos:'));
    await demoListCommand();
    process.exit(1);
  }
  
  try {
    const db = new DatabaseService();
    
    // 1. Load and validate plan
    const planPath = path.join(demoPath, 'plan.yaml');
    if (!fs.existsSync(planPath)) {
      throw new Error(`No plan.yaml found for demo '${name}'`);
    }
    
    console.log(chalk.yellow('📋 Loading demo plan...'));
    const planContent = fs.readFileSync(planPath, 'utf8');
    const manifest = yaml.load(planContent) as DemoManifest;
    
    // 2. Apply migrations if they exist
    const migrationsPath = path.join(demoPath, 'migrations');
    if (fs.existsSync(migrationsPath)) {
      console.log(chalk.yellow('🗄️  Applying migrations...'));
      const migrations = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const migration of migrations) {
        const migrationPath = path.join(migrationsPath, migration);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log(chalk.gray(`   Applying ${migration}...`));
        await db.executeMigration(sql);
      }
    }
    
    // 3. Copy functions if they exist
    const functionsPath = path.join(demoPath, 'functions');
    if (fs.existsSync(functionsPath)) {
      console.log(chalk.yellow('⚡ Installing functions...'));
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
        console.log(chalk.gray(`   Installed function: ${func}`));
      }
    }
    
    // 4. Apply seed data if requested
    if (options.withSeed) {
      const seedPath = path.join(demoPath, 'seed');
      if (fs.existsSync(seedPath)) {
        console.log(chalk.yellow('🌱 Applying seed data...'));
        const seeds = fs.readdirSync(seedPath)
          .filter(f => f.endsWith('.sql'))
          .sort();
        
        for (const seed of seeds) {
          const seedFilePath = path.join(seedPath, seed);
          const sql = fs.readFileSync(seedFilePath, 'utf8');
          console.log(chalk.gray(`   Seeding ${seed}...`));
          await db.executeMigration(sql);
        }
      }
    }
    
    // 5. Apply the plan using orchestrator
    console.log(chalk.yellow('🔧 Applying demo configuration...'));
    
    // Save plan to temp file for apply command
    const tempPlanPath = path.join('/tmp', `demo-${name}-${Date.now()}.yaml`);
    fs.writeFileSync(tempPlanPath, planContent);
    
    // Use the existing apply command
    await applyCommand({ file: tempPlanPath, force: true, noVerify: false });
    
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
    
    console.log(chalk.green(`\n✨ ${name} demo installed successfully!`));
    console.log(chalk.white('\n📖 Next steps:'));
    console.log(chalk.gray(`1. View the demo README: demos/${name}/README.md`));
    console.log(chalk.gray(`2. Start the dashboard: npm run web:dev`));
    console.log(chalk.gray(`3. Start functions gateway: npm run fngw:dev`));
    console.log(chalk.gray(`4. Test the API endpoints listed in the README`));
    
    if (manifest.features) {
      console.log(chalk.white('\n🎯 Features to explore:'));
      manifest.features.forEach(feature => {
        console.log(chalk.gray(`   • ${feature}`));
      });
    }
    
  } catch (error) {
    console.error(chalk.red('Error installing demo:'), error);
    process.exit(1);
  }
}

export async function demoDeployCommand(name: string, options: any): Promise<void> {
  console.log(chalk.blue(`🚀 Deploying ${name} demo to cloud...`));
  
  const demoPath = path.join(DEMOS_DIR, name);
  
  if (!fs.existsSync(demoPath)) {
    console.error(chalk.red(`Demo '${name}' not found.`));
    process.exit(1);
  }
  
  try {
    // First install locally
    console.log(chalk.yellow('📦 Installing demo locally first...'));
    await demoUpCommand(name, { withSeed: true });
    
    // Deploy to Fly.io
    console.log(chalk.yellow('☁️  Deploying to Fly.io...'));
    
    // Check if fly CLI is installed
    try {
      execSync('flyctl version', { stdio: 'ignore' });
    } catch {
      console.error(chalk.red('Fly CLI not found. Please install: https://fly.io/docs/hands-on/install-flyctl/'));
      process.exit(1);
    }
    
    // Deploy using existing deploy command
    execSync(`npm run kickstack deploy fly --profile cloud`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log(chalk.green(`\n✨ ${name} demo deployed successfully!`));
    console.log(chalk.white('\n🌐 Access your demo:'));
    console.log(chalk.cyan(`   https://kickstack-${name}-demo.fly.dev`));
    console.log(chalk.gray(`\n   Note: Update the URL based on your Fly.io app name`));
    
  } catch (error) {
    console.error(chalk.red('Error deploying demo:'), error);
    process.exit(1);
  }
}

// Export for CLI
export const demoCommand = {
  list: demoListCommand,
  up: demoUpCommand,
  deploy: demoDeployCommand
};