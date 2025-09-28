/**
 * TemplatePackage Model Tests
 */

const TemplatePackage = require('../../src/models/template');
const semver = require('semver');

describe('TemplatePackage Model', () => {
  let validTemplateData;

  beforeEach(() => {
    validTemplateData = {
      id: '@xagi/ai-template-react-next',
      name: 'React Next.js Template',
      version: '1.0.0',
      description: 'A comprehensive React and Next.js template for modern web applications',
      type: 'react-next',
      author: 'XAGI Team',
      keywords: ['react', 'nextjs', 'typescript', 'tailwind'],
      dependencies: {
        react: '^18.0.0',
        'next': '^13.0.0',
        'react-dom': '^18.0.0'
      },
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^18.0.0'
      },
      configSchema: {
        type: 'object',
        properties: {
          useTypescript: {
            type: 'boolean',
            default: true
          },
          useTailwind: {
            type: 'boolean',
            default: true
          }
        },
        required: []
      },
      supportedVersions: ['^1.0.0'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      downloadCount: 100
    };
  });

  describe('Constructor', () => {
    test('should create instance with valid data', () => {
      const template = new TemplatePackage(validTemplateData);
      expect(template.id).toBe('@xagi/ai-template-react-next');
      expect(template.name).toBe('React Next.js Template');
      expect(template.type).toBe('react-next');
      expect(template.version).toBe('1.0.0');
    });

    test('should use defaults when optional fields are missing', () => {
      const minimalData = {
        id: '@xagi/ai-template-react-next',
        name: 'Test Template',
        type: 'react-next'
      };

      const template = new TemplatePackage(minimalData);
      expect(template.version).toBe('1.0.0');
      expect(template.description).toBe('');
      expect(template.keywords).toEqual([]);
      expect(template.dependencies).toEqual({});
      expect(template.downloadCount).toBe(0);
    });

    test('should throw error when no data provided', () => {
      expect(() => new TemplatePackage()).toThrow('TemplatePackage data is required');
    });
  });

  describe('Validation', () => {
    test('should validate correct template data', () => {
      const template = new TemplatePackage(validTemplateData);
      const result = template.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const template = new TemplatePackage({});
      const result = template.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template ID is required');
      expect(result.errors).toContain('Template name is required');
      expect(result.errors).toContain('Template type is required');
    });

    test('should validate naming convention', () => {
      const invalidData = { ...validTemplateData, id: 'invalid-template-name' };
      const template = new TemplatePackage(invalidData);
      const result = template.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template ID must follow naming convention: @xagi/ai-template-{type}');
    });

    test('should validate template types', () => {
      const invalidData = { ...validTemplateData, type: 'invalid-type' };
      const template = new TemplatePackage(invalidData);
      const result = template.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid template type \'invalid-type\'. Must be one of: react-next, node-api, vue-app');
    });

    test('should validate semantic version', () => {
      const invalidData = { ...validTemplateData, version: 'invalid-version' };
      const template = new TemplatePackage(invalidData);
      const result = template.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid semantic version: invalid-version');
    });

    test('should auto-detect type from package name', () => {
      const dataWithoutType = { ...validTemplateData, type: '' };
      const template = new TemplatePackage(dataWithoutType);
      const result = template.validate();
      expect(result.isValid).toBe(true);
      expect(template.type).toBe('react-next');
    });

    test('should detect type mismatch between package name and type property', () => {
      const mismatchData = {
        ...validTemplateData,
        id: '@xagi/ai-template-node-api',
        type: 'react-next'
      };
      const template = new TemplatePackage(mismatchData);
      const result = template.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template type mismatch: package name suggests \'node-api\' but type property is \'react-next\'');
    });
  });

  describe('Version Compatibility', () => {
    test('should check version compatibility correctly', () => {
      const template = new TemplatePackage(validTemplateData);

      expect(template.isCompatible('1.0.0')).toBe(true);
      expect(template.isCompatible('1.2.3')).toBe(true);
      expect(template.isCompatible('2.0.0')).toBe(false);
      expect(template.isCompatible('0.9.0')).toBe(false);
    });

    test('should handle multiple supported version ranges', () => {
      const data = {
        ...validTemplateData,
        supportedVersions: ['^1.0.0', '^2.0.0']
      };
      const template = new TemplatePackage(data);

      expect(template.isCompatible('1.5.0')).toBe(true);
      expect(template.isCompatible('2.1.0')).toBe(true);
      expect(template.isCompatible('3.0.0')).toBe(false);
    });

    test('should return true when no supported versions specified', () => {
      const data = { ...validTemplateData, supportedVersions: [] };
      const template = new TemplatePackage(data);
      expect(template.isCompatible('any-version')).toBe(true);
    });
  });

  describe('Configuration Schema', () => {
    test('should get configuration schema with metadata', () => {
      const template = new TemplatePackage(validTemplateData);
      const config = template.getConfig();

      expect(config._metadata).toBeDefined();
      expect(config._metadata.templateId).toBe('@xagi/ai-template-react-next');
      expect(config._metadata.templateName).toBe('React Next.js Template');
      expect(config._metadata.templateType).toBe('react-next');
    });

    test('should validate configuration against schema', () => {
      const template = new TemplatePackage(validTemplateData);
      const validConfig = {
        useTypescript: true,
        useTailwind: false
      };

      const result = template.validateConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.validatedConfig).toEqual(validConfig);
    });

    test('should handle invalid configuration', () => {
      const template = new TemplatePackage(validTemplateData);
      const invalidConfig = {
        useTypescript: 'not-a-boolean'
      };

      const result = template.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle empty schema', () => {
      const data = { ...validTemplateData, configSchema: {} };
      const template = new TemplatePackage(data);
      const config = { anyData: 'should-be-accepted' };

      const result = template.validateConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.validatedConfig).toEqual(config);
    });
  });

  describe('JSON Serialization', () => {
    test('should serialize to JSON correctly', () => {
      const template = new TemplatePackage(validTemplateData);
      const json = template.toJSON();

      expect(json.id).toBe('@xagi/ai-template-react-next');
      expect(json.name).toBe('React Next.js Template');
      expect(json.type).toBe('react-next');
      expect(json.version).toBe('1.0.0');
      expect(json.keywords).toEqual(['react', 'nextjs', 'typescript', 'tailwind']);
      expect(json.metadata).toBeDefined();
      expect(typeof json.metadata.isCompatible).toBe('function');
    });

    test('should include all required fields in JSON', () => {
      const template = new TemplatePackage(validTemplateData);
      const json = template.toJSON();

      const requiredFields = [
        'id', 'name', 'version', 'description', 'type', 'author',
        'keywords', 'dependencies', 'devDependencies', 'configSchema',
        'supportedVersions', 'createdAt', 'updatedAt', 'downloadCount'
      ];

      requiredFields.forEach(field => {
        expect(json).toHaveProperty(field);
      });
    });
  });

  describe('Static Methods', () => {
    test('should create from package.json data', () => {
      const packageData = {
        name: '@xagi/ai-template-vue-app',
        displayName: 'Vue.js Template',
        version: '2.0.0',
        description: 'Vue.js application template',
        type: 'vue-app',
        author: 'Vue Team',
        keywords: ['vue', 'javascript'],
        dependencies: { vue: '^3.0.0' }
      };

      const template = TemplatePackage.fromPackageJson(packageData);
      expect(template.id).toBe('@xagi/ai-template-vue-app');
      expect(template.name).toBe('Vue.js Template');
      expect(template.type).toBe('vue-app');
      expect(template.version).toBe('2.0.0');
    });

    test('should extract template type from package name', () => {
      expect(TemplatePackage.getTemplateType('@xagi/ai-template-react-next')).toBe('react-next');
      expect(TemplatePackage.getTemplateType('@xagi/ai-template-node-api')).toBe('node-api');
      expect(TemplatePackage.getTemplateType('@xagi/ai-template-vue-app')).toBe('vue-app');
      expect(TemplatePackage.getTemplateType('invalid-package-name')).toBeNull();
    });
  });

  describe('Update Methods', () => {
    test('should update template data', () => {
      const template = new TemplatePackage(validTemplateData);
      const originalUpdatedAt = template.updatedAt;

      // Wait a moment to ensure timestamp difference
      setTimeout(() => {
        const updates = {
          name: 'Updated Template Name',
          version: '1.1.0',
          keywords: ['updated', 'keywords']
        };

        const result = template.update(updates);
        expect(template.name).toBe('Updated Template Name');
        expect(template.version).toBe('1.1.0');
        expect(template.keywords).toEqual(['updated', 'keywords']);
        expect(template.updatedAt).not.toBe(originalUpdatedAt);
        expect(result.isValid).toBe(true);
      }, 10);
    });

    test('should increment download count', () => {
      const template = new TemplatePackage(validTemplateData);
      const originalCount = template.downloadCount;
      const originalUpdatedAt = template.updatedAt;

      setTimeout(() => {
        template.incrementDownloadCount();
        expect(template.downloadCount).toBe(originalCount + 1);
        expect(template.updatedAt).not.toBe(originalUpdatedAt);
      }, 10);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid dependency versions gracefully', () => {
      const invalidData = {
        ...validTemplateData,
        dependencies: {
          'valid-dep': '^1.0.0',
          'invalid-dep': 12345
        }
      };

      const template = new TemplatePackage(invalidData);
      const result = template.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('must be a string'))).toBe(true);
    });

    test('should handle invalid JSON Schema', () => {
      const invalidData = {
        ...validTemplateData,
        configSchema: {
          type: 'invalid-schema-type',
          properties: 'should-be-object'
        }
      };

      const template = new TemplatePackage(invalidData);
      const result = template.validate();
      expect(result.errors.some(err => err.includes('Invalid JSON Schema'))).toBe(true);
    });

    test('should handle invalid timestamps', () => {
      const invalidData = {
        ...validTemplateData,
        createdAt: 'invalid-timestamp'
      };

      const template = new TemplatePackage(invalidData);
      const result = template.validate();
      expect(result.errors).toContain('Invalid created timestamp');
    });
  });
});