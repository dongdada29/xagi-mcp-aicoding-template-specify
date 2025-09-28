const { program } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const TemplateManager = require('../../core/template-manager');
const { program: mainProgram } = require('../index');
const inquirer = require('inquirer');

const registryCommand = program
  .createCommand('registry')
  .description('Manage private npm registries');

// Add registry command
registryCommand
  .command('add')
  .description('Add a new private registry')
  .option('-i, --id <id>', 'Unique registry identifier')
  .option('-n, --name <name>', 'Registry name')
  .option('-u, --url <url>', 'Registry URL')
  .option('-t, --auth-type <type>', 'Authentication type (token, basic, oauth, none)', 'none')
  .option('--token <token>', 'Authentication token (for token auth)')
  .option('--username <username>', 'Username (for basic auth)')
  .option('--password <password>', 'Password (for basic auth)')
  .option('--email <email>', 'Email address')
  .option('--priority <priority>', 'Registry priority (higher numbers come first)', '0')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    try {
      const templateManager = new TemplateManager();
      await templateManager.initialize();

      // Interactive mode if required options are missing
      let registryConfig = { ...options };

      if (!options.id || !options.name || !options.url) {
        console.log(chalk.blue('Interactive registry setup:'));
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'id',
            message: 'Registry ID:',
            validate: (input) => input.trim() !== '' || 'Registry ID is required'
          },
          {
            type: 'input',
            name: 'name',
            message: 'Registry name:',
            validate: (input) => input.trim() !== '' || 'Registry name is required'
          },
          {
            type: 'input',
            name: 'url',
            message: 'Registry URL:',
            validate: (input) => input.trim() !== '' || 'Registry URL is required'
          },
          {
            type: 'list',
            name: 'authType',
            message: 'Authentication type:',
            choices: [
              { name: 'None (public registry)', value: 'none' },
              { name: 'Bearer Token', value: 'token' },
              { name: 'Basic Auth (username/password)', value: 'basic' },
              { name: 'OAuth', value: 'oauth' }
            ],
            default: 'none'
          }
        ]);

        registryConfig = { ...registryConfig, ...answers };

        // Ask for auth credentials based on type
        if (answers.authType === 'token') {
          const tokenAnswer = await inquirer.prompt([
            {
              type: 'password',
              name: 'authToken',
              message: 'Authentication token:',
              validate: (input) => input.trim() !== '' || 'Token is required'
            }
          ]);
          registryConfig.credentials = { authToken: tokenAnswer.authToken };
        } else if (answers.authType === 'basic') {
          const basicAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'username',
              message: 'Username:',
              validate: (input) => input.trim() !== '' || 'Username is required'
            },
            {
              type: 'password',
              name: 'password',
              message: 'Password:',
              validate: (input) => input.trim() !== '' || 'Password is required'
            }
          ]);
          registryConfig.credentials = basicAnswer;
        } else if (answers.authType === 'oauth') {
          const oauthAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'accessToken',
              message: 'Access token:',
              validate: (input) => input.trim() !== '' || 'Access token is required'
            },
            {
              type: 'input',
              name: 'email',
              message: 'Email (optional):'
            }
          ]);
          registryConfig.credentials = {
            accessToken: oauthAnswer.accessToken,
            email: oauthAnswer.email
          };
        }

        // Priority
        const priorityAnswer = await inquirer.prompt([
          {
            type: 'number',
            name: 'priority',
            message: 'Registry priority (higher numbers come first):',
            default: 0,
            validate: (input) => !isNaN(input) || 'Priority must be a number'
          }
        ]);
        registryConfig.priority = priorityAnswer.priority;
      } else {
        // Command-line mode - build credentials object
        registryConfig.credentials = {};
        if (options.token) {
          registryConfig.credentials.authToken = options.token;
        }
        if (options.username) {
          registryConfig.credentials.username = options.username;
        }
        if (options.password) {
          registryConfig.credentials.password = options.password;
        }
        if (options.email) {
          registryConfig.credentials.email = options.email;
        }
      }

      // Add the registry
      const result = templateManager.addPrivateRegistry(registryConfig);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green('✓ Private registry added successfully:'));
        console.log();
        const table = new Table({ head: ['Property', 'Value'], colWidths: [20, 50] });
        table.push(['ID', result.id]);
        table.push(['Name', result.name]);
        table.push(['URL', result.url]);
        table.push(['Auth Type', result.authType]);
        table.push(['Enabled', result.enabled ? 'Yes' : 'No']);
        table.push(['Priority', result.priority]);
        table.push(['Created At', result.createdAt]);
        console.log(table.toString());
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Remove registry command
registryCommand
  .command('remove <registryId>')
  .description('Remove a private registry')
  .option('--json', 'Output results in JSON format')
  .action(async (registryId, options) => {
    try {
      const templateManager = new TemplateManager();
      await templateManager.initialize();

      const result = templateManager.removePrivateRegistry(registryId);

      if (options.json) {
        console.log(JSON.stringify({ success: true, removed: result, registryId }, null, 2));
      } else {
        console.log(chalk.green('✓ Private registry removed successfully:'), registryId);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// List registries command
registryCommand
  .command('list')
  .description('List all configured private registries')
  .option('--include-disabled', 'Include disabled registries')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    try {
      const templateManager = new TemplateManager();
      await templateManager.initialize();

      const registries = templateManager.listPrivateRegistries({
        includeDisabled: options.includeDisabled,
        type: 'private'
      });

      if (options.json) {
        console.log(JSON.stringify(registries, null, 2));
      } else {
        if (registries.length === 0) {
          console.log(chalk.yellow('No private registries configured'));
          return;
        }

        console.log(chalk.bold('Private Registries:'));
        console.log();

        const table = new Table({
          head: ['ID', 'Name', 'URL', 'Auth Type', 'Enabled', 'Priority', 'Last Used'],
          colWidths: [20, 25, 30, 12, 8, 8, 20]
        });

        registries.forEach(registry => {
          table.push([
            registry.id,
            registry.name,
            registry.url,
            registry.authType,
            registry.enabled ? 'Yes' : 'No',
            registry.priority.toString(),
            registry.lastUsed || 'Never'
          ]);
        });

        console.log(table.toString());
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Test connectivity command
registryCommand
  .command('test <registryId>')
  .description('Test connectivity to a private registry')
  .option('--json', 'Output results in JSON format')
  .action(async (registryId, options) => {
    try {
      const templateManager = new TemplateManager();
      await templateManager.initialize();

      console.log(chalk.blue('Testing registry connectivity...'));
      const result = await templateManager.testPrivateRegistry(registryId);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success) {
          console.log(chalk.green('✓ Registry is accessible'));
          console.log();
          const table = new Table({ head: ['Property', 'Value'], colWidths: [20, 50] });
          table.push(['Registry ID', result.registryId]);
          table.push(['URL', result.url]);
          table.push(['Endpoint', result.endpoint]);
          table.push(['Response Time', `${result.responseTime}ms`]);
          table.push(['Message', result.message]);
          table.push(['Tested At', result.timestamp]);
          console.log(table.toString());
        } else {
          console.log(chalk.red('✗ Registry is not accessible'));
          console.log(chalk.red('Error:'), result.error);
          console.log();
          const table = new Table({ head: ['Property', 'Value'], colWidths: [20, 50] });
          table.push(['Registry ID', result.registryId]);
          table.push(['URL', result.url]);
          table.push(['Error', result.error]);
          table.push(['Tested At', result.timestamp]);
          console.log(table.toString());
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Search packages command
registryCommand
  .command('search <registryId> <query>')
  .description('Search for packages in a private registry')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .option('--json', 'Output results in JSON format')
  .action(async (registryId, query, options) => {
    try {
      const templateManager = new TemplateManager();
      await templateManager.initialize();

      const packages = await templateManager.searchPrivatePackages(registryId, query, {
        limit: parseInt(options.limit) || 20
      });

      if (options.json) {
        console.log(JSON.stringify(packages, null, 2));
      } else {
        if (packages.length === 0) {
          console.log(chalk.yellow('No packages found matching query:'), query);
          return;
        }

        console.log(chalk.bold(`Search results for "${query}" in ${registryId}:`));
        console.log();

        const table = new Table({
          head: ['Package', 'Version', 'Description'],
          colWidths: [40, 15, 40]
        });

        packages.forEach(pkg => {
          table.push([
            pkg.name || pkg.package?.name || 'Unknown',
            pkg.version || pkg.package?.version || 'Unknown',
            (pkg.description || pkg.package?.description || '').substring(0, 40) + (pkg.description?.length > 40 ? '...' : '')
          ]);
        });

        console.log(table.toString());
        console.log(chalk.gray(`Found ${packages.length} package(s)`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Package info command
registryCommand
  .command('info <registryId> <packageName>')
  .description('Get detailed information about a package in a private registry')
  .option('--json', 'Output results in JSON format')
  .action(async (registryId, packageName, options) => {
    try {
      const templateManager = new TemplateManager();
      await templateManager.initialize();

      const packageInfo = await templateManager.getPrivatePackageInfo(registryId, packageName);

      if (options.json) {
        console.log(JSON.stringify(packageInfo, null, 2));
      } else {
        console.log(chalk.bold(`Package: ${packageName} in ${registryId}`));
        console.log();

        const table = new Table({ head: ['Property', 'Value'], colWidths: [20, 50] });

        // Basic info
        if (packageInfo.name) table.push(['Name', packageInfo.name]);
        if (packageInfo.version) table.push(['Version', packageInfo.version]);
        if (packageInfo.description) table.push(['Description', packageInfo.description]);
        if (packageInfo.author) table.push(['Author', packageInfo.author]);

        // Dependencies
        if (packageInfo.dependencies && Object.keys(packageInfo.dependencies).length > 0) {
          table.push(['Dependencies', Object.keys(packageInfo.dependencies).join(', ')]);
        }

        // Additional info
        if (packageInfo.homepage) table.push(['Homepage', packageInfo.homepage]);
        if (packageInfo.repository) table.push(['Repository', packageInfo.repository]);
        if (packageInfo.license) table.push(['License', packageInfo.license]);

        console.log(table.toString());
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Stats command
registryCommand
  .command('stats')
  .description('Show registry statistics')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    try {
      const templateManager = new TemplateManager();
      await templateManager.initialize();

      const stats = templateManager.getRegistryStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.bold('Registry Statistics:'));
        console.log();

        const table = new Table({ head: ['Metric', 'Value'], colWidths: [25, 45] });
        table.push(['Total Registries', stats.totalRegistries]);
        table.push(['Enabled Registries', stats.enabledRegistries]);
        table.push(['Private Registries', stats.privateRegistries]);
        table.push(['Encryption Enabled', stats.encryptionEnabled ? 'Yes' : 'No']);
        table.push(['Configuration Directory', stats.configDir]);

        console.log(table.toString());

        if (stats.authTypes) {
          console.log(chalk.bold('\nAuthentication Types:'));
          const authTable = new Table({ head: ['Type', 'Count'], colWidths: [15, 15] });
          authTable.push(['Token', stats.authTypes.token]);
          authTable.push(['Basic', stats.authTypes.basic]);
          authTable.push(['OAuth', stats.authTypes.oauth]);
          authTable.push(['None', stats.authTypes.none]);
          console.log(authTable.toString());
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

module.exports = registryCommand;