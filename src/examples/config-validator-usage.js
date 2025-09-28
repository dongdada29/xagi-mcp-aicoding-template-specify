/**
 * ConfigValidator Usage Examples
 * Demonstrates how to use the ConfigValidator service for various validation scenarios
 */

const { ConfigValidator, ValidationError } = require('../core/config-validator');
const { ProjectConfiguration } = require('../models/config');

// Create a validator instance
const validator = new ConfigValidator();

async function demonstrateConfigValidator() {
  console.log('=== ConfigValidator Usage Examples ===\n');

  // 1. Basic Configuration Validation
  console.log('1. Basic Configuration Validation');
  console.log('='.repeat(40));

  const basicConfig = {
    templateId: 'react-typescript',
    projectName: 'my-awesome-app',
    projectPath: './projects/my-awesome-app',
    version: '1.0.0',
    configValues: {
      framework: 'react',
      language: 'typescript'
    }
  };

  const basicValidation = validator.validateConfiguration(basicConfig, 'project-config');
  console.log('Configuration:', JSON.stringify(basicConfig, null, 2));
  console.log('Validation Result:', basicValidation.isValid ? '✅ Valid' : '❌ Invalid');
  if (!basicValidation.isValid) {
    console.log('Errors:', basicValidation.errors);
    console.log('Suggestions:', basicValidation.suggestions);
  }
  console.log('');

  // 2. Project Name Validation
  console.log('2. Project Name Validation');
  console.log('='.repeat(40));

  const projectNames = ['my-project', 'My Project', 'project', '123invalid', 'valid-project-name'];
  const existingNames = ['existing-project', 'another-project'];

  for (const name of projectNames) {
    const nameValidation = validator.validateProjectName(name, {
      checkAvailability: true,
      existingNames: existingNames
    });
    console.log(`Name: "${name}" - ${nameValidation.isValid ? '✅ Valid' : '❌ Invalid'}`);
    if (!nameValidation.isValid) {
      console.log('  Errors:', nameValidation.errors);
    }
    if (nameValidation.suggestions.length > 0) {
      console.log('  Suggestions:', nameValidation.suggestions);
    }
  }
  console.log('');

  // 3. Project Path Validation
  console.log('3. Project Path Validation');
  console.log('='.repeat(40));

  const testPaths = [
    './projects/my-project',
    '/tmp/test-project',
    './nonexistent-parent/project',
    './test-project' // This will test existing directory
  ];

  for (const path of testPaths) {
    try {
      const pathValidation = await validator.validateProjectPath(path, {
        checkWritePermission: true,
        checkExists: true,
        allowOverwrite: false
      });
      console.log(`Path: "${path}" - ${pathValidation.isValid ? '✅ Valid' : '❌ Invalid'}`);
      if (!pathValidation.isValid) {
        console.log('  Errors:', pathValidation.errors);
      }
      if (pathValidation.suggestions.length > 0) {
        console.log('  Suggestions:', pathValidation.suggestions);
      }
    } catch (error) {
      console.log(`Path: "${path}" - ❌ Error: ${error.message}`);
    }
  }
  console.log('');

  // 4. Template Configuration Validation
  console.log('4. Template Configuration Validation');
  console.log('='.repeat(40));

  const templateConfig = {
    name: 'React TypeScript Template',
    version: '1.0.0',
    description: 'A modern React template with TypeScript',
    author: 'XAGI Team',
    license: 'MIT',
    repository: 'https://github.com/xagi/react-typescript-template',
    keywords: ['react', 'typescript', 'template', 'xagi'],
    engines: {
      node: '>=18.0.0',
      npm: '>=8.0.0'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      typescript: '^5.0.0'
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/node': '^20.0.0'
    },
    scripts: {
      start: 'react-scripts start',
      build: 'react-scripts build',
      test: 'react-scripts test',
      'dev-server': 'webpack serve --mode development'
    }
  };

  const templateValidation = validator.validateTemplateConfig(templateConfig);
  console.log('Template Configuration:');
  console.log(JSON.stringify(templateConfig, null, 2));
  console.log('Validation Result:', templateValidation.isValid ? '✅ Valid' : '❌ Invalid');
  if (!templateValidation.isValid) {
    console.log('Errors:', templateValidation.errors);
  }
  if (templateValidation.suggestions.length > 0) {
    console.log('Suggestions:', templateValidation.suggestions);
  }
  console.log('');

  // 5. Custom Schema Registration
  console.log('5. Custom Schema Registration');
  console.log('='.repeat(40));

  const customSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://xagi.dev/schemas/custom-app.json',
    title: 'Custom Application Configuration',
    type: 'object',
    required: ['appName', 'environment'],
    properties: {
      appName: {
        type: 'string',
        description: 'Application name',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-z][a-z0-9-]*$'
      },
      environment: {
        type: 'string',
        enum: ['development', 'staging', 'production'],
        default: 'development'
      },
      port: {
        type: 'integer',
        minimum: 1024,
        maximum: 65535,
        default: 3000
      },
      database: {
        type: 'object',
        properties: {
          host: {
            type: 'string',
            format: 'hostname'
          },
          port: {
            type: 'integer',
            minimum: 1,
            maximum: 65535
          },
          name: {
            type: 'string',
            minLength: 1
          }
        },
        required: ['host', 'name']
      }
    },
    additionalProperties: false
  };

  validator.registerSchema('custom-app', customSchema);
  console.log('Custom schema registered successfully');

  const customConfig = {
    appName: 'my-app',
    environment: 'development',
    port: 3000,
    database: {
      host: 'localhost',
      port: 5432,
      name: 'myapp_db'
    }
  };

  const customValidation = validator.validateConfiguration(customConfig, 'custom-app');
  console.log('Custom Configuration:');
  console.log(JSON.stringify(customConfig, null, 2));
  console.log('Validation Result:', customValidation.isValid ? '✅ Valid' : '❌ Invalid');
  if (!customValidation.isValid) {
    console.log('Errors:', customValidation.errors);
    console.log('Suggestions:', customValidation.suggestions);
  }
  console.log('');

  // 6. ProjectConfiguration Instance Validation
  console.log('6. ProjectConfiguration Instance Validation');
  console.log('='.repeat(40));

  try {
    const projectConfig = new ProjectConfiguration({
      templateId: 'vue-typescript',
      projectName: 'vue-project',
      projectPath: './projects/vue-project',
      version: '2.0.0',
      configValues: {
        framework: 'vue',
        language: 'typescript',
        features: ['router', 'pinia', 'vitest']
      },
      overrides: {
        buildTool: 'vite'
      }
    });

    const projectValidation = validator.validateProjectConfiguration(projectConfig);
    console.log('ProjectConfiguration instance created and validated successfully');
    console.log('Validation Result:', projectValidation.isValid ? '✅ Valid' : '❌ Invalid');
    if (!projectValidation.isValid) {
      console.log('Errors:', projectValidation.errors);
      console.log('Suggestions:', projectValidation.suggestions);
    }
  } catch (error) {
    console.log('Error creating ProjectConfiguration:', error.message);
  }
  console.log('');

  // 7. Error Handling Examples
  console.log('7. Error Handling Examples');
  console.log('='.repeat(40));

  try {
    // Invalid configuration
    const invalidConfig = {
      templateId: '', // Invalid: empty string
      projectName: 'Invalid Project Name!', // Invalid: contains spaces and special chars
      projectPath: '', // Invalid: empty string
      version: 'invalid-version' // Invalid: not semver
    };

    const invalidValidation = validator.validateConfiguration(invalidConfig, 'project-config');
    console.log('Invalid Configuration Validation:');
    console.log('Result:', invalidValidation.isValid ? '✅ Valid' : '❌ Invalid');
    console.log('Errors:', invalidValidation.errors);
    console.log('Suggestions:', invalidValidation.suggestions);

    // Get formatted validation errors
    const formattedErrors = validator.getValidationErrors(invalidValidation);
    console.log('Formatted Errors:', formattedErrors);

  } catch (error) {
    console.log('Validation Error:', error.message);
  }
  console.log('');

  // 8. Schema Management
  console.log('8. Schema Management');
  console.log('='.repeat(40));

  console.log('Registered Schemas:', validator.getRegisteredSchemas());

  // Get a specific schema
  try {
    const projectSchema = validator.getSchema('project-config');
    console.log('Project Config Schema ID:', projectSchema.$id);
  } catch (error) {
    console.log('Error getting schema:', error.message);
  }

  // Test isValidConfiguration method
  const simpleConfig = {
    templateId: 'test-template',
    projectName: 'test-project',
    projectPath: './test'
  };

  const isValid = validator.isValidConfiguration(simpleConfig, 'project-config');
  console.log('Simple configuration is valid:', isValid ? '✅ Yes' : '❌ No');

  console.log('\n=== Examples Complete ===');
}

// Run the examples
if (require.main === module) {
  demonstrateConfigValidator().catch(console.error);
}

module.exports = { demonstrateConfigValidator };
