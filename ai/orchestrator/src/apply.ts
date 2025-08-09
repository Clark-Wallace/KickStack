import { Plan, ApplyResult } from './types';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { DatabaseService } from '../../cli/src/services/database';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ApplyService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
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
        result.errors = [...(result.errors || []), ...functionResult.errors];
        result.success = false;
        return result;
      }

      console.log(chalk.green('✓ Plan applied successfully!'));
      
      // Print what was created
      if (result.appliedMigrations.length > 0) {
        console.log(chalk.white('\n📄 Applied Migrations:'));
        result.appliedMigrations.forEach(m => {
          console.log(chalk.gray(`  • ${m}`));
        });
      }
      
      if (result.createdFunctions.length > 0) {
        console.log(chalk.white('\n⚡ Created Functions:'));
        result.createdFunctions.forEach(f => {
          console.log(chalk.gray(`  • ${f}`));
        });
        
        console.log(chalk.yellow('\n💡 Reminder: Restart the Functions Gateway to load new functions:'));
        console.log(chalk.gray('  npm run fngw:dev'));
      }

      return result;
      
    } catch (error) {
      console.error(chalk.red('Apply failed:'), error);
      result.success = false;
      result.errors = [error instanceof Error ? error.message : String(error)];
      return result;
    }
  }

  private async applyMigrations(force: boolean = false): Promise<{ applied: string[]; errors: string[] }> {
    const stagingDir = path.join(process.cwd(), 'infra', 'migrations', '_staged');
    const targetDir = path.join(process.cwd(), 'infra', 'migrations');
    
    const applied: string[] = [];
    const errors: string[] = [];
    
    if (!fs.existsSync(stagingDir)) {
      console.log(chalk.yellow('No staged migrations found'));
      return { applied, errors };
    }
    
    const files = fs.readdirSync(stagingDir).filter(f => f.endsWith('.sql'));
    
    for (const file of files) {
      const sourcePath = path.join(stagingDir, file);
      const targetPath = path.join(targetDir, file);
      
      // Check if file already exists
      if (fs.existsSync(targetPath) && !force) {
        errors.push(`Migration ${file} already exists. Use --force to overwrite.`);
        continue;
      }
      
      try {
        // Read migration content
        const sql = fs.readFileSync(sourcePath, 'utf8');
        
        // Apply to database
        console.log(chalk.gray(`  Applying migration: ${file}`));
        await this.db.executeMigration(sql);
        
        // Move file from staging to migrations
        fs.renameSync(sourcePath, targetPath);
        applied.push(file);
        
      } catch (error) {
        errors.push(`Failed to apply ${file}: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    // Clean up staging directory if empty
    const remaining = fs.readdirSync(stagingDir);
    if (remaining.length === 0) {
      fs.rmdirSync(stagingDir);
    }
    
    return { applied, errors };
  }

  private async applyFunctions(force: boolean = false): Promise<{ created: string[]; errors: string[] }> {
    const stagingDir = path.join(process.cwd(), 'api', 'functions', '_staged');
    const targetDir = path.join(process.cwd(), 'api', 'functions');
    
    const created: string[] = [];
    const errors: string[] = [];
    
    if (!fs.existsSync(stagingDir)) {
      console.log(chalk.yellow('No staged functions found'));
      return { created, errors };
    }
    
    const files = fs.readdirSync(stagingDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    
    for (const file of files) {
      const sourcePath = path.join(stagingDir, file);
      const targetPath = path.join(targetDir, file);
      
      // Check if file already exists
      if (fs.existsSync(targetPath) && !force) {
        errors.push(`Function ${file} already exists. Use --force to overwrite.`);
        continue;
      }
      
      try {
        // Move file from staging to functions
        console.log(chalk.gray(`  Creating function: ${file}`));
        fs.renameSync(sourcePath, targetPath);
        created.push(file.replace(/\.(ts|js)$/, ''));
        
      } catch (error) {
        errors.push(`Failed to create ${file}: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    // Clean up staging directory if empty
    const remaining = fs.readdirSync(stagingDir);
    if (remaining.length === 0) {
      fs.rmdirSync(stagingDir);
    }
    
    return { created, errors };
  }

  private async saveSchemaSnapshot(): Promise<void> {
    const snapshotDir = path.join(process.cwd(), '.kickstack', 'snapshots');
    fs.mkdirSync(snapshotDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
    const snapshotPath = path.join(snapshotDir, `schema_${timestamp}.sql`);
    
    try {
      // Use pg_dump to save schema
      const dockerCmd = `docker compose -f infra/docker-compose.yml exec -T postgres pg_dump -U kick -d kickstack --schema-only`;
      const { stdout } = await execAsync(dockerCmd);
      
      fs.writeFileSync(snapshotPath, stdout);
      console.log(chalk.gray(`  Schema snapshot saved: ${path.basename(snapshotPath)}`));
      
      // Keep only last 5 snapshots
      const snapshots = fs.readdirSync(snapshotDir)
        .filter(f => f.startsWith('schema_'))
        .sort()
        .reverse();
      
      if (snapshots.length > 5) {
        for (const old of snapshots.slice(5)) {
          fs.unlinkSync(path.join(snapshotDir, old));
        }
      }
      
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not save schema snapshot'));
    }
  }

  async rollback(): Promise<void> {
    const snapshotDir = path.join(process.cwd(), '.kickstack', 'snapshots');
    
    if (!fs.existsSync(snapshotDir)) {
      throw new Error('No snapshots available for rollback');
    }
    
    const snapshots = fs.readdirSync(snapshotDir)
      .filter(f => f.startsWith('schema_'))
      .sort()
      .reverse();
    
    if (snapshots.length === 0) {
      throw new Error('No snapshots available for rollback');
    }
    
    const latestSnapshot = snapshots[0];
    const snapshotPath = path.join(snapshotDir, latestSnapshot);
    
    console.log(chalk.yellow(`🔄 Rolling back to: ${latestSnapshot}`));
    
    try {
      // Drop and recreate schema
      const dropCmd = `docker compose -f infra/docker-compose.yml exec -T postgres psql -U kick -d kickstack -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`;
      await execAsync(dropCmd);
      
      // Restore from snapshot
      const restoreCmd = `docker compose -f infra/docker-compose.yml exec -T postgres psql -U kick -d kickstack`;
      const schemaSQL = fs.readFileSync(snapshotPath, 'utf8');
      
      // Execute via stdin
      const { stderr } = await execAsync(restoreCmd, { input: schemaSQL });
      
      if (stderr && !stderr.includes('NOTICE')) {
        throw new Error(`Rollback failed: ${stderr}`);
      }
      
      console.log(chalk.green('✓ Rollback completed successfully'));
      
      // Remove used snapshot
      fs.unlinkSync(snapshotPath);
      
    } catch (error) {
      console.error(chalk.red('Rollback failed:'), error);
      throw error;
    }
  }
}