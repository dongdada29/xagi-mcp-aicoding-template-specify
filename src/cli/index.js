#!/usr/bin/env node

/**
 * AI Project Initialization Template Tool
 * CLI entry point for creating standardized project structures
 */

const { program } = require('commander');
const chalk = require('chalk');
const packageJson = require('../../package.json');

// Performance and memory monitoring
const { PerformanceMonitor } = require('../utils/performance');
const { MemoryMonitor } = require('../utils/memory');

const monitor = PerformanceMonitor.enableCLIMonitoring();
const memoryMonitor = new MemoryMonitor({
  warning: 30 * 1024 * 1024, // 30MB warning
  critical: 50 * 1024 * 1024, // 50MB critical
  cleanup: 40 * 1024 * 1024 // 40MB cleanup
});

// Lazy load CLI commands for better performance
const getCommand = (commandName) => {
  switch (commandName) {
    case 'list':
      return require('./commands/list');
    case 'create':
      return require('./commands/create');
    case 'info':
      return require('./commands/info');
    case 'cache':
      return require('./commands/cache');
    case 'config':
      return require('./commands/config');
    case 'validate':
      return require('./commands/validate');
    case 'registry':
      return require('./commands/registry');
    default:
      throw new Error(`Unknown command: ${commandName}`);
  }
};

// Command loader function
const loadCommands = () => {
  return [
    getCommand('list'),
    getCommand('create'),
    getCommand('info'),
    getCommand('cache'),
    getCommand('config'),
    getCommand('validate'),
    getCommand('registry')
  ];
};

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

// Add commands (lazy loaded)
const commands = loadCommands();
commands.forEach(command => {
  program.addCommand(command);
});

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

  // Check memory usage on errors
  const memStatus = memoryMonitor.checkThresholds();
  if (memStatus.level !== 'normal') {
    console.warn(chalk.yellow(`Memory usage ${memStatus.current} (${memStatus.level})`));
  }

  process.exit(1);
});

// Memory monitoring
if (process.env.DEBUG_MEMORY) {
  setInterval(() => {
    const memStatus = memoryMonitor.checkThresholds();
    if (memStatus.level !== 'normal') {
      console.warn(chalk.yellow(`Memory warning: ${memStatus.current} (${memStatus.level})`));

      if (memStatus.shouldCleanup) {
        console.warn(chalk.yellow('Performing memory cleanup...'));
        if (memoryMonitor.forceGarbageCollection()) {
          console.log(chalk.green('Garbage collection completed'));
        }
      }
    }
  }, 5000); // Check every 5 seconds
}

// Parse command line arguments
if (process.argv.length === 2) {
  // No arguments provided, show help
  program.help();
} else {
  const endStartup = monitor.measure('cli_startup');

  try {
    const startParse = monitor.measure('cli_parse');
    program.parse(process.argv);
    startParse();
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  } finally {
    endStartup();
  }
}

module.exports = program;
