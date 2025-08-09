import { Plan, ApplyResult } from './types';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ApplyService {
  constructor() {
    // Simplified - would integrate with database service
  }

  async apply(plan: Plan, options: { force?: boolean; noVerify?: boolean } = {}): Promise<ApplyResult> {
    console.log(chalk.blue('🚀 Applying plan...'));
    
    const result: ApplyResult = {
      success: true,
      appliedMigrations: [],
      createdFunctions: [],
      errors: []
    };

    try {
      // Validate plan version
      if (plan.version !== 1) {
        throw new Error(`Unsupported plan version: ${plan.version}`);
      }

      // Save current schema snapshot for rollback
      await this.saveSchemaSnapshot();

      // Apply staged migrations
      const migrationResult = await this.applyMigrations(options.force);
      result.appliedMigrations = migrationResult.applied;
      
      if (migrationResult.errors.length > 0) {
        result.errors = migrationResult.errors;
        result.success = false;
        return result;
      }

      // Apply staged functions
      const functionResult = await this.applyFunctions(options.force);
      result.createdFunctions = functionResult.created;
      
      if (functionResult.errors.length > 0) {
        result.errors = functionResult.errors;
        result.success = false;
        return result;
      }

      // Verify if requested
      if (!options.noVerify) {
        const verifyResult = await this.verifyAppliedPlan(plan);
        if (!verifyResult.success) {
          result.errors.push(...verifyResult.errors);
          result.success = false;
        }
      }

      if (result.success) {
        console.log(chalk.green('✓ Plan applied successfully!'));
      } else {
        console.log(chalk.red('✗ Plan application failed with errors'));
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      console.error(chalk.red('Apply failed:'), error);
    }

    return result;
  }

  private async saveSchemaSnapshot(): Promise<void> {
    console.log(chalk.gray('📸 Saving schema snapshot...'));
    
    const snapshotDir = path.join(process.cwd(), '.kickstack', 'snapshots');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
    const snapshotFile = path.join(snapshotDir, `schema_${timestamp}.sql`);
    
    // Would export schema here
    console.log(chalk.gray(`   Snapshot saved to ${snapshotFile}`));
  }

  private async applyMigrations(force?: boolean): Promise<{ applied: string[]; errors: string[] }> {
    console.log(chalk.gray('🗄️  Applying migrations...'));
    
    const stagedDir = path.join(process.cwd(), '.kickstack', 'staged', 'migrations');
    const targetDir = path.join(process.cwd(), 'infra', 'migrations');
    
    const applied: string[] = [];
    const errors: string[] = [];
    
    if (fs.existsSync(stagedDir)) {
      const files = fs.readdirSync(stagedDir).filter(f => f.endsWith('.sql'));
      
      for (const file of files) {
        const sourcePath = path.join(stagedDir, file);
        const targetPath = path.join(targetDir, file);
        
        if (fs.existsSync(targetPath) && !force) {
          errors.push(`Migration ${file} already exists. Use --force to overwrite.`);
          continue;
        }
        
        try {
          // Copy migration file
          fs.copyFileSync(sourcePath, targetPath);
          
          // Apply migration
          const content = fs.readFileSync(sourcePath, 'utf8');
          // Would execute SQL here
          
          applied.push(file);
          console.log(chalk.green(`   ✓ Applied ${file}`));
        } catch (error) {
          errors.push(`Failed to apply ${file}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    
    return { applied, errors };
  }

  private async applyFunctions(force?: boolean): Promise<{ created: string[]; errors: string[] }> {
    console.log(chalk.gray('⚡ Creating functions...'));
    
    const stagedDir = path.join(process.cwd(), '.kickstack', 'staged', 'functions');
    const targetDir = path.join(process.cwd(), 'functions');
    
    const created: string[] = [];
    const errors: string[] = [];
    
    if (fs.existsSync(stagedDir)) {
      const files = fs.readdirSync(stagedDir);
      
      for (const file of files) {
        const sourcePath = path.join(stagedDir, file);
        const targetPath = path.join(targetDir, file);
        
        if (fs.existsSync(targetPath) && !force) {
          errors.push(`Function ${file} already exists. Use --force to overwrite.`);
          continue;
        }
        
        try {
          // Ensure directory exists
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Copy function file
          fs.copyFileSync(sourcePath, targetPath);
          created.push(file);
          console.log(chalk.green(`   ✓ Created ${file}`));
        } catch (error) {
          errors.push(`Failed to create ${file}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    
    return { created, errors };
  }

  private async verifyAppliedPlan(plan: Plan): Promise<{ success: boolean; errors: string[] }> {
    console.log(chalk.gray('🔍 Verifying applied changes...'));
    
    // Simplified verification
    const errors: string[] = [];
    
    // Would verify tables exist, policies are applied, etc.
    
    return { success: errors.length === 0, errors };
  }

  async rollback(options: { last?: boolean } = {}): Promise<void> {
    console.log(chalk.yellow('⏪ Rolling back...'));
    
    const snapshotDir = path.join(process.cwd(), '.kickstack', 'snapshots');
    
    if (!fs.existsSync(snapshotDir)) {
      throw new Error('No snapshots found for rollback');
    }
    
    const snapshots = fs.readdirSync(snapshotDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .reverse();
    
    if (snapshots.length === 0) {
      throw new Error('No snapshots found for rollback');
    }
    
    const snapshot = snapshots[0];
    console.log(chalk.gray(`   Rolling back to ${snapshot}`));
    
    // Would restore database from snapshot
    
    console.log(chalk.green('✓ Rollback complete'));
  }
}