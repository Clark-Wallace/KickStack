#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { TemplateManager } from '../lib/template-manager';

const program = new Command();

program
  .name('template')
  .description('KickStack Template & Module Marketplace')
  .version('1.0.0');

program
  .command('search')
  .description('Search available templates')
  .argument('[query]', 'Search query (name, tags, category)')
  .option('-c, --category <category>', 'Filter by category')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('--verified-only', 'Show only verified templates')
  .action(async (query, options) => {
    try {
      const manager = new TemplateManager();
      const results = await manager.searchTemplates(query, options);
      
      if (results.length === 0) {
        console.log(chalk.yellow('No templates found matching your criteria.'));
        return;
      }

      console.log(chalk.blue(`\n🔍 Found ${results.length} template(s):\n`));
      
      for (const template of results) {
        const verifiedBadge = template.verified ? chalk.green('✓ VERIFIED') : chalk.gray('unverified');
        console.log(`${chalk.bold(template.name)} ${verifiedBadge}`);
        console.log(`  ${template.description}`);
        console.log(`  Category: ${template.category} | Tags: ${template.tags.join(', ')}`);
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('Error searching templates:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('info')
  .description('View template details')
  .argument('<name>', 'Template name')
  .action(async (name) => {
    try {
      const manager = new TemplateManager();
      const info = await manager.getTemplateInfo(name);
      
      const verifiedBadge = info.verified ? chalk.green('✓ VERIFIED') : chalk.gray('unverified');
      
      console.log(`\n${chalk.bold(info.display_name)} ${verifiedBadge}`);
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`${chalk.bold('Name:')} ${info.name}`);
      console.log(`${chalk.bold('Description:')} ${info.description}`);
      console.log(`${chalk.bold('Category:')} ${info.category}`);
      console.log(`${chalk.bold('Tags:')} ${info.tags.join(', ')}`);
      console.log(`${chalk.bold('Author:')} ${(info as any).author || 'Unknown'}`);
      console.log(`${chalk.bold('License:')} ${(info as any).license || 'Unknown'}`);
      console.log(`${chalk.bold('Min Version:')} ${(info as any).kickstack_min_version || '1.0.0'}`);
      
      if ((info as any).contents) {
        console.log(`\n${chalk.bold('Contents:')}`);
        if ((info as any).contents.tables?.length) {
          console.log(`  ${chalk.blue('Tables:')} ${(info as any).contents.tables.join(', ')}`);
        }
        if ((info as any).contents.policies?.length) {
          console.log(`  ${chalk.blue('Policies:')} ${(info as any).contents.policies.join(', ')}`);
        }
        if ((info as any).contents.functions?.length) {
          console.log(`  ${chalk.blue('Functions:')} ${(info as any).contents.functions.join(', ')}`);
        }
      }
      
      // Show README if available
      const readme = await manager.getTemplateReadme(name);
      if (readme) {
        console.log(`\n${chalk.bold('README:')}`);
        console.log(chalk.gray('─'.repeat(50)));
        console.log(readme.substring(0, 500) + (readme.length > 500 ? '...' : ''));
      }
    } catch (error) {
      console.error(chalk.red('Error getting template info:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install a template')
  .argument('<name>', 'Template name')
  .option('--apply', 'Apply migrations and deploy functions immediately')
  .option('--force', 'Skip confirmation prompts')
  .option('--dry-run', 'Preview what would be installed without downloading')
  .action(async (name, options) => {
    try {
      const manager = new TemplateManager();
      
      if (options.dryRun) {
        const info = await manager.getTemplateInfo(name);
        console.log(chalk.blue(`\n📋 Preview: Installing ${info.display_name}`));
        console.log(`This would stage:`);
        if ((info as any).contents?.tables?.length) {
          console.log(`  • ${(info as any).contents.tables.length} database table(s)`);
        }
        if ((info as any).contents?.policies?.length) {
          console.log(`  • ${(info as any).contents.policies.length} RLS policy preset(s)`);
        }
        if ((info as any).contents?.functions?.length) {
          console.log(`  • ${(info as any).contents.functions.length} edge function(s)`);
        }
        return;
      }

      console.log(chalk.blue(`\n📦 Installing template: ${name}`));
      
      const result = await manager.installTemplate(name, {
        apply: options.apply,
        force: options.force
      });
      
      console.log(chalk.green(`\n✅ Template ${name} installed successfully!`));
      
      if (result.migrations?.length) {
        console.log(`\n${chalk.bold('Staged migrations:')}`);
        result.migrations.forEach(file => console.log(`  • ${file}`));
      }
      
      if (result.functions?.length) {
        console.log(`\n${chalk.bold('Staged functions:')}`);
        result.functions.forEach(file => console.log(`  • ${file}`));
      }
      
      if (!options.apply) {
        console.log(chalk.yellow(`\n⚠️  Template staged but not applied.`));
        console.log(`To apply: ${chalk.bold('kickstack apply --staged')}`);
      }
      
      // Show next steps
      console.log(`\n${chalk.bold('📖 Next steps:')}`);
      console.log(`1. Review staged files in _staged/ directories`);
      if (!options.apply) {
        console.log(`2. Run: ${chalk.cyan('kickstack apply --staged')}`);
      }
      console.log(`3. Test your new features`);
      
    } catch (error) {
      console.error(chalk.red('Error installing template:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('package')
  .description('Package a template for distribution')
  .argument('<path>', 'Path to template directory')
  .option('-o, --out <filename>', 'Output filename (default: <name>.tar.gz)')
  .option('--validate-only', 'Only validate, do not create package')
  .action(async (path, options) => {
    try {
      const manager = new TemplateManager();
      
      console.log(chalk.blue(`\n📦 Packaging template from: ${path}`));
      
      if (options.validateOnly) {
        await manager.validateTemplate(path);
        console.log(chalk.green('✅ Template validation passed!'));
        return;
      }
      
      const result = await manager.packageTemplate(path, options.out);
      
      console.log(chalk.green(`\n✅ Template packaged successfully!`));
      console.log(`Output: ${result.filename}`);
      console.log(`Size: ${(result.size / 1024).toFixed(1)} KB`);
      
      console.log(`\n${chalk.bold('📖 Next steps:')}`);
      console.log(`1. Test your package: ${chalk.cyan(`kickstack template install ${result.filename}`)}`);
      console.log(`2. Publish: ${chalk.cyan(`kickstack template publish ${result.filename}`)}`);
      
    } catch (error) {
      console.error(chalk.red('Error packaging template:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('publish')
  .description('Publish a template to the marketplace')
  .argument('<file>', 'Template package file (.tar.gz)')
  .option('--registry <url>', 'Custom registry URL')
  .option('--verify', 'Sign template for verification (requires keys)')
  .action(async (file, options) => {
    try {
      const manager = new TemplateManager();
      
      console.log(chalk.blue(`\n🚀 Publishing template: ${file}`));
      
      const result = await manager.publishTemplate(file, {
        registry: options.registry,
        verify: options.verify
      });
      
      console.log(chalk.green(`\n✅ Template published successfully!`));
      console.log(`Registry: ${result.registry}`);
      console.log(`URL: ${result.url}`);
      
      if (result.verified) {
        console.log(chalk.green(`🔒 Template signed and verified`));
      }
      
    } catch (error) {
      console.error(chalk.red('Error publishing template:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List installed templates')
  .option('--installed-only', 'Show only installed templates')
  .action(async (options) => {
    try {
      const manager = new TemplateManager();
      const installed = await manager.listInstalledTemplates();
      
      if (installed.length === 0) {
        console.log(chalk.yellow('No templates installed.'));
        console.log(`Search available templates: ${chalk.cyan('kickstack template search')}`);
        return;
      }
      
      console.log(chalk.blue(`\n📋 Installed templates (${installed.length}):\n`));
      
      for (const template of installed) {
        console.log(`${chalk.bold(template.name)} ${chalk.gray(`(${template.version})`)}`);
        console.log(`  Installed: ${template.installed_at}`);
        console.log(`  Path: ${template.path}`);
        console.log('');
      }
      
    } catch (error) {
      console.error(chalk.red('Error listing templates:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('update-index')
  .description('Update the template index cache')
  .option('--add-index <url>', 'Add a custom template index')
  .action(async (options) => {
    try {
      const manager = new TemplateManager();
      
      if (options.addIndex) {
        await manager.addCustomIndex(options.addIndex);
        console.log(chalk.green(`✅ Added custom index: ${options.addIndex}`));
      } else {
        console.log(chalk.blue('🔄 Updating template index...'));
        await manager.updateIndex();
        console.log(chalk.green('✅ Template index updated successfully!'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error updating index:'), (error as Error).message);
      process.exit(1);
    }
  });

export default program;