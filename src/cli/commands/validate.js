const { program } = require('commander');
const TemplateManager = require('../../core/template-manager');
const TemplateValidator = require('../../core/template-validator');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs-extra');

const validateCommand = program
  .createCommand('validate')
  .description('Validate templates and template packages');

validateCommand
  .command('template <templateId>')
  .description('Validate template from registry')
  .option('-v, --version <version>', 'Template version to validate')
  .option('-s, --strict', 'Enable strict validation mode')
  .option('--no-security', 'Skip security validation')
  .option('--no-dependencies', 'Skip dependency validation')
  .option('--no-structure', 'Skip structure validation')
  .option('--no-schema', 'Skip schema validation')
  .option('--no-version', 'Skip version validation')
  .option('--json', 'Output results in JSON format')
  .action(async (templateId, options) => {
    try {
      const templateManager = new TemplateManager();
      const templateValidator = new TemplateValidator({
        logger: templateManager.logger
      });
      await templateManager.initialize();

      const validationOptions = {
        strictMode: options.strict,
        enableSecurityValidation: options.security,
        enableDependencyValidation: options.dependencies,
        enableStructureValidation: options.structure,
        enableSchemaValidation: options.schema,
        enableVersionValidation: options.version
      };

      const template = await templateManager.getTemplate(templateId);
      const result = await templateManager.validateTemplate(template, validationOptions);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displayValidationResult(result);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

validateCommand
  .command('local <path>')
  .description('Validate template from local directory')
  .option('-t, --type <type>', 'Template type (react-next, node-api, vue-app)')
  .option('-s, --strict', 'Enable strict validation mode')
  .option('--no-security', 'Skip security validation')
  .option('--no-dependencies', 'Skip dependency validation')
  .option('--no-structure', 'Skip structure validation')
  .option('--no-schema', 'Skip schema validation')
  .option('--no-version', 'Skip version validation')
  .option('--json', 'Output results in JSON format')
  .action(async (path, options) => {
    try {
      const templateManager = new TemplateManager();
      const templateValidator = new TemplateValidator({
        logger: templateManager.logger
      });
      await templateManager.initialize();

      if (!(await fs.pathExists(path))) {
        throw new Error(`Path does not exist: ${path}`);
      }

      // Create template data from local path
      const packageJsonPath = require('path').join(path, 'package.json');
      let packageJson = {};

      try {
        packageJson = await fs.readJSON(packageJsonPath);
      } catch (error) {
        console.warn(chalk.yellow('Warning: package.json not found or invalid'));
      }

      const templateData = {
        id: packageJson.name || 'local-template',
        name: packageJson.name || 'Local Template',
        version: packageJson.version || '1.0.0',
        description: packageJson.description || 'Local template validation',
        type: options.type || 'react-next',
        path: path
      };

      const TemplatePackage = require('../../models/template');
      const template = new TemplatePackage(templateData);

      const validationOptions = {
        path: path,
        templateType: options.type,
        strictMode: options.strict,
        enableSecurityValidation: options.security,
        enableDependencyValidation: options.dependencies,
        enableStructureValidation: options.structure,
        enableSchemaValidation: options.schema,
        enableVersionValidation: options.version
      };

      const result = await templateValidator.validateTemplatePackage(template, validationOptions);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displayValidationResult(result);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

validateCommand
  .command('package <path>')
  .description('Validate template package.json file')
  .option('-t, --type <type>', 'Template type (react-next, node-api, vue-app)')
  .option('--json', 'Output results in JSON format')
  .action(async (path, options) => {
    try {
      const templateValidator = new TemplateValidator();
      const result = await templateValidator.validateTemplatePackageJson(path, options.type);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displayPackageValidationResult(result);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

validateCommand
  .command('config <templateId> <configPath>')
  .description('Validate template configuration')
  .option('--json', 'Output results in JSON format')
  .action(async (templateId, configPath, options) => {
    try {
      const templateManager = new TemplateManager();
      const templateValidator = new TemplateValidator({
        logger: templateManager.logger
      });
      await templateManager.initialize();

      const template = await templateManager.getTemplate(templateId);
      const config = await fs.readJSON(configPath);

      const result = await templateValidator.validateTemplateConfiguration(config, template);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displayConfigValidationResult(result);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

validateCommand
  .command('schema <type>')
  .description('Show validation schema for template type')
  .option('--json', 'Output results in JSON format')
  .action(async (type, options) => {
    try {
      const templateValidator = new TemplateValidator();
      const schema = templateValidator.getTemplateSchema(type);

      if (options.json) {
        console.log(JSON.stringify(schema, null, 2));
      } else {
        console.log(chalk.green(`Validation Schema for ${type}:`));
        console.log(JSON.stringify(schema, null, 2));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

validateCommand
  .command('security <path>')
  .description('Validate template security only')
  .option('-t, --type <type>', 'Template type (react-next, node-api, vue-app)')
  .option('--json', 'Output results in JSON format')
  .action(async (path, options) => {
    try {
      const templateValidator = new TemplateValidator();

      if (!(await fs.pathExists(path))) {
        throw new Error(`Path does not exist: ${path}`);
      }

      const result = await templateValidator.validateTemplateSecurity(path, options.type);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        displaySecurityValidationResult(result);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Display validation result
 * @param {Object} result - Validation result
 */
function displayValidationResult(result) {
  console.log(chalk.bold('Template Validation Results:'));

  // Overall status
  if (result.isValid) {
    console.log(chalk.green('✓ Template is valid'));
  } else {
    console.log(chalk.red('✗ Template has issues'));
  }

  console.log();

  // Display metadata if available
  if (result.metadata) {
    console.log(chalk.cyan('Validation Metadata:'));
    const metaTable = new Table({ head: ['Property', 'Value'], colWidths: [25, 50] });
    metaTable.push(['Template ID', result.metadata.templateId]);
    metaTable.push(['Template Type', result.metadata.templateType]);
    metaTable.push(['Validation ID', result.metadata.validationId]);
    metaTable.push(['Validated At', result.metadata.validatedAt]);
    metaTable.push(['Duration', `${result.metadata.validationDuration}ms`]);
    metaTable.push(['Checks Performed', result.metadata.checksPerformed.length]);
    console.log(metaTable.toString());
    console.log();
  }

  // Display errors
  if (result.errors && result.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    const errorTable = new Table({ head: ['Code', 'Message', 'Severity'], colWidths: [20, 60, 10] });
    result.errors.forEach(error => {
      errorTable.push([error.code || 'UNKNOWN', error.message, error.severity || 'error']);
    });
    console.log(errorTable.toString());
    console.log();
  }

  // Display warnings
  if (result.warnings && result.warnings.length > 0) {
    console.log(chalk.yellow('Warnings:'));
    const warningTable = new Table({ head: ['Code', 'Message'], colWidths: [20, 70] });
    result.warnings.forEach(warning => {
      warningTable.push([warning.code || 'UNKNOWN', warning.message]);
    });
    console.log(warningTable.toString());
    console.log();
  }

  // Display checks performed
  if (result.metadata && result.metadata.checksPerformed) {
    console.log(chalk.cyan('Checks Performed:'));
    const checksTable = new Table({ head: ['Check', 'Status', 'Duration'], colWidths: [30, 15, 15] });
    result.metadata.checksPerformed.forEach(check => {
      checksTable.push([check.name, check.passed ? chalk.green('✓') : chalk.red('✗'), `${check.duration}ms`]);
    });
    console.log(checksTable.toString());
  }
}

/**
 * Display package validation result
 * @param {Object} result - Package validation result
 */
function displayPackageValidationResult(result) {
  console.log(chalk.bold('Package.json Validation Results:'));

  if (result.isValid) {
    console.log(chalk.green('✓ Package.json is valid'));
  } else {
    console.log(chalk.red('✗ Package.json has issues'));
  }

  console.log();

  if (result.errors && result.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    result.errors.forEach(error => {
      console.log(chalk.red(`  • ${error.message}`));
    });
    console.log();
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log(chalk.yellow('Warnings:'));
    result.warnings.forEach(warning => {
      console.log(chalk.yellow(`  • ${warning.message}`));
    });
    console.log();
  }

  if (result.packageInfo) {
    console.log(chalk.cyan('Package Information:'));
    const infoTable = new Table({ head: ['Property', 'Value'], colWidths: [15, 60] });
    infoTable.push(['Name', result.packageInfo.name]);
    infoTable.push(['Version', result.packageInfo.version]);
    infoTable.push(['Type', result.packageInfo.type]);
    infoTable.push(['Template Engine', result.packageInfo.templateEngine]);
    infoTable.push(['Has Config', result.packageInfo.hasConfig ? 'Yes' : 'No']);
    console.log(infoTable.toString());
  }
}

/**
 * Display configuration validation result
 * @param {Object} result - Configuration validation result
 */
function displayConfigValidationResult(result) {
  console.log(chalk.bold('Configuration Validation Results:'));

  if (result.isValid) {
    console.log(chalk.green('✓ Configuration is valid'));
  } else {
    console.log(chalk.red('✗ Configuration has issues'));
  }

  console.log();

  if (result.errors && result.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    result.errors.forEach(error => {
      console.log(chalk.red(`  • ${error.message}`));
    });
    console.log();
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log(chalk.yellow('Warnings:'));
    result.warnings.forEach(warning => {
      console.log(chalk.yellow(`  • ${warning.message}`));
    });
    console.log();
  }

  if (result.missingProperties && result.missingProperties.length > 0) {
    console.log(chalk.yellow('Missing Properties:'));
    result.missingProperties.forEach(prop => {
      console.log(chalk.yellow(`  • ${prop}`));
    });
    console.log();
  }

  if (result.invalidProperties && result.invalidProperties.length > 0) {
    console.log(chalk.red('Invalid Properties:'));
    result.invalidProperties.forEach(prop => {
      console.log(chalk.red(`  • ${prop.property}: ${prop.error}`));
    });
    console.log();
  }
}

/**
 * Display security validation result
 * @param {Object} result - Security validation result
 */
function displaySecurityValidationResult(result) {
  console.log(chalk.bold('Security Validation Results:'));

  if (result.isValid) {
    console.log(chalk.green('✓ Template is secure'));
  } else {
    console.log(chalk.red('✗ Security issues found'));
  }

  console.log();

  if (result.issues && result.issues.length > 0) {
    console.log(chalk.red('Security Issues:'));
    const issueTable = new Table({ head: ['Type', 'Severity', 'File', 'Description'], colWidths: [15, 10, 30, 35] });
    result.issues.forEach(issue => {
      issueTable.push([issue.type, issue.severity, issue.file, issue.description]);
    });
    console.log(issueTable.toString());
    console.log();
  }

  if (result.filesScanned !== undefined) {
    console.log(chalk.cyan('Security Scan Summary:'));
    const summaryTable = new Table({ head: ['Property', 'Value'], colWidths: [20, 50] });
    summaryTable.push(['Files Scanned', result.filesScanned]);
    summaryTable.push(['Suspicious Files', result.suspiciousFiles || 0]);
    summaryTable.push(['Vulnerabilities Found', result.vulnerabilitiesFound || 0]);
    summaryTable.push(['Dependencies Checked', result.dependenciesChecked || 0]);
    console.log(summaryTable.toString());
  }
}

module.exports = validateCommand;