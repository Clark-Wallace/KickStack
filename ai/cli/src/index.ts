#!/usr/bin/env node
import { Command } from 'commander';
import { addTableCommand } from './commands/add-table';
import { addRealtimeCommand } from './commands/add-realtime';
import { addPolicyCommand } from './commands/add-policy';
import { newFnCommand } from './commands/new-fn';
import { genCommand } from './commands/gen';
import { planCommand } from './commands/plan';
import { applyCommand } from './commands/apply';
import { rollbackCommand } from './commands/rollback';
import { deployFlyCommand, openCommand } from './commands/deploy';
import { envPullCommand, envPushCommand } from './commands/env';
import templateCommand from './commands/template';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from infra/.env
dotenv.config({ path: path.join(__dirname, '../../../infra/.env') });

const program = new Command();

program
  .name('kickstack')
  .description('KickStack AI-powered CLI - "Just Kick it"')
  .version('1.0.0');

program
  .command('add-table <description>')
  .description('Create a new table from natural language description')
  .option('--no-realtime', 'Skip creating realtime triggers')
  .action(async (description: string, options: { realtime: boolean }) => {
    try {
      await addTableCommand(description, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('add-realtime <table>')
  .description('Add realtime triggers to an existing table')
  .action(async (table: string) => {
    try {
      await addRealtimeCommand(table);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('add-policy <preset> <table>')
  .description('Add Row-Level Security policies to a table')
  .option('--owner-col <column>', 'Specify the owner column name', 'user_id')
  .option('--add-owner-col', 'Add the owner column if it doesn\'t exist')
  .action(async (preset: string, table: string, options: any) => {
    try {
      await addPolicyCommand(preset, table, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('new-fn <name>')
  .description('Create a new edge function')
  .option('--with-secret <name>', 'Add a secret environment variable')
  .action(async (name: string, options: any) => {
    try {
      await newFnCommand(name, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('gen <requirement>')
  .description('Generate a full-stack plan from natural language (plan only)')
  .option('--name <name>', 'Name for the generated plan')
  .action(async (requirement: string, options: any) => {
    try {
      await genCommand(requirement, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('plan')
  .description('Load and stage artifacts from an existing plan file')
  .requiredOption('--file <path>', 'Path to the plan YAML file')
  .action(async (options: any) => {
    try {
      await planCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Apply a staged plan to the database and file system')
  .requiredOption('--file <path>', 'Path to the plan YAML file')
  .option('--force', 'Overwrite existing files and migrations')
  .option('--no-verify', 'Skip verification after apply')
  .action(async (options: any) => {
    try {
      await applyCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('Rollback the database to a previous schema snapshot')
  .option('--last', 'Rollback to the last snapshot before apply')
  .action(async (options: any) => {
    try {
      await rollbackCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Deploy KickStack to cloud platforms')
  .addCommand(
    program.createCommand('fly')
      .description('Deploy to Fly.io')
      .requiredOption('--profile <profile>', 'Deployment profile (cloud)')
      .option('--force', 'Force deployment even with warnings')
      .option('--skip-build', 'Skip build step')
      .action(async (options: any) => {
        try {
          await deployFlyCommand(options);
        } catch (error) {
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
          process.exit(1);
        }
      })
  );

// Add template command
program.addCommand(templateCommand);

program
  .command('open')
  .description('Open deployed application in browser')
  .action(async () => {
    try {
      await openCommand();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('env')
  .description('Manage environment configurations')
  .addCommand(
    program.createCommand('pull')
      .description('Pull environment variables from cloud')
      .requiredOption('--profile <profile>', 'Environment profile (cloud)')
      .action(async (options: any) => {
        try {
          await envPullCommand(options);
        } catch (error) {
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    program.createCommand('push')
      .description('Push environment variables to cloud')
      .requiredOption('--profile <profile>', 'Environment profile (cloud)')
      .action(async (options: any) => {
        try {
          await envPushCommand(options);
        } catch (error) {
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
          process.exit(1);
        }
      })
  );

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}