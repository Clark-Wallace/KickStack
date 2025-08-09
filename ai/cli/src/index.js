#!/usr/bin/env node
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
const commander_1 = require("commander");
const add_table_1 = require("./commands/add-table");
const add_realtime_1 = require("./commands/add-realtime");
const add_policy_1 = require("./commands/add-policy");
const new_fn_1 = require("./commands/new-fn");
const gen_1 = require("./commands/gen");
const plan_1 = require("./commands/plan");
const apply_1 = require("./commands/apply");
const rollback_1 = require("./commands/rollback");
const deploy_1 = require("./commands/deploy");
const env_1 = require("./commands/env");
const generate_token_1 = require("./commands/generate-token");
const demo_1 = require("./commands/demo");
const template_1 = __importDefault(require("./commands/template"));
const seed_1 = require("./commands/seed");
const new_1 = require("./commands/new");
const evolve_1 = require("./commands/evolve");
const reload_schema_1 = require("./commands/reload-schema");
const error_handler_1 = require("./lib/error-handler");
const chalk_1 = __importDefault(require("chalk"));
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load environment variables from infra/.env
dotenv.config({ path: path.join(__dirname, '../../../infra/.env') });
// Validate environment on startup
(async () => {
    try {
        await error_handler_1.ErrorHandler.validateEnvironment();
    }
    catch (error) {
        // Environment validation errors are already handled by ErrorHandler
    }
})();
const program = new commander_1.Command();
program
    .name('kickstack')
    .description('KickStack AI-powered CLI - "Just Kick it"')
    .version('1.0.0');
// Register new AI-powered commands
(0, new_1.registerNewCommand)(program);
(0, evolve_1.registerEvolveCommand)(program);
program
    .command('add-table <description>')
    .description('Create a new table from natural language description')
    .option('--no-realtime', 'Skip creating realtime triggers')
    .action(async (description, options) => {
    try {
        await (0, add_table_1.addTableCommand)(description, options);
    }
    catch (error) {
        error_handler_1.ErrorHandler.handleError(error, { command: 'add-table', description, options });
    }
});
program
    .command('add-realtime <table>')
    .description('Add realtime triggers to an existing table')
    .action(async (table) => {
    try {
        await (0, add_realtime_1.addRealtimeCommand)(table);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('add-policy <preset> <table>')
    .description('Add Row-Level Security policies to a table')
    .option('--owner-col <column>', 'Specify the owner column name', 'user_id')
    .option('--add-owner-col', 'Add the owner column if it doesn\'t exist')
    .option('--org-col <column>', 'Specify the organization column name (for team_scope)', 'org_id')
    .option('--add-org-col', 'Add the organization column if it doesn\'t exist (for team_scope)')
    .action(async (preset, table, options) => {
    try {
        await (0, add_policy_1.addPolicyCommand)(preset, table, options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('new-fn <name>')
    .description('Create a new edge function')
    .option('--with-secret <name>', 'Add a secret environment variable')
    .action(async (name, options) => {
    try {
        await (0, new_fn_1.newFnCommand)(name, options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('gen <requirement>')
    .description('Generate a full-stack plan from natural language (plan only)')
    .option('--name <name>', 'Name for the generated plan')
    .action(async (requirement, options) => {
    try {
        await (0, gen_1.genCommand)(requirement, options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('plan')
    .description('Load and stage artifacts from an existing plan file')
    .requiredOption('--file <path>', 'Path to the plan YAML file')
    .action(async (options) => {
    try {
        await (0, plan_1.planCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('apply')
    .description('Apply a staged plan to the database and file system')
    .requiredOption('--file <path>', 'Path to the plan YAML file')
    .option('--force', 'Overwrite existing files and migrations')
    .option('--no-verify', 'Skip verification after apply')
    .action(async (options) => {
    try {
        await (0, apply_1.applyCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('rollback')
    .description('Rollback the database to a previous schema snapshot')
    .option('--last', 'Rollback to the last snapshot before apply')
    .action(async (options) => {
    try {
        await (0, rollback_1.rollbackCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('deploy')
    .description('Deploy KickStack to cloud platforms')
    .addCommand(program.createCommand('fly')
    .description('Deploy to Fly.io')
    .requiredOption('--profile <profile>', 'Deployment profile (cloud)')
    .option('--force', 'Force deployment even with warnings')
    .option('--skip-build', 'Skip build step')
    .action(async (options) => {
    try {
        await (0, deploy_1.deployFlyCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}));
// Add template command
program.addCommand(template_1.default);
// Add demo command
program
    .command('demo')
    .description('Manage KickStack demo applications')
    .addCommand(program.createCommand('list')
    .description('List available demo applications')
    .action(async () => {
    try {
        await demo_1.demoCommand.list();
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}))
    .addCommand(program.createCommand('up <name>')
    .description('Install a demo application locally')
    .option('--with-seed', 'Include sample seed data')
    .action(async (name, options) => {
    try {
        await demo_1.demoCommand.up(name, options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}))
    .addCommand(program.createCommand('deploy <name>')
    .description('Deploy a demo application to Fly.io')
    .action(async (name) => {
    try {
        await demo_1.demoCommand.deploy(name, {});
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}));
program
    .command('generate-token <type>')
    .description('Generate JWT tokens for testing (user, admin, service)')
    .option('--user-id <id>', 'User ID for the token')
    .option('--org-id <id>', 'Organization ID for the token')
    .option('--email <email>', 'Email for the token')
    .option('--expires-in <duration>', 'Token expiration (e.g., 24h, 7d, 60m)')
    .option('--claims <json>', 'Additional claims as JSON string')
    .action(async (type, options) => {
    try {
        if (options.claims) {
            try {
                options.claims = JSON.parse(options.claims);
            }
            catch (e) {
                console.error(chalk_1.default.red('Invalid JSON for claims'));
                process.exit(1);
            }
        }
        await (0, generate_token_1.generateTokenCommand)(type, options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('open')
    .description('Open deployed application in browser')
    .action(async () => {
    try {
        await (0, deploy_1.openCommand)();
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('seed')
    .description('Seed the database with demo data for testing')
    .option('--type <type>', `Data type to seed (${seed_1.seedTypes.join(', ')})`, 'all')
    .option('--clean', 'Clean existing demo data before seeding')
    .action(async (options) => {
    try {
        if (!(0, seed_1.validateSeedType)(options.type)) {
            console.error(chalk_1.default.red(`Invalid seed type: ${options.type}`));
            console.error(`Valid types: ${seed_1.seedTypes.join(', ')}`);
            process.exit(1);
        }
        await (0, seed_1.seedCommand)(options);
    }
    catch (error) {
        error_handler_1.ErrorHandler.handleError(error, { command: 'seed', options });
    }
});
program
    .command('reload-schema')
    .description('Reload PostgREST schema cache after database changes')
    .action(async () => {
    try {
        await (0, reload_schema_1.reloadSchemaCommand)();
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('env')
    .description('Manage environment configurations')
    .addCommand(program.createCommand('pull')
    .description('Pull environment variables from cloud')
    .requiredOption('--profile <profile>', 'Environment profile (cloud)')
    .action(async (options) => {
    try {
        await (0, env_1.envPullCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}))
    .addCommand(program.createCommand('push')
    .description('Push environment variables to cloud')
    .requiredOption('--profile <profile>', 'Environment profile (cloud)')
    .action(async (options) => {
    try {
        await (0, env_1.envPushCommand)(options);
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}));
program.parse(process.argv);
// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=index.js.map