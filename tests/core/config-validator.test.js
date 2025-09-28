/**
 * ConfigValidator Service Tests
 * Tests the ConfigValidator service implementation
 */

const { ConfigValidator, ValidationError } = require('../../src/core/config-validator');
const { ProjectConfiguration } = require('../../src/models/config');

describe('ConfigValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('Constructor and Basic Setup', () => {
    test('should create a new ConfigValidator instance', () => {
      expect(validator).toBeInstanceOf(ConfigValidator);
      expect(validator.schemas).toBeInstanceOf(Map);
      expect(validator.compiledSchemas).toBeInstanceOf(Map);
    });

    test('should initialize with common schemas', () => {
      const registeredSchemas = validator.getRegisteredSchemas();
      expect(registeredSchemas).toContain('project-config');
      expect(registeredSchemas).toContain('template-config');
    });
  });

  describe('Schema Registration', () => {
    test('should register a valid schema', () => {
      const testSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      };

      expect(() => {
        validator.registerSchema('test-schema', testSchema);
      }).not.toThrow();

      expect(validator.getRegisteredSchemas()).toContain('test-schema');
    });

    test('should throw ValidationError for invalid schema name', () => {
      const testSchema = { type: 'object' };

      expect(() => {
        validator.registerSchema(null, testSchema);
      }).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid schema object', () => {
      expect(() => {
        validator.registerSchema('test-schema', null);
      }).toThrow(ValidationError);
    });

    test('should get registered schema', () => {
      const testSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      validator.registerSchema('test-schema', testSchema);
      const retrievedSchema = validator.getSchema('test-schema');
      expect(retrievedSchema).toEqual(testSchema);
    });

    test('should throw ValidationError for non-existent schema', () => {
      expect(() => {
        validator.getSchema('non-existent-schema');
      }).toThrow(ValidationError);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration against schema name', () => {
      const config = {
        templateId: 'test-template',
        projectName: 'test-project',
        projectPath: './test-project'
      };

      const result = validator.validateConfiguration(config, 'project-config');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    test('should validate configuration against schema object', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      };

      const config = {
        name: 'John Doe',
        age: 30
      };

      const result = validator.validateConfiguration(config, schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should return validation errors for invalid configuration', () => {
      const config = {
        templateId: '', // Invalid: empty string
        projectName: 'Invalid Project Name!', // Invalid: contains special chars
        projectPath: '' // Invalid: empty string
      };

      const result = validator.validateConfiguration(config, 'project-config');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should throw ValidationError for invalid schema name', () => {
      const config = { name: 'test' };

      expect(() => {
        validator.validateConfiguration(config, 'non-existent-schema');
      }).toThrow(ValidationError);
    });
  });

  describe('Project Name Validation', () => {
    test('should validate valid project names', () => {
      const validNames = ['my-project', 'my_project', 'myProject', 'project123'];

      for (const name of validNames) {
        const result = validator.validateProjectName(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });

    test('should reject invalid project names', () => {
      const invalidNames = [
        '', // Empty
        'My Project', // Contains space
        'project!', // Contains special character
        'node', // Reserved name
        'a'.repeat(51) // Too long
      ];

      for (const name of invalidNames) {
        const result = validator.validateProjectName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('should check project name availability', () => {
      const existingNames = ['existing-project', 'another-project'];

      const result = validator.validateProjectName('existing-project', {
        checkAvailability: true,
        existingNames: existingNames
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project name \'existing-project\' is already in use');
    });

    test('should provide suggestions for invalid names', () => {
      const result = validator.validateProjectName('node');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Project Path Validation', () => {
    test('should validate valid project paths', async() => {
      const validPaths = [
        './test-project',
        '/tmp/test-project',
        './my-project'
      ];

      for (const path of validPaths) {
        const result = await validator.validateProjectPath(path, {
          checkWritePermission: false,
          checkExists: false
        });
        expect(result.isValid).toBe(true);
      }
    });

    test('should reject invalid project paths', async() => {
      const invalidPaths = [
        '', // Empty
        'invalid/path', // Contains invalid characters
        'a'.repeat(4100) // Too long
      ];

      for (const path of invalidPaths) {
        const result = await validator.validateProjectPath(path);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test('should check for existing directories', async() => {
      // Test with current directory (should exist)
      const result = await validator.validateProjectPath('.', {
        checkExists: true,
        allowOverwrite: false
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Directory \'.\' already exists');
    });
  });

  describe('Template Configuration Validation', () => {
    test('should validate valid template configuration', () => {
      const templateConfig = {
        name: 'Test Template',
        version: '1.0.0',
        description: 'A test template',
        license: 'MIT',
        dependencies: {
          'lodash': '^4.17.21'
        }
      };

      const result = validator.validateTemplateConfig(templateConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate template configuration with custom schema', () => {
      const customSchema = {
        type: 'object',
        properties: {
          customField: { type: 'string' }
        },
        required: ['customField']
      };

      const templateConfig = {
        customField: 'custom-value'
      };

      const result = validator.validateTemplateConfig(templateConfig, customSchema);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid template configuration', () => {
      const templateConfig = {
        name: '', // Invalid: empty
        version: 'invalid-version', // Invalid: not semver
        dependencies: {
          '': '1.0.0' // Invalid: empty dependency name
        }
      };

      const result = validator.validateTemplateConfig(templateConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate dependencies', () => {
      const templateConfig = {
        dependencies: {
          'invalid@name': '1.0.0', // Invalid: contains @
          'valid-name': '' // Invalid: empty version
        }
      };

      const result = validator.validateTemplateConfig(templateConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate scripts', () => {
      const templateConfig = {
        scripts: {
          '': 'echo test', // Invalid: empty script name
          'test': '' // Invalid: empty command
        }
      };

      const result = validator.validateTemplateConfig(templateConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Formatting and Validation Helpers', () => {
    test('should format validation errors correctly', () => {
      const validationResult = {
        isValid: false,
        errors: ['Field test: must be string'],
        suggestions: ['Try using a string value']
      };

      const formattedErrors = validator.getValidationErrors(validationResult);
      expect(formattedErrors).toContain('Field test: must be string');
      expect(formattedErrors).toContain('Suggestion: Try using a string value');
    });

    test('should return empty array for valid validation result', () => {
      const validationResult = {
        isValid: true,
        errors: [],
        suggestions: []
      };

      const formattedErrors = validator.getValidationErrors(validationResult);
      expect(formattedErrors).toEqual([]);
    });

    test('should handle null/undefined validation result', () => {
      const formattedErrors1 = validator.getValidationErrors(null);
      const formattedErrors2 = validator.getValidationErrors(undefined);

      expect(formattedErrors1).toContain('Invalid validation result');
      expect(formattedErrors2).toContain('Invalid validation result');
    });

    test('should check if configuration is valid', () => {
      const validConfig = {
        templateId: 'test',
        projectName: 'test-project',
        projectPath: './test'
      };

      const invalidConfig = {
        templateId: '',
        projectName: 'test-project',
        projectPath: './test'
      };

      expect(validator.isValidConfiguration(validConfig, 'project-config')).toBe(true);
      expect(validator.isValidConfiguration(invalidConfig, 'project-config')).toBe(false);
    });
  });

  describe('ProjectConfiguration Integration', () => {
    test('should validate ProjectConfiguration instance', () => {
      const config = new ProjectConfiguration({
        templateId: 'test-template',
        projectName: 'testproject',
        projectPath: './test-project'
      });

      const result = validator.validateProjectConfiguration(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject invalid ProjectConfiguration instance', () => {
      expect(() => {
        validator.validateProjectConfiguration({});
      }).toThrow(ValidationError);
    });

    test('should validate complex ProjectConfiguration with config values', () => {
      const config = new ProjectConfiguration({
        templateId: 'react-template',
        projectName: 'reactapp',
        projectPath: './react-app',
        configValues: {
          framework: 'react',
          language: 'typescript',
          features: ['router', 'state-management']
        },
        overrides: {
          buildTool: 'vite'
        }
      });

      const result = validator.validateProjectConfiguration(config);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Schema Management', () => {
    test('should clear all schemas and reinitialize common ones', () => {
      // Add a custom schema
      validator.registerSchema('temp-schema', { type: 'object' });
      expect(validator.getRegisteredSchemas()).toContain('temp-schema');

      // Clear schemas
      validator.clearSchemas();

      // Should only have common schemas
      const schemas = validator.getRegisteredSchemas();
      expect(schemas).toContain('project-config');
      expect(schemas).toContain('template-config');
      expect(schemas).not.toContain('temp-schema');
    });

    test('should provide access to AJV instance', () => {
      const ajvInstance = validator.getAjvInstance();
      expect(ajvInstance).toBeDefined();
      expect(typeof ajvInstance.compile).toBe('function');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle configuration with additional properties', () => {
      const config = {
        templateId: 'test',
        projectName: 'test-project',
        projectPath: './test',
        additionalProp: 'value' // Not in schema
      };

      const result = validator.validateConfiguration(config, 'project-config');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Additional property \'additionalProp\' is not allowed');
    });

    test('should handle configuration with nested objects', () => {
      const config = {
        templateId: 'test',
        projectName: 'test-project',
        projectPath: './test',
        configValues: {
          nested: {
            value: 'test'
          }
        }
      };

      const result = validator.validateConfiguration(config, 'project-config');
      expect(result.isValid).toBe(true);
    });

    test('should handle null values appropriately', () => {
      const config = {
        templateId: null,
        projectName: 'test-project',
        projectPath: './test'
      };

      const result = validator.validateConfiguration(config, 'project-config');
      expect(result.isValid).toBe(false);
    });
  });
});
