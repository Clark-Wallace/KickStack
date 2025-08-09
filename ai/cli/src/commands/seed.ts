import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import chalk from 'chalk';
import * as fs from 'fs';

const execAsync = promisify(exec);

interface SeedOptions {
  type?: string;
  clean?: boolean;
}

export async function seedCommand(options: SeedOptions = {}): Promise<void> {
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
  
  console.log(chalk.blue('🌱 Starting demo data seeding...'));
  
  try {
    // Execute the seeding script
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr && !stderr.includes('WARNING') && !stderr.includes('INFO')) {
      console.error(chalk.yellow('Warnings:'), stderr);
    }
    
    console.log(chalk.green('✅ Demo data seeding completed successfully!'));
    
    // Show next steps
    console.log(chalk.blue('\n💡 What\'s next?'));
    console.log('   • Test your API: curl http://localhost:3050/users');
    console.log('   • Generate a token: npm run kickstack generate-token user');
    console.log('   • View the dashboard: http://localhost:3001');
    
  } catch (error: any) {
    throw new Error(`Seeding failed: ${error.message}`);
  }
}

export const seedTypes = [
  'all',
  'organizations', 
  'users',
  'projects',
  'blog',
  'chat'
];

export function validateSeedType(type: string): boolean {
  return seedTypes.includes(type.toLowerCase());
}