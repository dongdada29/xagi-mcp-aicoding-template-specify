const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const table = require('table');
const TemplateManager = require('../../core/template-manager');
const NpmService = require('../../services/npm-service');
const GitService = require('../../services/git-service');

const infoCommand = program
  .createCommand('info')
  .description('Show detailed information about a template')
  .argument('<template>', 'Template name or package')
  .option('--json', 'Output in JSON format')
  .option('--versions', 'Show available versions')
  .option('--dependencies', 'Show template dependencies')
  .action(async(template, options) => {
    const spinner = ora(`Loading template information for ${template}...`).start();

    try {
      const templateManager = new TemplateManager();
      const npmService = new NpmService();
      const gitService = new GitService();

      // Get template information
      const templateInfo = await templateManager.getTemplate(template, options);

      // Get additional information if requested
      const additionalInfo = {};

      if (options.versions) {
        if (templateInfo.type === 'npm') {
          additionalInfo.versions = await npmService.getPackageVersions(template);
        } else if (templateInfo.type === 'git') {
          additionalInfo.versions = await gitService.getRepositoryVersions(templateInfo.repository);
        }
      }

      if (options.dependencies) {
        if (templateInfo.type === 'npm') {
          additionalInfo.dependencies = await npmService.getPackageDependencies(template);
        } else if (templateInfo.packageJson && templateInfo.packageJson.dependencies) {
          additionalInfo.dependencies = templateInfo.packageJson.dependencies;
        }
      }

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify({
          ...templateInfo,
          ...additionalInfo
        }, null, 2));
      } else {
        // Display template information in a formatted way
        console.log(chalk.bold.blue(`\n📦 ${templateInfo.name}`));
        console.log(chalk.gray('━'.repeat(50)));

        console.log(chalk.bold('Description:'));
        console.log(`  ${templateInfo.description || 'No description available'}`);

        console.log(chalk.bold('\nType:'));
        console.log(`  ${chalk.cyan(templateInfo.type || 'unknown')}`);

        console.log(chalk.bold('\nVersion:'));
        console.log(`  ${chalk.magenta(templateInfo.version || 'latest')}`);

        if (templateInfo.author) {
          console.log(chalk.bold('\nAuthor:'));
          console.log(`  ${templateInfo.author}`);
        }

        if (templateInfo.keywords && templateInfo.keywords.length > 0) {
          console.log(chalk.bold('\nKeywords:'));
          console.log(`  ${templateInfo.keywords.map(k => chalk.yellow(k)).join(', ')}`);
        }

        if (templateInfo.registry) {
          console.log(chalk.bold('\nRegistry:'));
          console.log(`  ${chalk.blue(templateInfo.registry)}`);
        }

        if (templateInfo.repository) {
          console.log(chalk.bold('\nRepository:'));
          console.log(`  ${chalk.blue(templateInfo.repository)}`);
        }

        if (templateInfo.homepage) {
          console.log(chalk.bold('\nHomepage:'));
          console.log(`  ${chalk.blue(templateInfo.homepage)}`);
        }

        if (templateInfo.license) {
          console.log(chalk.bold('\nLicense:'));
          console.log(`  ${templateInfo.license}`);
        }

        // Display configuration schema if available
        if (templateInfo.config && Object.keys(templateInfo.config).length > 0) {
          console.log(chalk.bold('\nConfiguration Options:'));
          Object.entries(templateInfo.config).forEach(([key, config]) => {
            const required = config.required ? chalk.red(' (required)') : '';
            console.log(`  ${chalk.green(key)}: ${config.description || 'No description'}${required}`);
            if (config.default !== undefined) {
              console.log(`    Default: ${chalk.gray(config.default)}`);
            }
            if (config.type) {
              console.log(`    Type: ${chalk.gray(config.type)}`);
            }
            if (config.enum) {
              console.log(`    Options: ${chalk.gray(config.enum.join(', '))}`);
            }
          });
        }

        // Display versions if requested
        if (additionalInfo.versions && additionalInfo.versions.length > 0) {
          console.log(chalk.bold('\nAvailable Versions:'));
          additionalInfo.versions.slice(0, 10).forEach(version => {
            console.log(`  ${chalk.magenta(version)}`);
          });
          if (additionalInfo.versions.length > 10) {
            console.log(`  ${chalk.gray(`... and ${additionalInfo.versions.length - 10} more`)}`);
          }
        }

        // Display dependencies if requested
        if (additionalInfo.dependencies && Object.keys(additionalInfo.dependencies).length > 0) {
          console.log(chalk.bold('\nDependencies:'));
          Object.entries(additionalInfo.dependencies).forEach(([name, version]) => {
            console.log(`  ${chalk.yellow(name)}: ${chalk.gray(version)}`);
          });
        }

        // Display compatibility information
        if (templateInfo.compatibility) {
          console.log(chalk.bold('\nCompatibility:'));
          if (templateInfo.compatibility.node) {
            console.log(`  Node.js: ${chalk.cyan(templateInfo.compatibility.node)}`);
          }
          if (templateInfo.compatibility.npm) {
            console.log(`  npm: ${chalk.cyan(templateInfo.compatibility.npm)}`);
          }
        }

        console.log(chalk.gray(`\nLast updated: ${new Date(templateInfo.updatedAt || Date.now()).toLocaleDateString()}`));
      }
    } catch (error) {
      spinner.fail(chalk.red(`Failed to load template information for ${template}`));
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

module.exports = infoCommand;
