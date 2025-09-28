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
