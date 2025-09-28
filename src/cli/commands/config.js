const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const ConfigValidator = require('../../core/config-validator');
const ProjectConfiguration = require('../../models/config');

const configCommand = program
  .createCommand('config')
  .description('Manage CLI configuration')
  .addCommand(
    program
      .createCommand('show')
      .alias('get')
      .description('Show current configuration')
      .option('--json', 'Output in JSON format')
      .action(async(options) => {
        const spinner = ora('Loading configuration...').start();

        try {
          const configManager = new ProjectConfiguration();
          const config = await configManager.getCurrentConfig();

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(config, null, 2));
          } else {
            console.log(chalk.bold.blue('\n⚙️ Configuration'));
            console.log(chalk.gray('━'.repeat(25)));

            // Display configuration sections
            Object.entries(config).forEach(([section, values]) => {
              console.log(chalk.bold(`\n${section.charAt(0).toUpperCase() + section.slice(1)}:`));
              Object.entries(values).forEach(([key, value]) => {
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
                console.log(`  ${chalk.green(key)}: ${chalk.gray(displayValue)}`);
              });
            });

            // Show configuration file locations
            console.log(chalk.bold('\nConfiguration Files:'));
            console.log(`  Global: ${chalk.gray(configManager.getGlobalConfigPath())}`);
            console.log(`  Local: ${chalk.gray(configManager.getLocalConfigPath())}`);
            console.log(`  Active: ${chalk.gray(configManager.getActiveConfigPath())}`);
          }
        } catch (error) {
          spinner.fail(chalk.red('Failed to load configuration'));
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    program
      .createCommand('set')
      .description('Set configuration value')
      .argument('<key>', 'Configuration key')
      .argument('<value>', 'Configuration value')
      .option('--global', 'Set global configuration')
      .action(async(key, value, options) => {
        const spinner = ora(`Setting configuration ${key}...`).start();

        try {
          const configManager = new ProjectConfiguration();

          // Parse value if it's JSON or complex type
          let parsedValue = value;
          try {
            parsedValue = JSON.parse(value);
          } catch (e) {
            // Keep as string if not valid JSON
          }

          // Set configuration value
          await configManager.setConfig(key, parsedValue, {
            global: options.global
          });

          spinner.succeed(chalk.green(`Configuration updated: ${key}`));
        } catch (error) {
          spinner.fail(chalk.red('Failed to set configuration'));
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    program
      .createCommand('unset')
      .description('Remove configuration value')
      .argument('<key>', 'Configuration key')
      .option('--global', 'Remove from global configuration')
      .action(async(key, options) => {
        const spinner = ora(`Removing configuration ${key}...`).start();

        try {
          const configManager = new ProjectConfiguration();

          await configManager.unsetConfig(key, {
            global: options.global
          });

          spinner.succeed(chalk.green(`Configuration removed: ${key}`));
        } catch (error) {
          spinner.fail(chalk.red('Failed to remove configuration'));
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    program
      .createCommand('reset')
      .description('Reset configuration to defaults')
      .option('--force', 'Reset without confirmation')
      .action(async(options) => {
        const spinner = ora('Resetting configuration...').start();

        try {
          if (!options.force) {
            spinner.stop();

            const { confirmed } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirmed',
                message: 'Are you sure you want to reset all configuration to defaults?',
                default: false
              }
            ]);

            if (!confirmed) {
              console.log(chalk.yellow('Configuration reset cancelled.'));
              return;
            }

            spinner.start('Resetting configuration...');
          }

          const configManager = new ProjectConfiguration();
          await configManager.resetConfig();

          spinner.succeed(chalk.green('Configuration reset to defaults!'));
        } catch (error) {
          spinner.fail(chalk.red('Failed to reset configuration'));
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      })
  );

module.exports = configCommand;
