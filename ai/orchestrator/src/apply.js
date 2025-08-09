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
exports.ApplyService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const database_1 = require("../../cli/src/services/database");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ApplyService {
    db;
    constructor() {
        this.db = new database_1.DatabaseService();
    }
    async apply(plan, options = {}) {
        console.log(chalk_1.default.blue('🚀 Applying plan...'));
        const result = {
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
            console.log(chalk_1.default.green('✓ Plan applied successfully!'));
            // Print what was created
            if (result.appliedMigrations.length > 0) {
                console.log(chalk_1.default.white('\n📄 Applied Migrations:'));
                result.appliedMigrations.forEach(m => {
                    console.log(chalk_1.default.gray(`  • ${m}`));
                });
            }
            if (result.createdFunctions.length > 0) {
                console.log(chalk_1.default.white('\n⚡ Created Functions:'));
                result.createdFunctions.forEach(f => {
                    console.log(chalk_1.default.gray(`  • ${f}`));
                });
                console.log(chalk_1.default.yellow('\n💡 Reminder: Restart the Functions Gateway to load new functions:'));
                console.log(chalk_1.default.gray('  npm run fngw:dev'));
            }
            return result;
        }
        catch (error) {
            console.error(chalk_1.default.red('Apply failed:'), error);
            result.success = false;
            result.errors = [error instanceof Error ? error.message : String(error)];
            return result;
        }
    }
    async applyMigrations(force = false) {
        const stagingDir = path.join(process.cwd(), 'infra', 'migrations', '_staged');
        const targetDir = path.join(process.cwd(), 'infra', 'migrations');
        const applied = [];
        const errors = [];
        if (!fs.existsSync(stagingDir)) {
            console.log(chalk_1.default.yellow('No staged migrations found'));
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
                console.log(chalk_1.default.gray(`  Applying migration: ${file}`));
                await this.db.executeMigration(sql);
                // Move file from staging to migrations
                fs.renameSync(sourcePath, targetPath);
                applied.push(file);
            }
            catch (error) {
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
    async applyFunctions(force = false) {
        const stagingDir = path.join(process.cwd(), 'api', 'functions', '_staged');
        const targetDir = path.join(process.cwd(), 'api', 'functions');
        const created = [];
        const errors = [];
        if (!fs.existsSync(stagingDir)) {
            console.log(chalk_1.default.yellow('No staged functions found'));
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
                console.log(chalk_1.default.gray(`  Creating function: ${file}`));
                fs.renameSync(sourcePath, targetPath);
                created.push(file.replace(/\.(ts|js)$/, ''));
            }
            catch (error) {
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
    async saveSchemaSnapshot() {
        const snapshotDir = path.join(process.cwd(), '.kickstack', 'snapshots');
        fs.mkdirSync(snapshotDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
        const snapshotPath = path.join(snapshotDir, `schema_${timestamp}.sql`);
        try {
            // Use pg_dump to save schema
            const dockerCmd = `docker compose -f infra/docker-compose.yml exec -T postgres pg_dump -U kick -d kickstack --schema-only`;
            const { stdout } = await execAsync(dockerCmd);
            fs.writeFileSync(snapshotPath, stdout);
            console.log(chalk_1.default.gray(`  Schema snapshot saved: ${path.basename(snapshotPath)}`));
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
        }
        catch (error) {
            console.warn(chalk_1.default.yellow('Warning: Could not save schema snapshot'));
        }
    }
    async rollback() {
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
        console.log(chalk_1.default.yellow(`🔄 Rolling back to: ${latestSnapshot}`));
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
            console.log(chalk_1.default.green('✓ Rollback completed successfully'));
            // Remove used snapshot
            fs.unlinkSync(snapshotPath);
        }
        catch (error) {
            console.error(chalk_1.default.red('Rollback failed:'), error);
            throw error;
        }
    }
}
exports.ApplyService = ApplyService;
//# sourceMappingURL=apply.js.map