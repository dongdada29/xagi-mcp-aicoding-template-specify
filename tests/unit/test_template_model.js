/**
 * Template Model Unit Tests
 * Tests template data model functionality
 */

const Template = require('../../src/models/template');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Mock dependencies
jest.mock('ajv');
jest.mock('ajv-formats');

describe('Template', () => {
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
    test('should create Template with minimal valid data', () => {
      const templateData = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next'
      };

      const template = new Template(templateData);

      expect(template.id).toBe('test-template');
      expect(template.name).toBe('Test Template');
      expect(template.version).toBe('1.0.0');
      expect(template.type).toBe('react-next');
      expect(template.enabled).toBe(true);
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
    });

    test('should create Template with all properties', () => {
      const templateData = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        description: 'Test template description',
        author: 'Test Author',
        repository: 'https://github.com/test/repo',
        homepage: 'https://test.com',
        keywords: ['react', 'next', 'template'],
        license: 'MIT',
        files: ['package.json', 'src/index.js'],
        config: {
          variables: {},
          dependencies: {},
          scripts: {}
        },
        enabled: false,
        priority: 5
      };

      const template = new Template(templateData);

      expect(template.id).toBe('test-template');
      expect(template.name).toBe('Test Template');
      expect(template.version).toBe('1.0.0');
      expect(template.type).toBe('react-next');
      expect(template.description).toBe('Test template description');
      expect(template.author).toBe('Test Author');
      expect(template.repository).toBe('https://github.com/test/repo');
      expect(template.homepage).toBe('https://test.com');
      expect(template.keywords).toEqual(['react', 'next', 'template']);
      expect(template.license).toBe('MIT');
      expect(template.files).toEqual(['package.json', 'src/index.js']);
      expect(template.config).toEqual({
        variables: {},
        dependencies: {},
        scripts: {}
      });
      expect(template.enabled).toBe(false);
      expect(template.priority).toBe(5);
    });

    test('should throw error for missing required fields', () => {
      const invalidData = {
        name: 'Test Template'
        // Missing id, version, type
      };

      expect(() => new Template(invalidData)).toThrow('Template id, name, version, and type are required');
    });
  });

  describe('Schema Validation', () => {
    test('should validate template data against schema', () => {
      const templateData = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next'
      };

      mockAjv.validate.mockReturnValue(true);

      const template = new Template(templateData);

      expect(mockAjv.validate).toHaveBeenCalledWith(expect.any(Object), templateData);
    });

    test('should throw error for invalid schema', () => {
      const invalidData = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'invalid-type'
      };

      mockAjv.validate.mockReturnValue(false);
      mockAjv.errors = [
        {
          instancePath: '/type',
          schemaPath: '#/properties/type/enum',
          keyword: 'enum',
          params: { allowedValues: ['react-next', 'vue', 'nodejs'] },
          message: 'must be equal to one of the allowed values'
        }
      ];

      expect(() => new Template(invalidData)).toThrow('Template validation failed');
    });
  });

  describe('validateConfig', () => {
    let template;

    beforeEach(() => {
      template = new Template({
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        config: {
          variables: {
            projectName: {
              type: 'string',
              required: true,
              description: 'Project name'
            }
          },
          dependencies: {},
          scripts: {}
        }
      });
    });

    test('should validate valid configuration', () => {
      const config = {
        projectName: 'my-project'
      };

      const result = template.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should detect missing required variables', () => {
      const config = {};

      const result = template.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('projectName');
      expect(result.errors[0].message).toContain('required');
    });

    test('should validate variable types', () => {
      template.config.variables.projectAge = {
        type: 'number',
        required: false
      };

      const config = {
        projectName: 'my-project',
        projectAge: 'not-a-number'
      };

      const result = template.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('projectAge');
      expect(result.errors[0].message).toContain('number');
    });

    test('should allow additional variables not in schema', () => {
      const config = {
        projectName: 'my-project',
        extraVariable: 'extra-value'
      };

      const result = template.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should handle empty config schema', () => {
      template.config.variables = {};

      const config = {
        anyVariable: 'any-value'
      };

      const result = template.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('getRequiredVariables', () => {
    test('should return list of required variables', () => {
      const template = new Template({
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        config: {
          variables: {
            projectName: {
              type: 'string',
              required: true
            },
            description: {
              type: 'string',
              required: false
            },
            port: {
              type: 'number',
              required: true
            }
          }
        }
      });

      const requiredVars = template.getRequiredVariables();

      expect(requiredVars).toEqual(['projectName', 'port']);
    });

    test('should return empty array when no required variables', () => {
      const template = new Template({
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        config: {
          variables: {
            description: {
              type: 'string',
              required: false
            }
          }
        }
      });

      const requiredVars = template.getRequiredVariables();

      expect(requiredVars).toEqual([]);
    });

    test('should handle missing variables config', () => {
      const template = new Template({
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        config: {}
      });

      const requiredVars = template.getRequiredVariables();

      expect(requiredVars).toEqual([]);
    });
  });

  describe('toJSON', () => {
    test('should return serializable object', () => {
      const template = new Template({
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next'
      });

      const json = template.toJSON();

      expect(json.id).toBe('test-template');
      expect(json.name).toBe('Test Template');
      expect(json.version).toBe('1.0.0');
      expect(json.type).toBe('react-next');
      expect(json.enabled).toBe(true);
      expect(json.createdAt).toBeDefined();
      expect(json.updatedAt).toBeDefined();
    });

    test('should include all properties in JSON', () => {
      const template = new Template({
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        description: 'Test description',
        keywords: ['react', 'next']
      });

      const json = template.toJSON();

      expect(json).toEqual({
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        description: 'Test description',
        author: '',
        repository: '',
        homepage: '',
        keywords: ['react', 'next'],
        license: '',
        files: [],
        config: { variables: {}, dependencies: {}, scripts: {} },
        enabled: true,
        priority: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });
  });

  describe('fromJSON', () => {
    test('should create Template from JSON object', () => {
      const json = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        description: 'Test description',
        enabled: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      const template = Template.fromJSON(json);

      expect(template.id).toBe('test-template');
      expect(template.name).toBe('Test Template');
      expect(template.version).toBe('1.0.0');
      expect(template.type).toBe('react-next');
      expect(template.description).toBe('Test description');
      expect(template.enabled).toBe(false);
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
    });

    test('should handle missing optional fields', () => {
      const json = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next'
      };

      const template = Template.fromJSON(json);

      expect(template.id).toBe('test-template');
      expect(template.name).toBe('Test Template');
      expect(template.version).toBe('1.0.0');
      expect(template.type).toBe('react-next');
      expect(template.enabled).toBe(true);
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Static Methods', () => {
    test('should get supported template types', () => {
      const types = Template.getSupportedTypes();

      expect(types).toEqual([
        'react-next',
        'vue',
        'nodejs',
        'angular',
        'svelte',
        'express',
        'fastapi',
        'django',
        'flask',
        'spring-boot',
        'dotnet',
        'go',
        'rust',
        'python-lib',
        'npm-package',
        'monorepo',
        'microservice'
      ]);
    });

    test('should validate template type', () => {
      expect(Template.isValidType('react-next')).toBe(true);
      expect(Template.isValidType('vue')).toBe(true);
      expect(Template.isValidType('invalid-type')).toBe(false);
    });

    test('should get schema', () => {
      const schema = Template.getSchema();

      expect(schema).toEqual(expect.objectContaining({
        type: 'object',
        properties: expect.any(Object),
        required: expect.any(Array)
      }));
    });
  });
});