/**
 * Tests for ProjectConfiguration model
 */

const { ProjectConfiguration, ConfigurationError, CONFIG_STATUS } = require('../../src/models/config');

// Mock the validation utilities at the module level
jest.mock('../../../src/utils/validation', () => ({
  validateProjectName: jest.fn((name) => ({
    isValid: typeof name === 'string' && name.length > 0 && /^[a-z][a-z0-9-]*$/.test(name),
    errors: typeof name !== 'string' ? ['Project name must be a string'] :
           name.length === 0 ? ['Project name cannot be empty'] :
           !/^[a-z][a-z0-9-]*$/.test(name) ? ['Project name must start with letter and contain only letters, numbers, and hyphens'] :
           []
  })),
  validateFilePath: jest.fn((path) => ({
    isValid: typeof path === 'string' && path.length > 0 && !path.includes('..'),
    errors: typeof path !== 'string' ? ['Path must be a string'] :
           path.length === 0 ? ['Path cannot be empty'] :
           path.includes('..') ? ['Path cannot contain ".."'] :
           []
  })),
  validateConfig: jest.fn((config, schema) => ({
    isValid: true,
    errors: [],
    warnings: []
  })),
  validateRegistryUrl: jest.fn((url) => ({
    isValid: typeof url === 'string' && url.length > 0 && url.startsWith('http'),
    errors: typeof url !== 'string' ? ['Registry URL must be a string'] :
           url.length === 0 ? ['Registry URL cannot be empty'] :
           !url.startsWith('http') ? ['Registry URL must start with http:// or https://'] :
           []
  }))
}));

