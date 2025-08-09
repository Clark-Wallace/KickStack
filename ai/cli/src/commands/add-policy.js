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
exports.addPolicyCommand = addPolicyCommand;
const chalk_1 = __importDefault(require("chalk"));
const database_1 = require("../services/database");
const migration_1 = require("../services/migration");
const owner_1 = require("../policies/owner");
const public_read_1 = require("../policies/public_read");
const team_scope_1 = require("../policies/team_scope");
const admin_override_1 = require("../policies/admin_override");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function addPolicyCommand(preset, tableName, options) {
    // Support 'owner', 'public_read', 'team_scope', and 'admin_override' presets
    const validPresets = ['owner', 'public_read', 'team_scope', 'admin_override'];
    if (!validPresets.includes(preset)) {
        console.error(chalk_1.default.red(`❌ Unknown policy preset: ${preset}`));
        console.log(chalk_1.default.yellow('Available presets: ' + validPresets.join(', ')));
        process.exit(1);
    }
    console.log(chalk_1.default.blue('🔐 KickStack: Adding RLS policy...'));
    console.log(chalk_1.default.gray(`Preset: ${preset}`));
    console.log(chalk_1.default.gray(`Table: ${tableName}`));
    const ownerCol = options.ownerCol || 'user_id';
    const orgCol = options.orgCol || 'org_id';
    if (preset === 'team_scope') {
        console.log(chalk_1.default.gray(`Organization column: ${orgCol}`));
        console.log(chalk_1.default.gray(`Owner column: ${ownerCol}`));
    }
    else if (preset !== 'admin_override') {
        console.log(chalk_1.default.gray(`Owner column: ${ownerCol}`));
    }
    const db = new database_1.DatabaseService();
    const migrationService = new migration_1.MigrationService();
    try {
        // Check if table exists
        console.log(chalk_1.default.yellow(`🔍 Checking if table '${tableName}' exists...`));
        const tableExists = await db.tableExists(tableName);
        if (!tableExists) {
            console.error(chalk_1.default.red(`❌ Table '${tableName}' does not exist!`));
            console.log(chalk_1.default.yellow('Please create the table first using:'));
            console.log(chalk_1.default.gray(`  kickstack add-table "${tableName} with ..."`));
            process.exit(1);
        }
        // Check columns based on preset
        if (preset === 'team_scope') {
            // Check org column for team_scope
            console.log(chalk_1.default.yellow(`🔍 Checking if column '${orgCol}' exists...`));
            const orgColumnQuery = `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          AND column_name = '${orgCol}'
        );
      `;
            const orgColumnExists = await db.runQueryBoolean(orgColumnQuery);
            if (!orgColumnExists && !options.addOrgCol) {
                console.error(chalk_1.default.red(`❌ Column '${orgCol}' does not exist in table '${tableName}'!`));
                console.log(chalk_1.default.yellow('Options:'));
                console.log(chalk_1.default.gray(`  1. Add --add-org-col flag to create the column automatically`));
                console.log(chalk_1.default.gray(`  2. Specify a different column with --org-col <column_name>`));
                console.log(chalk_1.default.gray(`  3. Add the column manually first`));
                process.exit(1);
            }
            // Optionally check owner column for team_scope
            if (ownerCol) {
                console.log(chalk_1.default.yellow(`🔍 Checking if column '${ownerCol}' exists...`));
                const ownerColumnQuery = `
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = '${tableName}' 
            AND column_name = '${ownerCol}'
          );
        `;
                const ownerColumnExists = await db.runQueryBoolean(ownerColumnQuery);
                if (!ownerColumnExists && !options.addOwnerCol) {
                    console.log(chalk_1.default.yellow(`⚠️ Column '${ownerCol}' does not exist - team-wide access will be granted for writes`));
                }
            }
        }
        else if (preset !== 'admin_override') {
            // Check owner column for owner/public_read presets
            console.log(chalk_1.default.yellow(`🔍 Checking if column '${ownerCol}' exists...`));
            const columnCheckQuery = preset === 'owner'
                ? owner_1.OwnerPolicyGenerator.generateColumnCheckQuery(tableName, ownerCol)
                : public_read_1.PublicReadPolicyGenerator.generateColumnCheckQuery(tableName, ownerCol);
            const columnExists = await db.runQueryBoolean(columnCheckQuery);
            if (!columnExists && !options.addOwnerCol) {
                console.error(chalk_1.default.red(`❌ Column '${ownerCol}' does not exist in table '${tableName}'!`));
                console.log(chalk_1.default.yellow('Options:'));
                console.log(chalk_1.default.gray(`  1. Add --add-owner-col flag to create the column automatically`));
                console.log(chalk_1.default.gray(`  2. Specify a different column with --owner-col <column_name>`));
                console.log(chalk_1.default.gray(`  3. Add the column manually first`));
                process.exit(1);
            }
        }
        // Ensure auth helpers exist
        console.log(chalk_1.default.yellow('🔧 Ensuring auth helpers are installed...'));
        await ensureAuthHelpers(db, migrationService);
        // For team_scope and admin_override, ensure multi-tenancy helpers exist
        if (preset === 'team_scope' || preset === 'admin_override') {
            await ensureMultiTenancyHelpers(db, migrationService);
        }
        // Generate policies
        console.log(chalk_1.default.yellow('📝 Generating RLS policies...'));
        let policySql;
        if (preset === 'owner') {
            const policyOptions = {
                table: tableName,
                ownerCol: ownerCol,
                addOwnerCol: options.addOwnerCol
            };
            policySql = owner_1.OwnerPolicyGenerator.generatePolicies(policyOptions);
        }
        else if (preset === 'public_read') {
            const policyOptions = {
                table: tableName,
                ownerCol: ownerCol,
                addOwnerCol: options.addOwnerCol
            };
            policySql = public_read_1.PublicReadPolicyGenerator.generatePolicies(policyOptions);
        }
        else if (preset === 'team_scope') {
            policySql = team_scope_1.teamScopePolicy.generate(tableName, {
                orgCol: orgCol,
                ownerCol: ownerCol,
                addOrgCol: options.addOrgCol,
                addOwnerCol: options.addOwnerCol
            });
        }
        else if (preset === 'admin_override') {
            policySql = admin_override_1.adminOverridePolicy.generate(tableName, {});
        }
        else {
            throw new Error(`Unsupported preset: ${preset}`);
        }
        console.log(chalk_1.default.gray('\nGenerated SQL:'));
        console.log(chalk_1.default.cyan(policySql.substring(0, 500) + '...'));
        // Write migration file
        console.log(chalk_1.default.yellow('📝 Writing migration file...'));
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
        const migrationPath = await migrationService.writeMigration({
            tableName: `rls_${preset}_${tableName}`,
            sql: policySql
        });
        console.log(chalk_1.default.green(`✓ Migration saved to: ${migrationPath}`));
        // Apply migration
        console.log(chalk_1.default.yellow('🗄️  Applying policies to database...'));
        await db.executeMigration(policySql);
        console.log(chalk_1.default.green('✓ Policies applied successfully'));
        // List created policies
        const policiesQuery = `
      SELECT policyname, cmd 
      FROM pg_policies 
      WHERE tablename = '${tableName}'
      ORDER BY policyname;
    `;
        const policies = await db.runQuery(policiesQuery);
        console.log(chalk_1.default.green('\n✨ RLS enabled successfully!'));
        console.log(chalk_1.default.white('\n🔐 Security Configuration:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.cyan(`Table: ${tableName}`));
        console.log(chalk_1.default.cyan(`Preset: ${preset}`));
        if (preset === 'team_scope') {
            console.log(chalk_1.default.cyan(`Organization column: ${orgCol}`));
            console.log(chalk_1.default.cyan(`Owner column: ${ownerCol}`));
        }
        else if (preset !== 'admin_override') {
            console.log(chalk_1.default.cyan(`Owner column: ${ownerCol}`));
        }
        console.log(chalk_1.default.gray('\nPolicies created:'));
        if (preset === 'owner') {
            console.log(chalk_1.default.gray('  • select_own - Users see only their rows'));
            console.log(chalk_1.default.gray('  • insert_own - Users insert only their rows'));
            console.log(chalk_1.default.gray('  • update_own - Users update only their rows'));
            console.log(chalk_1.default.gray('  • delete_own - Users delete only their rows'));
        }
        else if (preset === 'public_read') {
            console.log(chalk_1.default.gray('  • select_public - Anyone can read all rows'));
            console.log(chalk_1.default.gray('  • insert_own - Users insert only their rows'));
            console.log(chalk_1.default.gray('  • update_own - Users update only their rows'));
            console.log(chalk_1.default.gray('  • delete_own - Users delete only their rows'));
        }
        else if (preset === 'team_scope') {
            console.log(chalk_1.default.gray('  • team_select - Users see all rows in their organization'));
            console.log(chalk_1.default.gray('  • team_insert - Users insert rows for their org (owner-restricted if owner column exists)'));
            console.log(chalk_1.default.gray('  • team_update - Users update rows in their org (owner-restricted if owner column exists)'));
            console.log(chalk_1.default.gray('  • team_delete - Users delete rows in their org (owner-restricted if owner column exists)'));
        }
        else if (preset === 'admin_override') {
            console.log(chalk_1.default.gray('  • admin_select - Admins can read all rows'));
            console.log(chalk_1.default.gray('  • admin_insert - Admins can insert any rows'));
            console.log(chalk_1.default.gray('  • admin_update - Admins can update any rows'));
            console.log(chalk_1.default.gray('  • admin_delete - Admins can delete any rows'));
        }
        console.log(chalk_1.default.gray('─'.repeat(50)));
        // Display usage example
        console.log(chalk_1.default.white('\n📖 Usage Example:'));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.green('# Get a JWT token (after login):'));
        console.log(chalk_1.default.gray(`curl -X POST http://localhost:9999/token?grant_type=password \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"password"}'`));
        console.log(chalk_1.default.green('\n# Use the token to access the API:'));
        console.log(chalk_1.default.gray(`curl http://localhost:3000/${tableName} \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`));
        console.log(chalk_1.default.green('\n# Insert a row (automatically owned by you):'));
        console.log(chalk_1.default.gray(`curl -X POST http://localhost:3000/${tableName} \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"${ownerCol}": "YOUR_USER_ID", "name": "Example"}'`));
        console.log(chalk_1.default.gray('─'.repeat(50)));
        console.log(chalk_1.default.yellow('\n⚠️  Important Notes:'));
        if (preset === 'owner') {
            console.log(chalk_1.default.gray(`• Anonymous users cannot access this table`));
            console.log(chalk_1.default.gray(`• Each user can only see/modify their own rows`));
            console.log(chalk_1.default.gray(`• The ${ownerCol} column must match the JWT 'sub' claim`));
            console.log(chalk_1.default.green('\n✅ Done! Your table is now secured with owner-based RLS.'));
        }
        else if (preset === 'public_read') {
            console.log(chalk_1.default.gray(`• Anonymous users can read all rows (public read)`));
            console.log(chalk_1.default.gray(`• Only authenticated users can insert/update/delete`));
            console.log(chalk_1.default.gray(`• Users can only modify their own rows`));
            console.log(chalk_1.default.gray(`• The ${ownerCol} column must match the JWT 'sub' claim for writes`));
            console.log(chalk_1.default.green('\n✅ Done! Your table is now secured with public-read RLS.'));
        }
        else if (preset === 'team_scope') {
            console.log(chalk_1.default.gray(`• Users can see all rows in their organization`));
            console.log(chalk_1.default.gray(`• The ${orgCol} column must match the JWT 'org' or 'org_id' claim`));
            if (ownerCol) {
                console.log(chalk_1.default.gray(`• Users can only modify rows they own (${ownerCol} = JWT 'sub' claim)`));
            }
            else {
                console.log(chalk_1.default.gray(`• All users in the organization can modify any row`));
            }
            console.log(chalk_1.default.gray(`• Admins bypass all restrictions`));
            console.log(chalk_1.default.green('\n✅ Done! Your table is now secured with team-scoped RLS.'));
        }
        else if (preset === 'admin_override') {
            console.log(chalk_1.default.gray(`• This adds admin bypass to existing policies`));
            console.log(chalk_1.default.gray(`• Tokens with role='admin' or 'service_role' get full access`));
            console.log(chalk_1.default.gray(`• Apply this AFTER other policies (owner, public_read, team_scope)`));
            console.log(chalk_1.default.gray(`• Policies combine with OR logic - admins always have access`));
            console.log(chalk_1.default.green('\n✅ Done! Admin override policies have been added.'));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('\n❌ Error adding policy:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
async function ensureAuthHelpers(db, migrationService) {
    // Check if auth_uid function exists
    const checkQuery = `
    SELECT EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'auth_uid'
    );
  `;
    const exists = await db.runQueryBoolean(checkQuery);
    if (!exists) {
        console.log(chalk_1.default.yellow('Installing auth helper functions...'));
        // Read and apply auth helpers migration
        const authHelpersPath = path.join(__dirname, '../../../../infra/migrations/0000_auth_helpers.sql');
        if (fs.existsSync(authHelpersPath)) {
            const authHelpersSql = fs.readFileSync(authHelpersPath, 'utf8');
            await db.executeMigration(authHelpersSql);
            console.log(chalk_1.default.green('✓ Auth helpers installed'));
        }
        else {
            throw new Error('Auth helpers migration file not found');
        }
    }
    else {
        console.log(chalk_1.default.green('✓ Auth helpers already installed'));
    }
}
async function ensureMultiTenancyHelpers(db, migrationService) {
    // Check if auth_org and is_admin functions exist
    const checkQuery = `
    SELECT 
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auth_org') as has_auth_org,
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') as has_is_admin;
  `;
    const result = await db.runQueryJson(checkQuery);
    const hasAuthOrg = result.rows[0]?.has_auth_org;
    const hasIsAdmin = result.rows[0]?.has_is_admin;
    if (!hasAuthOrg || !hasIsAdmin) {
        console.log(chalk_1.default.yellow('Installing multi-tenancy helper functions...'));
        // Read and apply multi-tenancy helpers migration
        const multiTenancyPath = path.join(__dirname, '../../../../infra/migrations/0001_auth_org_admin.sql');
        if (fs.existsSync(multiTenancyPath)) {
            const multiTenancySql = fs.readFileSync(multiTenancyPath, 'utf8');
            await db.executeMigration(multiTenancySql);
            console.log(chalk_1.default.green('✓ Multi-tenancy helpers installed'));
        }
        else {
            throw new Error('Multi-tenancy helpers migration file not found');
        }
    }
    else {
        console.log(chalk_1.default.green('✓ Multi-tenancy helpers already installed'));
    }
}
//# sourceMappingURL=add-policy.js.map