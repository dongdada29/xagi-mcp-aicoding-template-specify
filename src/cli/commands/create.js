const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const TemplateManager = require('../../core/template-manager');
const ProjectService = require('../../services/project-service');
const ConfigValidator = require('../../core/config-validator');

const createCommand = program
  .createCommand('create')
  .description('Create a new project from a template')
  .argument('[template]', 'Template name or package')
  .option('-n, --name <name>', 'Project name')
  .option('-p, --path <path>', 'Target directory path')
  .option('-c, --config <json>', 'Template configuration as JSON string')
  .option('--config-file <path>', 'Path to configuration file')
  .option('--registry <url>', 'Custom npm registry URL')
  .option('--branch <branch>', 'Git branch (for git-based templates)')
  .option('--tag <tag>', 'Git tag (for git-based templates)')
  .option('--interactive', 'Force interactive mode')
  .option('--non-interactive', 'Force non-interactive mode')
  .option('--dry-run', 'Preview without creating files')
  .action(async(template, options) => {
    const spinner = ora('Initializing project creation...').start();

    try {
      const templateManager = new TemplateManager();
      const projectService = new ProjectService();
      const configValidator = new ConfigValidator();

      // Determine if interactive mode should be used
      const isInteractive = options.interactive || (!template && !options.nonInteractive);

      const projectConfig = {
        template: template,
        name: options.name,
        path: options.path,
        config: options.config ? JSON.parse(options.config) : {},
        configFile: options.configFile,
        registry: options.registry,
        branch: options.branch,
        tag: options.tag,
        dryRun: options.dryRun
      };

      // Interactive mode
      if (isInteractive) {
        spinner.stop();

        // Step 1: Select template
        if (!projectConfig.template) {
          const templates = await templateManager.listTemplates(options);
          const templateChoices = templates.map(t => ({
            name: `${t.name} - ${t.description}`,
            value: t.name,
            short: t.name
          }));

          const templateAnswer = await inquirer.prompt([
            {
              type: 'list',
              name: 'template',
              message: 'Select a template:',
              choices: templateChoices,
              pageSize: 10
            }
          ]);
          projectConfig.template = templateAnswer.template;
        }

        // Step 2: Get project details
        const projectAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Project name:',
            default: projectConfig.name,
            validate: (input) => {
              const validationResult = configValidator.validateProjectName(input);
              return validationResult.valid ? true : validationResult.errors.join(', ');
            }
          },
          {
            type: 'input',
            name: 'path',
            message: 'Target directory:',
            default: projectConfig.path || `./${projectConfig.name}`,
            validate: (input) => {
              const validationResult = configValidator.validateProjectPath(input);
              return validationResult.valid ? true : validationResult.errors.join(', ');
            }
          }
        ]);

        projectConfig.name = projectAnswers.name;
        projectConfig.path = projectAnswers.path;

        // Step 3: Get template-specific configuration
        const templateInfo = await templateManager.getTemplate(projectConfig.template, options);
        if (templateInfo.config && Object.keys(templateInfo.config).length > 0) {
          console.log(chalk.blue('\nConfigure your project:'));
          const configQuestions = [];

          for (const [key, config] of Object.entries(templateInfo.config)) {
            if (config.type === 'boolean') {
              configQuestions.push({
                type: 'confirm',
                name: key,
                message: config.description || key,
                default: config.default || false
              });
            } else if (config.enum) {
              configQuestions.push({
                type: 'list',
                name: key,
                message: config.description || key,
                choices: config.enum,
                default: config.default
              });
            } else {
              configQuestions.push({
                type: 'input',
                name: key,
                message: config.description || key,
                default: config.default || ''
              });
            }
          }

          const configAnswers = await inquirer.prompt(configQuestions);
          projectConfig.config = { ...projectConfig.config, ...configAnswers };
        }

        spinner.start('Creating project...');
      }

      // Validate configuration
      const validationResult = configValidator.validateConfiguration(projectConfig);
      if (!validationResult.valid) {
        throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Create project
      const result = await projectService.createProject(projectConfig);

      spinner.succeed(chalk.green('Project created successfully!'));

      if (!options.dryRun) {
        console.log(chalk.bold('\nNext steps:'));
        console.log(chalk.gray(`  cd ${result.projectPath}`));
        console.log(chalk.gray('  npm install'));
        if (result.scripts && Object.keys(result.scripts).length > 0) {
          console.log(chalk.gray(`  npm run ${Object.keys(result.scripts)[0]}`));
        }
        console.log(chalk.blue(`\nProject created at: ${result.projectPath}`));
      } else {
        console.log(chalk.yellow('\nDry run completed - no files were created.'));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to create project'));
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

module.exports = createCommand;