describe('ProjectConfiguration', () => {
  const validConfig = {
    templateId: '@xagi/ai-template-react-next',
    projectName: 'my-project',
    projectPath: '/tmp/my-project',
    version: '1.0.0',
    configValues: { framework: 'react', language: 'typescript' },
    overrides: { port: 3000 }
  };

  describe('Constructor', () => {
    test('should create instance with valid configuration', () => {
      const config = new ProjectConfiguration(validConfig);
      expect(config).toBeInstanceOf(ProjectConfiguration);
      expect(config.templateId).toBe(validConfig.templateId);
      expect(config.projectName).toBe(validConfig.projectName);
      expect(config.projectPath).toBe(validConfig.projectPath);
      expect(config.version).toBe(validConfig.version);
      expect(config.configValues).toEqual(validConfig.configValues);
      expect(config.overrides).toEqual(validConfig.overrides);
      expect(config.registry).toBe('https://registry.npmjs.org');
      expect(config.status).toBe(CONFIG_STATUS.DRAFT);
      expect(config.id).toBeDefined();
      expect(config.createdAt).toBeInstanceOf(Date);
    });

    test('should use default values when not provided', () => {
      const config = new ProjectConfiguration({
        templateId: '@xagi/ai-template-react-next',
        projectName: 'my-project',
        projectPath: '/tmp/my-project'
      });

      expect(config.version).toBe('latest');
      expect(config.configValues).toEqual({});
      expect(config.overrides).toEqual({});
      expect(config.registry).toBe('https://registry.npmjs.org');
      expect(config.authToken).toBeNull();
      expect(config.status).toBe(CONFIG_STATUS.DRAFT);
    });

    test('should throw error for missing required fields', () => {
      expect(() => new ProjectConfiguration({})).toThrow(ConfigurationError);
      expect(() => new ProjectConfiguration({ templateId: 'test' })).toThrow(ConfigurationError);
      expect(() => new ProjectConfiguration({ templateId: 'test', projectName: 'test' })).toThrow(ConfigurationError);
    });

    test('should throw error for invalid templateId', () => {
      expect(() => new ProjectConfiguration({
        ...validConfig,
        templateId: ''
      })).toThrow(ConfigurationError);

      expect(() => new ProjectConfiguration({
        ...validConfig,
        templateId: null
      })).toThrow(ConfigurationError);
    });

    test('should throw error for invalid projectName', () => {
      expect(() => new ProjectConfiguration({
        ...validConfig,
        projectName: 'Invalid Project Name'
      })).toThrow(ConfigurationError);
    });

    test('should throw error for invalid projectPath', () => {
      expect(() => new ProjectConfiguration({
        ...validConfig,
        projectPath: '../invalid-path'
      })).toThrow(ConfigurationError);
    });

    test('should throw error for invalid status', () => {
      expect(() => new ProjectConfiguration({
        ...validConfig,
        status: 'invalid-status'
      })).toThrow(ConfigurationError);
    });
  });

  describe('Validation', () => {
    test('should validate basic configuration', () => {
      const config = new ProjectConfiguration(validConfig);
      const result = config.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate against template schema', () => {
      const config = new ProjectConfiguration(validConfig);
      const schema = {
        type: 'object',
        properties: {
          framework: { type: 'string' },
          language: { type: 'string' }
        },
        required: ['framework']
      };

      const result = config.validate(schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle validation errors', () => {
      const config = new ProjectConfiguration(validConfig);

      // Mock validation to return errors
      const { validateConfig } = require('../../../src/utils/validation');
      validateConfig.mockReturnValue({
        isValid: false,
        errors: ['Schema validation failed']
      });

      const result = config.validate({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Schema validation failed');

      // Reset mock
      validateConfig.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: []
      });
    });
  });

  describe('Configuration Management', () => {
    let config;

    beforeEach(() => {
      config = new ProjectConfiguration(validConfig);
    });

    test('should set and get configuration values', () => {
      config.setConfig('newKey', 'newValue');
      expect(config.getConfig('newKey')).toBe('newValue');

      config.setConfig('nested.key', 'nestedValue');
      expect(config.getConfig('nested.key')).toBe('nestedValue');
    });

    test('should get default value for missing keys', () => {
      expect(config.getConfig('missingKey')).toBeUndefined();
      expect(config.getConfig('missingKey', 'default')).toBe('default');
    });

    test('should throw error for invalid keys in setConfig', () => {
      expect(() => config.setConfig('', 'value')).toThrow(ConfigurationError);
      expect(() => config.setConfig(null, 'value')).toThrow(ConfigurationError);
    });

    test('should set and get overrides', () => {
      config.setOverride('overrideKey', 'overrideValue');
      expect(config.getOverride('overrideKey')).toBe('overrideValue');
    });

    test('should update status', () => {
      config.updateStatus(CONFIG_STATUS.ACTIVE);
      expect(config.status).toBe(CONFIG_STATUS.ACTIVE);
    });

    test('should throw error for invalid status update', () => {
      expect(() => config.updateStatus('invalid')).toThrow(ConfigurationError);
    });
  });

  describe('Serialization', () => {
    test('should serialize to JSON', () => {
      const config = new ProjectConfiguration(validConfig);
      const json = config.toJSON();

      expect(json.id).toBe(config.id);
      expect(json.templateId).toBe(config.templateId);
      expect(json.projectName).toBe(config.projectName);
      expect(json.projectPath).toBe(config.projectPath);
      expect(json.version).toBe(config.version);
      expect(json.configValues).toEqual(config.configValues);
      expect(json.overrides).toEqual(config.overrides);
      expect(json.registry).toBe(config.registry);
      expect(json.authToken).toBe(config.authToken);
      expect(json.createdAt).toBe(config.createdAt.toISOString());
      expect(json.status).toBe(config.status);
    });

    test('should create from JSON', () => {
      const original = new ProjectConfiguration(validConfig);
      const json = original.toJSON();
      const cloned = ProjectConfiguration.fromJSON(json);

      expect(cloned).toBeInstanceOf(ProjectConfiguration);
      expect(cloned.id).toBe(original.id);
      expect(cloned.templateId).toBe(original.templateId);
      expect(cloned.projectName).toBe(original.projectName);
      expect(cloned.projectPath).toBe(original.projectPath);
    });

    test('should create from JSON string', () => {
      const original = new ProjectConfiguration(validConfig);
      const jsonString = JSON.stringify(original.toJSON());
      const cloned = ProjectConfiguration.fromJSONString(jsonString);

      expect(cloned).toBeInstanceOf(ProjectConfiguration);
      expect(cloned.id).toBe(original.id);
    });

    test('should throw error for invalid JSON', () => {
      expect(() => ProjectConfiguration.fromJSON(null)).toThrow(ConfigurationError);
      expect(() => ProjectConfiguration.fromJSONString('invalid')).toThrow(ConfigurationError);
      expect(() => ProjectConfiguration.fromJSONString('')).toThrow(ConfigurationError);
    });
  });

  describe('Cloning', () => {
    test('should create clone with new ID', () => {
      const original = new ProjectConfiguration(validConfig);
      const cloned = original.clone();

      expect(cloned).toBeInstanceOf(ProjectConfiguration);
      expect(cloned.id).not.toBe(original.id);
      expect(cloned.templateId).toBe(original.templateId);
      expect(cloned.projectName).toBe(original.projectName);
      expect(cloned.projectPath).toBe(original.projectPath);
    });

    test('should create clone with overrides', () => {
      const original = new ProjectConfiguration(validConfig);
      const cloned = original.clone({
        projectName: 'cloned-project',
        version: '2.0.0'
      });

      expect(cloned.projectName).toBe('cloned-project');
      expect(cloned.version).toBe('2.0.0');
      expect(cloned.templateId).toBe(original.templateId);
    });
  });

  describe('Static Properties', () => {
    test('should expose status constants', () => {
      expect(ProjectConfiguration.Status).toBe(CONFIG_STATUS);
      expect(ProjectConfiguration.Status.DRAFT).toBe('draft');
      expect(ProjectConfiguration.Status.ACTIVE).toBe('active');
      expect(ProjectConfiguration.Status.COMPLETED).toBe('completed');
      expect(ProjectConfiguration.Status.FAILED).toBe('failed');
    });

    test('should expose default registry', () => {
      expect(ProjectConfiguration.DefaultRegistry).toBe('https://registry.npmjs.org');
    });
  });

  describe('Error Handling', () => {
    test('ConfigurationError should have proper structure', () => {
      const error = new ConfigurationError('Test error', 'testField');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Test error');
      expect(error.field).toBe('testField');
      expect(error.isConfigurationError).toBe(true);
    });
  });
});