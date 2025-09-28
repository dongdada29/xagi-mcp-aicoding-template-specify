/**
 * Config Model Unit Tests
 * Tests configuration data model functionality
 */

const Config = require('../../src/models/config');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Mock dependencies
jest.mock('ajv');
jest.mock('ajv-formats');

describe('Config', () => {
  let mockAjv;
  let mockAddFormats;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Ajv
    mockAjv = {
      validate: jest.fn(),
      errors: null,
      addSchema: jest.fn(),
      getSchema: jest.fn()
    };

    mockAddFormats = jest.fn();

    Ajv.mockImplementation(() => mockAjv);
    addFormats.mockImplementation((ajv) => {
      // Mock adding formats
      ajv.addFormat = jest.fn();
      return ajv;
    });
  });

  describe('Constructor', () => {
    test('should create Config with minimal valid data', () => {
      const configData = {
        id: 'test-config',
        name: 'Test Config'
      };

      const config = new Config(configData);

      expect(config.id).toBe('test-config');
      expect(config.name).toBe('Test Config');
      expect(config.enabled).toBe(true);
      expect(config.createdAt).toBeInstanceOf(Date);
      expect(config.updatedAt).toBeInstanceOf(Date);
    });

    test('should create Config with all properties', () => {
      const configData = {
        id: 'test-config',
        name: 'Test Config',
        description: 'Test configuration',
        version: '1.0.0',
        type: 'template',
        settings: {
          theme: 'dark',
          language: 'en'
        },
        variables: {
          projectName: 'my-project'
        },
        dependencies: {
          react: '^18.0.0'
        },
        scripts: {
          build: 'npm run build'
        },
        enabled: false,
        priority: 3,
        tags: ['frontend', 'react'],
        metadata: {
          author: 'Test Author'
        }
      };

      const config = new Config(configData);

      expect(config.id).toBe('test-config');
      expect(config.name).toBe('Test Config');
      expect(config.description).toBe('Test configuration');
      expect(config.version).toBe('1.0.0');
      expect(config.type).toBe('template');
      expect(config.settings).toEqual({ theme: 'dark', language: 'en' });
      expect(config.variables).toEqual({ projectName: 'my-project' });
      expect(config.dependencies).toEqual({ react: '^18.0.0' });
      expect(config.scripts).toEqual({ build: 'npm run build' });
      expect(config.enabled).toBe(false);
      expect(config.priority).toBe(3);
      expect(config.tags).toEqual(['frontend', 'react']);
      expect(config.metadata).toEqual({ author: 'Test Author' });
    });

    test('should throw error for missing required fields', () => {
      const invalidData = {
        name: 'Test Config'
        // Missing id
      };

      expect(() => new Config(invalidData)).toThrow('Config id and name are required');
    });

    test('should provide default values for optional fields', () => {
      const configData = {
        id: 'test-config',
        name: 'Test Config'
      };

      const config = new Config(configData);

      expect(config.description).toBe('');
      expect(config.version).toBe('1.0.0');
      expect(config.type).toBe('general');
      expect(config.settings).toEqual({});
      expect(config.variables).toEqual({});
      expect(config.dependencies).toEqual({});
      expect(config.scripts).toEqual({});
      expect(config.enabled).toBe(true);
      expect(config.priority).toBe(0);
      expect(config.tags).toEqual([]);
      expect(config.metadata).toEqual({});
    });
  });

  describe('Schema Validation', () => {
    test('should validate config data against schema', () => {
      const configData = {
        id: 'test-config',
        name: 'Test Config'
      };

      mockAjv.validate.mockReturnValue(true);

      const config = new Config(configData);

      expect(mockAjv.validate).toHaveBeenCalledWith(expect.any(Object), configData);
    });

    test('should throw error for invalid schema', () => {
      const invalidData = {
        id: 'test-config',
        name: 'Test Config',
        type: 'invalid-type'
      };

      mockAjv.validate.mockReturnValue(false);
      mockAjv.errors = [
        {
          instancePath: '/type',
          schemaPath: '#/properties/type/enum',
          keyword: 'enum',
          params: { allowedValues: ['template', 'registry', 'system'] },
          message: 'must be equal to one of the allowed values'
        }
      ];

      expect(() => new Config(invalidData)).toThrow('Config validation failed');
    });
  });

  describe('getSetting', () => {
    let config;

    beforeEach(() => {
      config = new Config({
        id: 'test-config',
        name: 'Test Config',
        settings: {
          theme: 'dark',
          language: 'en',
          debug: true
        }
      });
    });

    test('should return existing setting', () => {
      expect(config.getSetting('theme')).toBe('dark');
      expect(config.getSetting('debug')).toBe(true);
    });

    test('should return default value for missing setting', () => {
      expect(config.getSetting('nonexistent', 'default')).toBe('default');
    });

    test('should return undefined for missing setting without default', () => {
      expect(config.getSetting('nonexistent')).toBeUndefined();
    });
  });

  describe('setSetting', () => {
    let config;

    beforeEach(() => {
      config = new Config({
        id: 'test-config',
        name: 'Test Config',
        settings: {
          theme: 'dark'
        }
      });
    });

    test('should update existing setting', () => {
      config.setSetting('theme', 'light');

      expect(config.settings.theme).toBe('light');
      expect(config.updatedAt).not.toEqual(config.createdAt);
    });

    test('should add new setting', () => {
      config.setSetting('language', 'es');

      expect(config.settings.language).toBe('es');
      expect(config.updatedAt).not.toEqual(config.createdAt);
    });

    test('should remove setting when value is undefined', () => {
      config.setSetting('theme', undefined);

      expect(config.settings.theme).toBeUndefined();
    });

    test('should handle nested settings', () => {
      config.setSetting('ui.header.color', 'blue');

      expect(config.settings.ui.header.color).toBe('blue');
    });
  });

  describe('getVariable', () => {
    let config;

    beforeEach(() => {
      config = new Config({
        id: 'test-config',
        name: 'Test Config',
        variables: {
          projectName: 'my-project',
          version: '1.0.0'
        }
      });
    });

    test('should return existing variable', () => {
      expect(config.getVariable('projectName')).toBe('my-project');
    });

    test('should return default value for missing variable', () => {
      expect(config.getVariable('nonexistent', 'default')).toBe('default');
    });

    test('should return undefined for missing variable without default', () => {
      expect(config.getVariable('nonexistent')).toBeUndefined();
    });
  });

  describe('setVariable', () => {
    let config;

    beforeEach(() => {
      config = new Config({
        id: 'test-config',
        name: 'Test Config',
        variables: {
          projectName: 'my-project'
        }
      });
    });

    test('should update existing variable', () => {
      config.setVariable('projectName', 'new-project');

      expect(config.variables.projectName).toBe('new-project');
      expect(config.updatedAt).not.toEqual(config.createdAt);
    });

    test('should add new variable', () => {
      config.setVariable('version', '2.0.0');

      expect(config.variables.version).toBe('2.0.0');
      expect(config.updatedAt).not.toEqual(config.createdAt);
    });

    test('should remove variable when value is undefined', () => {
      config.setVariable('projectName', undefined);

      expect(config.variables.projectName).toBeUndefined();
    });
  });

  describe('merge', () => {
    let config1;
    let config2;

    beforeEach(() => {
      config1 = new Config({
        id: 'config1',
        name: 'Config 1',
        settings: {
          theme: 'dark',
          language: 'en'
        },
        variables: {
          projectName: 'project1'
        }
      });

      config2 = new Config({
        id: 'config2',
        name: 'Config 2',
        settings: {
          language: 'es',
          debug: true
        },
        variables: {
          version: '1.0.0'
        }
      });
    });

    test('should merge configs correctly', () => {
      const merged = config1.merge(config2);

      expect(merged.settings).toEqual({
        theme: 'dark',
        language: 'es',
        debug: true
      });
      expect(merged.variables).toEqual({
        projectName: 'project1',
        version: '1.0.0'
      });
      expect(merged.updatedAt).not.toEqual(config1.updatedAt);
    });

    test('should handle conflict resolution with priority', () => {
      config1.priority = 2;
      config2.priority = 1;

      const merged = config1.merge(config2);

      expect(merged.settings.language).toBe('en'); // Higher priority wins
    });

    test('should throw error for invalid config', () => {
      expect(() => config1.merge({})).toThrow('Invalid config object');
    });
  });

  describe('clone', () => {
    test('should create independent copy', () => {
      const original = new Config({
        id: 'test-config',
        name: 'Test Config',
        settings: { theme: 'dark' }
      });

      const clone = original.clone();

      expect(clone.id).toBe(original.id);
      expect(clone.name).toBe(original.name);
      expect(clone.settings).toEqual(original.settings);
      expect(clone).not.toBe(original);
      expect(clone.settings).not.toBe(original.settings);
    });

    test('should modify clone without affecting original', () => {
      const original = new Config({
        id: 'test-config',
        name: 'Test Config',
        settings: { theme: 'dark' }
      });

      const clone = original.clone();
      clone.setSetting('theme', 'light');

      expect(original.settings.theme).toBe('dark');
      expect(clone.settings.theme).toBe('light');
    });
  });

  describe('toJSON', () => {
    test('should return serializable object', () => {
      const config = new Config({
        id: 'test-config',
        name: 'Test Config'
      });

      const json = config.toJSON();

      expect(json.id).toBe('test-config');
      expect(json.name).toBe('Test Config');
      expect(json.enabled).toBe(true);
      expect(json.createdAt).toBeDefined();
      expect(json.updatedAt).toBeDefined();
    });
  });

  describe('fromJSON', () => {
    test('should create Config from JSON object', () => {
      const json = {
        id: 'test-config',
        name: 'Test Config',
        description: 'Test description',
        enabled: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      const config = Config.fromJSON(json);

      expect(config.id).toBe('test-config');
      expect(config.name).toBe('Test Config');
      expect(config.description).toBe('Test description');
      expect(config.enabled).toBe(false);
      expect(config.createdAt).toBeInstanceOf(Date);
      expect(config.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Static Methods', () => {
    test('should get supported config types', () => {
      const types = Config.getSupportedTypes();

      expect(types).toEqual([
        'template',
        'registry',
        'system',
        'user',
        'project',
        'environment'
      ]);
    });

    test('should validate config type', () => {
      expect(Config.isValidType('template')).toBe(true);
      expect(Config.isValidType('registry')).toBe(true);
      expect(Config.isValidType('invalid-type')).toBe(false);
    });

    test('should get schema', () => {
      const schema = Config.getSchema();

      expect(schema).toEqual(expect.objectContaining({
        type: 'object',
        properties: expect.any(Object),
        required: expect.any(Array)
      }));
    });
  });
});