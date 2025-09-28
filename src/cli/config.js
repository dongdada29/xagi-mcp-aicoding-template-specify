const { Command } = require('commander');
const ConfigManager = require('../core/config-manager');
const chalk = require('chalk');
const Table = require('cli-table3');

/**
 * Configuration CLI commands
 */
class ConfigCLI {
  constructor() {
    this.configManager = new ConfigManager();
    this.initialized = false;
  }

  /**
   * Initialize configuration manager
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      await this.configManager.initialize();
      this.initialized = true;
    }
  }

  /**
   * Create configuration commands
   * @returns {Command} Configuration command
   */
  createCommands() {
    const configCmd = new Command('config')
      .description('Manage application configuration');

    // Get configuration value
    configCmd
      .command('get <key>')
      .description('Get configuration value')
      .option('-d, --default <value>', 'Default value if key not found')
      .action(async (key, options) => {
        await this.initialize();
        try {
          const value = this.configManager.get(key, options.default);
          if (value !== undefined) {
            console.log(chalk.green(key), '=', chalk.blue(typeof value === 'object' ? JSON.stringify(value, null, 2) : value));
          } else {
            console.log(chalk.yellow(`Key '${key}' not found`));
          }
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // Set configuration value
    configCmd
      .command('set <key> <value>')
      .description('Set configuration value')
      .option('-j, --json', 'Parse value as JSON')
      .action(async (key, value, options) => {
        await this.initialize();
        try {
          let parsedValue = value;
          if (options.json) {
            parsedValue = JSON.parse(value);
          } else if (value === 'true') {
            parsedValue = true;
          } else if (value === 'false') {
            parsedValue = false;
          } else if (!isNaN(value) && value.trim() !== '') {
            parsedValue = Number(value);
          }

          await this.configManager.set(key, parsedValue);
          console.log(chalk.green(`✓ Set ${key} = ${parsedValue}`));
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // Delete configuration value
    configCmd
      .command('delete <key>')
      .description('Delete configuration value')
      .alias('del')
      .action(async (key) => {
        await this.initialize();
        try {
          await this.configManager.delete(key);
          console.log(chalk.green(`✓ Deleted ${key}`));
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // List all configuration
    configCmd
      .command('list')
      .description('List all configuration')
      .option('-s, --show-sensitive', 'Show sensitive values')
      .action(async (options) => {
        await this.initialize();
        try {
          const config = this.configManager.export(options.showSensitive);
          this.displayConfigTable(config);
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // Reset configuration
    configCmd
      .command('reset')
      .description('Reset configuration to defaults')
      .option('-f, --force', 'Force reset without confirmation')
      .action(async (options) => {
        await this.initialize();
        try {
          if (!options.force) {
            const readline = require('readline');
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });

            const answer = await new Promise(resolve => {
              rl.question(chalk.yellow('Are you sure you want to reset configuration to defaults? (y/N): '), resolve);
            });

            rl.close();

            if (answer.toLowerCase() !== 'y') {
              console.log(chalk.blue('Reset cancelled'));
              return;
            }
          }

          await this.configManager.reset();
          console.log(chalk.green('✓ Configuration reset to defaults'));
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // Import configuration
    configCmd
      .command('import <file>')
      .description('Import configuration from file')
      .option('-m, --merge', 'Merge with existing configuration')
      .action(async (file, options) => {
        await this.initialize();
        try {
          const fs = require('fs-extra');
          const importedConfig = await fs.readJson(file);
          await this.configManager.import(importedConfig, options.merge);
          console.log(chalk.green('✓ Configuration imported successfully'));
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // Export configuration
    configCmd
      .command('export <file>')
      .description('Export configuration to file')
      .option('-s, --show-sensitive', 'Include sensitive values')
      .action(async (file, options) => {
        await this.initialize();
        try {
          const fs = require('fs-extra');
          const config = this.configManager.export(options.showSensitive);
          await fs.writeJson(file, config, { spaces: 2 });
          console.log(chalk.green(`✓ Configuration exported to ${file}`));
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // Show configuration file location
    configCmd
      .command('path')
      .description('Show configuration file location')
      .action(async () => {
        await this.initialize();
        try {
          const stats = this.configManager.getStats();
          console.log(chalk.green('Configuration file:'), chalk.blue(stats.configPath));
          console.log(chalk.green('Configuration directory:'), chalk.blue(stats.configDir));
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // Show configuration schema
    configCmd
      .command('schema')
      .description('Show configuration schema')
      .action(async () => {
        await this.initialize();
        try {
          const schema = this.configManager.getSchema();
          console.log(JSON.stringify(schema, null, 2));
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    // Show configuration statistics
    configCmd
      .command('stats')
      .description('Show configuration statistics')
      .action(async () => {
        await this.initialize();
        try {
          const stats = this.configManager.getStats();
          this.displayStatsTable(stats);
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });

    return configCmd;
  }

  /**
   * Display configuration in table format
   * @param {Object} config - Configuration object
   * @param {string} prefix - Key prefix
   */
  displayConfigTable(config, prefix = '') {
    const table = new Table({
      head: [chalk.cyan('Key'), chalk.cyan('Value'), chalk.cyan('Type')],
      colWidths: [40, 50, 15]
    });

    const addToTable = (obj, currentPrefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          addToTable(value, fullKey);
        } else {
          const displayValue = typeof value === 'object'
            ? JSON.stringify(value, null, 2)
            : String(value);

          table.push([fullKey, displayValue, typeof value]);
        }
      }
    };

    addToTable(config);
    console.log(table.toString());
  }

  /**
   * Display statistics in table format
   * @param {Object} stats - Statistics object
   */
  displayStatsTable(stats) {
    const table = new Table({
      head: [chalk.cyan('Property'), chalk.cyan('Value')],
      colWidths: [25, 50]
    });

    table.push(['Config Path', stats.configPath]);
    table.push(['Config Directory', stats.configDir]);
    table.push(['Encryption Enabled', stats.encryptionEnabled ? 'Yes' : 'No']);
    table.push(['Watching Changes', stats.isWatching ? 'Yes' : 'No']);
    table.push(['Active Watchers', stats.watcherCount]);
    table.push(['Config Size', `${stats.configSize} bytes`]);

    console.log(table.toString());
  }
}

module.exports = ConfigCLI;