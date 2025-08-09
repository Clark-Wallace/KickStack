import chalk from 'chalk';
import { DatabaseService } from '../services/database';
import { MigrationService } from '../services/migration';
import { OwnerPolicyGenerator, OwnerPolicyOptions } from '../policies/owner';
import { PublicReadPolicyGenerator, PublicReadPolicyOptions } from '../policies/public_read';
import { teamScopePolicy } from '../policies/team_scope';
import { adminOverridePolicy } from '../policies/admin_override';
import * as fs from 'fs';
import * as path from 'path';

interface AddPolicyOptions {
  ownerCol?: string;
  addOwnerCol?: boolean;
  orgCol?: string;
  addOrgCol?: boolean;
}

export async function addPolicyCommand(
  preset: string, 
  tableName: string, 
  options: AddPolicyOptions
): Promise<void> {
  // Support 'owner', 'public_read', 'team_scope', and 'admin_override' presets
  const validPresets = ['owner', 'public_read', 'team_scope', 'admin_override'];
  if (!validPresets.includes(preset)) {
    console.error(chalk.red(`❌ Unknown policy preset: ${preset}`));
    console.log(chalk.yellow('Available presets: ' + validPresets.join(', ')));
    process.exit(1);
  }

  console.log(chalk.blue('🔐 KickStack: Adding RLS policy...'));
  console.log(chalk.gray(`Preset: ${preset}`));
  console.log(chalk.gray(`Table: ${tableName}`));
  
  const ownerCol = options.ownerCol || 'user_id';
  const orgCol = options.orgCol || 'org_id';
  
  if (preset === 'team_scope') {
    console.log(chalk.gray(`Organization column: ${orgCol}`));
    console.log(chalk.gray(`Owner column: ${ownerCol}`));
  } else if (preset !== 'admin_override') {
    console.log(chalk.gray(`Owner column: ${ownerCol}`));
  }
  
  const db = new DatabaseService();
  const migrationService = new MigrationService();
  
  try {
    // Check if table exists
    console.log(chalk.yellow(`🔍 Checking if table '${tableName}' exists...`));
    const tableExists = await db.tableExists(tableName);
    
    if (!tableExists) {
      console.error(chalk.red(`❌ Table '${tableName}' does not exist!`));
      console.log(chalk.yellow('Please create the table first using:'));
      console.log(chalk.gray(`  kickstack add-table "${tableName} with ..."`));
      process.exit(1);
    }
    
    // Check columns based on preset
    if (preset === 'team_scope') {
      // Check org column for team_scope
      console.log(chalk.yellow(`🔍 Checking if column '${orgCol}' exists...`));
      const orgColumnQuery = `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          AND column_name = '${orgCol}'
        );
      `;
      const orgColumnExists = await db.runQueryBoolean(orgColumnQuery);
      
      if (!orgColumnExists && !options.addOrgCol) {
        console.error(chalk.red(`❌ Column '${orgCol}' does not exist in table '${tableName}'!`));
        console.log(chalk.yellow('Options:'));
        console.log(chalk.gray(`  1. Add --add-org-col flag to create the column automatically`));
        console.log(chalk.gray(`  2. Specify a different column with --org-col <column_name>`));
        console.log(chalk.gray(`  3. Add the column manually first`));
        process.exit(1);
      }
      
      // Optionally check owner column for team_scope
      if (ownerCol) {
        console.log(chalk.yellow(`🔍 Checking if column '${ownerCol}' exists...`));
        const ownerColumnQuery = `
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = '${tableName}' 
            AND column_name = '${ownerCol}'
          );
        `;
        const ownerColumnExists = await db.runQueryBoolean(ownerColumnQuery);
        
        if (!ownerColumnExists && !options.addOwnerCol) {
          console.log(chalk.yellow(`⚠️ Column '${ownerCol}' does not exist - team-wide access will be granted for writes`));
        }
      }
    } else if (preset !== 'admin_override') {
      // Check owner column for owner/public_read presets
      console.log(chalk.yellow(`🔍 Checking if column '${ownerCol}' exists...`));
      const columnCheckQuery = preset === 'owner' 
        ? OwnerPolicyGenerator.generateColumnCheckQuery(tableName, ownerCol)
        : PublicReadPolicyGenerator.generateColumnCheckQuery(tableName, ownerCol);
      const columnExists = await db.runQueryBoolean(columnCheckQuery);
      
      if (!columnExists && !options.addOwnerCol) {
        console.error(chalk.red(`❌ Column '${ownerCol}' does not exist in table '${tableName}'!`));
        console.log(chalk.yellow('Options:'));
        console.log(chalk.gray(`  1. Add --add-owner-col flag to create the column automatically`));
        console.log(chalk.gray(`  2. Specify a different column with --owner-col <column_name>`));
        console.log(chalk.gray(`  3. Add the column manually first`));
        process.exit(1);
      }
    }
    
    // Ensure auth helpers exist
    console.log(chalk.yellow('🔧 Ensuring auth helpers are installed...'));
    await ensureAuthHelpers(db, migrationService);
    
    // For team_scope and admin_override, ensure multi-tenancy helpers exist
    if (preset === 'team_scope' || preset === 'admin_override') {
      await ensureMultiTenancyHelpers(db, migrationService);
    }
    
    // Generate policies
    console.log(chalk.yellow('📝 Generating RLS policies...'));
    let policySql: string;
    
    if (preset === 'owner') {
      const policyOptions: OwnerPolicyOptions = {
        table: tableName,
        ownerCol: ownerCol,
        addOwnerCol: options.addOwnerCol
      };
      policySql = OwnerPolicyGenerator.generatePolicies(policyOptions);
    } else if (preset === 'public_read') {
      const policyOptions: PublicReadPolicyOptions = {
        table: tableName,
        ownerCol: ownerCol,
        addOwnerCol: options.addOwnerCol
      };
      policySql = PublicReadPolicyGenerator.generatePolicies(policyOptions);
    } else if (preset === 'team_scope') {
      policySql = teamScopePolicy.generate(tableName, {
        orgCol: orgCol,
        ownerCol: ownerCol,
        addOrgCol: options.addOrgCol,
        addOwnerCol: options.addOwnerCol
      });
    } else if (preset === 'admin_override') {
      policySql = adminOverridePolicy.generate(tableName, {});
    } else {
      throw new Error(`Unsupported preset: ${preset}`);
    }
    
    console.log(chalk.gray('\nGenerated SQL:'));
    console.log(chalk.cyan(policySql.substring(0, 500) + '...'));
    
    // Write migration file
    console.log(chalk.yellow('📝 Writing migration file...'));
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
    const migrationPath = await migrationService.writeMigration({
      tableName: `rls_${preset}_${tableName}`,
      sql: policySql
    });
    console.log(chalk.green(`✓ Migration saved to: ${migrationPath}`));
    
    // Apply migration
    console.log(chalk.yellow('🗄️  Applying policies to database...'));
    await db.executeMigration(policySql);
    console.log(chalk.green('✓ Policies applied successfully'));
    
    // List created policies
    const policiesQuery = `
      SELECT policyname, cmd 
      FROM pg_policies 
      WHERE tablename = '${tableName}'
      ORDER BY policyname;
    `;
    const policies = await db.runQuery(policiesQuery);
    
    console.log(chalk.green('\n✨ RLS enabled successfully!'));
    console.log(chalk.white('\n🔐 Security Configuration:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.cyan(`Table: ${tableName}`));
    console.log(chalk.cyan(`Preset: ${preset}`));
    
    if (preset === 'team_scope') {
      console.log(chalk.cyan(`Organization column: ${orgCol}`));
      console.log(chalk.cyan(`Owner column: ${ownerCol}`));
    } else if (preset !== 'admin_override') {
      console.log(chalk.cyan(`Owner column: ${ownerCol}`));
    }
    
    console.log(chalk.gray('\nPolicies created:'));
    
    if (preset === 'owner') {
      console.log(chalk.gray('  • select_own - Users see only their rows'));
      console.log(chalk.gray('  • insert_own - Users insert only their rows'));
      console.log(chalk.gray('  • update_own - Users update only their rows'));
      console.log(chalk.gray('  • delete_own - Users delete only their rows'));
    } else if (preset === 'public_read') {
      console.log(chalk.gray('  • select_public - Anyone can read all rows'));
      console.log(chalk.gray('  • insert_own - Users insert only their rows'));
      console.log(chalk.gray('  • update_own - Users update only their rows'));
      console.log(chalk.gray('  • delete_own - Users delete only their rows'));
    } else if (preset === 'team_scope') {
      console.log(chalk.gray('  • team_select - Users see all rows in their organization'));
      console.log(chalk.gray('  • team_insert - Users insert rows for their org (owner-restricted if owner column exists)'));
      console.log(chalk.gray('  • team_update - Users update rows in their org (owner-restricted if owner column exists)'));
      console.log(chalk.gray('  • team_delete - Users delete rows in their org (owner-restricted if owner column exists)'));
    } else if (preset === 'admin_override') {
      console.log(chalk.gray('  • admin_select - Admins can read all rows'));
      console.log(chalk.gray('  • admin_insert - Admins can insert any rows'));
      console.log(chalk.gray('  • admin_update - Admins can update any rows'));
      console.log(chalk.gray('  • admin_delete - Admins can delete any rows'));
    }
    
    console.log(chalk.gray('─'.repeat(50)));
    
    // Display usage example
    console.log(chalk.white('\n📖 Usage Example:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.green('# Get a JWT token (after login):'));
    console.log(chalk.gray(`curl -X POST http://localhost:9999/token?grant_type=password \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"password"}'`));
    
    console.log(chalk.green('\n# Use the token to access the API:'));
    console.log(chalk.gray(`curl http://localhost:3000/${tableName} \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`));
    
    console.log(chalk.green('\n# Insert a row (automatically owned by you):'));
    console.log(chalk.gray(`curl -X POST http://localhost:3000/${tableName} \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"${ownerCol}": "YOUR_USER_ID", "name": "Example"}'`));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.yellow('\n⚠️  Important Notes:'));
    
    if (preset === 'owner') {
      console.log(chalk.gray(`• Anonymous users cannot access this table`));
      console.log(chalk.gray(`• Each user can only see/modify their own rows`));
      console.log(chalk.gray(`• The ${ownerCol} column must match the JWT 'sub' claim`));
      console.log(chalk.green('\n✅ Done! Your table is now secured with owner-based RLS.'));
    } else if (preset === 'public_read') {
      console.log(chalk.gray(`• Anonymous users can read all rows (public read)`));
      console.log(chalk.gray(`• Only authenticated users can insert/update/delete`));
      console.log(chalk.gray(`• Users can only modify their own rows`));
      console.log(chalk.gray(`• The ${ownerCol} column must match the JWT 'sub' claim for writes`));
      console.log(chalk.green('\n✅ Done! Your table is now secured with public-read RLS.'));
    } else if (preset === 'team_scope') {
      console.log(chalk.gray(`• Users can see all rows in their organization`));
      console.log(chalk.gray(`• The ${orgCol} column must match the JWT 'org' or 'org_id' claim`));
      if (ownerCol) {
        console.log(chalk.gray(`• Users can only modify rows they own (${ownerCol} = JWT 'sub' claim)`));
      } else {
        console.log(chalk.gray(`• All users in the organization can modify any row`));
      }
      console.log(chalk.gray(`• Admins bypass all restrictions`));
      console.log(chalk.green('\n✅ Done! Your table is now secured with team-scoped RLS.'));
    } else if (preset === 'admin_override') {
      console.log(chalk.gray(`• This adds admin bypass to existing policies`));
      console.log(chalk.gray(`• Tokens with role='admin' or 'service_role' get full access`));
      console.log(chalk.gray(`• Apply this AFTER other policies (owner, public_read, team_scope)`));
      console.log(chalk.gray(`• Policies combine with OR logic - admins always have access`));
      console.log(chalk.green('\n✅ Done! Admin override policies have been added.'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error adding policy:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function ensureAuthHelpers(db: DatabaseService, migrationService: MigrationService): Promise<void> {
  // Check if auth_uid function exists
  const checkQuery = `
    SELECT EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'auth_uid'
    );
  `;
  
  const exists = await db.runQueryBoolean(checkQuery);
  
  if (!exists) {
    console.log(chalk.yellow('Installing auth helper functions...'));
    
    // Read and apply auth helpers migration
    const authHelpersPath = path.join(__dirname, '../../../../infra/migrations/0000_auth_helpers.sql');
    if (fs.existsSync(authHelpersPath)) {
      const authHelpersSql = fs.readFileSync(authHelpersPath, 'utf8');
      await db.executeMigration(authHelpersSql);
      console.log(chalk.green('✓ Auth helpers installed'));
    } else {
      throw new Error('Auth helpers migration file not found');
    }
  } else {
    console.log(chalk.green('✓ Auth helpers already installed'));
  }
}

async function ensureMultiTenancyHelpers(db: DatabaseService, migrationService: MigrationService): Promise<void> {
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
    console.log(chalk.yellow('Installing multi-tenancy helper functions...'));
    
    // Read and apply multi-tenancy helpers migration
    const multiTenancyPath = path.join(__dirname, '../../../../infra/migrations/0001_auth_org_admin.sql');
    if (fs.existsSync(multiTenancyPath)) {
      const multiTenancySql = fs.readFileSync(multiTenancyPath, 'utf8');
      await db.executeMigration(multiTenancySql);
      console.log(chalk.green('✓ Multi-tenancy helpers installed'));
    } else {
      throw new Error('Multi-tenancy helpers migration file not found');
    }
  } else {
    console.log(chalk.green('✓ Multi-tenancy helpers already installed'));
  }
}