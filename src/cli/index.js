#!/usr/bin/env node

/**
 * AI Project Initialization Template Tool
 * CLI entry point for creating standardized project structures
 */

const { program } = require('commander');
const chalk = require('chalk');
const packageJson = require('../../package.json');

// Import CLI commands
const listCommand = require('./commands/list');
const createCommand = require('./commands/create');
const infoCommand = require('./commands/info');
const cacheCommand = require('./commands/cache');
const configCommand = require('./commands/config');
const validateCommand = require('./commands/validate');
const registryCommand = require('./commands/registry');

// CLI Configuration
program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version, '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help for command')
  .addHelpText(
    'after',
    `
${chalk.bold('Examples:')}
  ${chalk.green('create-ai-project list')}                           List available templates
  ${chalk.green('create-ai-project create')}                          Interactive project creation
  ${chalk.green('create-ai-project create @xagi/ai-template-react-next-app')}  Create React Next.js project
  ${chalk.green('create-ai-project info @xagi/ai-template-react-next-app')}     Show template details
  ${chalk.green('create-ai-project cache clear')}                      Clear template cache
  ${chalk.green('create-ai-project validate template <id>')}           Validate template from registry
  ${chalk.green('create-ai-project validate local <path>')}           Validate template from local directory
  ${chalk.green('create-ai-project registry add')}                     Add private registry interactively
  ${chalk.green('create-ai-project registry list')}                    List private registries
  ${chalk.green('create-ai-project registry test <id>')}              Test registry connectivity
  ${chalk.green('create-ai-project registry search <id> <query>')}    Search packages in registry

${chalk.bold('Documentation:')}
  ${chalk.blue('https://github.com/xagi/create-ai-project')}
`
  );

// Global options
program
  .option('-d, --debug', 'Enable debug mode with verbose logging')
  .option('--registry <url>', 'Custom npm registry URL')
  .option('--config <path>', 'Path to configuration file')
  .option('--dry-run', 'Preview operations without making changes');

// Add commands
program.addCommand(listCommand);
program.addCommand(createCommand);
program.addCommand(infoCommand);
program.addCommand(cacheCommand);
program.addCommand(configCommand);
program.addCommand(validateCommand);
program.addCommand(registryCommand);

// Error handling
program.exitOverride();

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled Rejection:'));
  console.error(error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'));
  console.error(error);
  process.exit(1);
});

// Parse command line arguments
if (process.argv.length === 2) {
  // No arguments provided, show help
  program.help();
} else {
  try {
    program.parse(process.argv);
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

module.exports = program;
