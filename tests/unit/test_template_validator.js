/**
 * TemplateValidator Unit Tests
 * Tests comprehensive template validation functionality
 */

const TemplateValidator = require('../../src/core/template-validator');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('semver');
jest.mock('glob');
jest.mock('../../src/core/logger');
jest.mock('../../src/core/cache-manager');

describe('TemplateValidator', () => {
  let templateValidator;
  let mockLogger;
  let mockCacheManager;
  let mockSemver;
  let mockGlob;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockCacheManager = {
      getCacheEntry: jest.fn(),
      setCacheEntry: jest.fn(),
      invalidateCache: jest.fn(),
      getCacheStats: jest.fn()
    };

    mockSemver = require('semver');
    mockGlob = require('glob');

    // Mock glob sync
    mockGlob.sync.mockReturnValue([]);

    // Mock fs operations
    fs.existsSync.mockReturnValue(true);
    fs.readJSONSync.mockReturnValue({});
    fs.statSync.mockReturnValue({ isFile: () => true, size: 1024 });

    // Create TemplateValidator instance
    templateValidator = new TemplateValidator({
      logger: mockLogger,
      cacheManager: mockCacheManager
    });
  });

  describe('Constructor', () => {
    test('should create TemplateValidator with default options', () => {
      const validator = new TemplateValidator();
      expect(validator).toBeInstanceOf(TemplateValidator);
      expect(validator.logger).toBeDefined();
      expect(validator.cacheManager).toBeDefined();
      expect(validator.schemaCache).toBeInstanceOf(Map);
      expect(validator.securityCache).toBeInstanceOf(Map);
    });

    test('should create TemplateValidator with custom options', () => {
      const options = {
        logger: mockLogger,
        cacheManager: mockCacheManager,
        enableCache: false,
        validationTimeout: 30000
      };

      const validator = new TemplateValidator(options);
      expect(validator.logger).toBe(mockLogger);
      expect(validator.cacheManager).toBe(mockCacheManager);
      expect(validator.enableCache).toBe(false);
      expect(validator.validationTimeout).toBe(30000);
    });
  });

  describe('validateTemplatePackage', () => {
    const mockTemplateData = {
      id: '@xagi/test-template',
      name: 'Test Template',
      version: '1.0.0',
      type: 'react-next',
      description: 'Test template for validation',
      author: 'Test Author',
      repository: 'https://github.com/test/repo',
      files: [],
      config: {
        variables: {},
        dependencies: {}
      }
    };

    beforeEach(() => {
      // Mock cache miss
      mockCacheManager.getCacheEntry.mockReturnValue(null);

      // Mock successful validation methods
      templateValidator._validateSchema = jest.fn().mockReturnValue([]);
      templateValidator._validateSecurity = jest.fn().mockReturnValue([]);
      templateValidator._validateStructure = jest.fn().mockReturnValue([]);
      templateValidator._validateDependencies = jest.fn().mockReturnValue([]);
      templateValidator._validateVersion = jest.fn().mockReturnValue([]);
    });

    test('should validate template package successfully', async () => {
      const result = await templateValidator.validateTemplatePackage(mockTemplateData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.metadata.templateId).toBe('@xagi/test-template');
      expect(result.metadata.templateType).toBe('react-next');
      expect(result.metadata.validationDuration).toBeGreaterThan(0);
      expect(result.metadata.checksPerformed).toHaveLength(5);

      expect(mockLogger.info).toHaveBeenCalledWith('Starting template package validation', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('Template package validation completed', expect.any(Object));
    });

    test('should use cached validation when available', async () => {
      const cachedResult = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: { validationId: 'cached-id' }
      };

      mockCacheManager.getCacheEntry.mockReturnValue(cachedResult);

      const result = await templateValidator.validateTemplatePackage(mockTemplateData);

      expect(result).toEqual(cachedResult);
      expect(templateValidator._validateSchema).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Using cached validation result', expect.any(Object));
    });

    test('should handle validation errors', async () => {
      const schemaErrors = [{ code: 'SCHEMA_ERROR', message: 'Invalid schema' }];
      const securityErrors = [{ code: 'SECURITY_ERROR', message: 'Security issue' }];

      templateValidator._validateSchema.mockReturnValue(schemaErrors);
      templateValidator._validateSecurity.mockReturnValue(securityErrors);

      const result = await templateValidator.validateTemplatePackage(mockTemplateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([...schemaErrors, ...securityErrors]);
      expect(result.warnings).toEqual([]);
    });

    test('should handle validation timeouts', async () => {
      // Mock slow validation that exceeds timeout
      templateValidator._validateSchema.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve([]), 200);
        });
      });

      const validator = new TemplateValidator({
        logger: mockLogger,
        cacheManager: mockCacheManager,
        validationTimeout: 100
      });

      const result = await validator.validateTemplatePackage(mockTemplateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('VALIDATION_TIMEOUT');
    });

    test('should handle unexpected errors', async () => {
      templateValidator._validateSchema.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await templateValidator.validateTemplatePackage(mockTemplateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('VALIDATION_ERROR');
      expect(result.errors[0].message).toBe('Unexpected error');

      expect(mockLogger.error).toHaveBeenCalledWith('Template validation error', expect.any(Object));
    });
  });

  describe('Schema Validation', () => {
    test('should validate required template fields', () => {
      const invalidTemplate = {
        name: 'Test Template'
        // Missing required fields
      };

      const errors = templateValidator._validateSchema(invalidTemplate);

      expect(errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
      expect(errors.some(e => e.field === 'id')).toBe(true);
      expect(errors.some(e => e.field === 'version')).toBe(true);
    });

    test('should validate version format', () => {
      const templateWithInvalidVersion = {
        id: 'test-template',
        name: 'Test Template',
        version: 'invalid-version',
        type: 'react-next'
      };

      mockSemver.valid.mockReturnValue(null);

      const errors = templateValidator._validateSchema(templateWithInvalidVersion);

      expect(errors.some(e => e.code === 'INVALID_VERSION_FORMAT')).toBe(true);
    });

    test('should validate URL format', () => {
      const templateWithInvalidUrl = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        repository: 'invalid-url'
      };

      const errors = templateValidator._validateSchema(templateWithInvalidUrl);

      expect(errors.some(e => e.code === 'INVALID_URL_FORMAT')).toBe(true);
    });

    test('should validate template type', () => {
      const templateWithInvalidType = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'invalid-type'
      };

      const errors = templateValidator._validateSchema(templateWithInvalidType);

      expect(errors.some(e => e.code === 'INVALID_TEMPLATE_TYPE')).toBe(true);
    });

    test('should validate file paths', () => {
      const templateWithInvalidPaths = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        type: 'react-next',
        files: ['invalid/path/with/../backrefs']
      };

      const errors = templateValidator._validateSchema(templateWithInvalidPaths);

      expect(errors.some(e => e.code === 'INVALID_FILE_PATH')).toBe(true);
    });
  });

  describe('Security Validation', () => {
    test('should scan files for security issues', () => {
      const templateData = {
        id: 'test-template',
        files: ['package.json', 'index.js'],
        config: {}
      };

      // Mock file contents with security issue
      fs.readFileSync.mockReturnValue('const secret = "hardcoded-secret";');

      const errors = templateValidator._validateSecurity(templateData);

      expect(errors.some(e => e.code === 'HARDCODED_SECRET')).toBe(true);
    });

    test('should detect suspicious file patterns', () => {
      const templateData = {
        id: 'test-template',
        files: ['evil.exe', 'script.bat'],
        config: {}
      };

      const errors = templateValidator._validateSecurity(templateData);

      expect(errors.some(e => e.code === 'SUSPICIOUS_FILE')).toBe(true);
    });

    test('should validate dependencies for security issues', () => {
      const templateData = {
        id: 'test-template',
        files: [],
        config: {
          dependencies: {
            'deprecated-package': '1.0.0'
          }
        }
      };

      const errors = templateValidator._validateSecurity(templateData);

      expect(errors.some(e => e.code === 'DEPRECATED_DEPENDENCY')).toBe(true);
    });

    test('should validate scripts for security', () => {
      const templateData = {
        id: 'test-template',
        files: [],
        config: {
          scripts: {
            'postinstall': 'rm -rf /'
          }
        }
      };

      const errors = templateValidator._validateSecurity(templateData);

      expect(errors.some(e => e.code === 'DANGEROUS_SCRIPT')).toBe(true);
    });
  });

  describe('Structure Validation', () => {
    test('should validate react-next template structure', () => {
      const templateData = {
        id: 'test-template',
        type: 'react-next',
        files: ['package.json', 'src/index.js']
      };

      const errors = templateValidator._validateStructure(templateData);

      // Should pass with basic structure
      expect(errors).toHaveLength(0);
    });

    test('should validate vue template structure', () => {
      const templateData = {
        id: 'test-template',
        type: 'vue',
        files: ['package.json', 'src/main.js']
      };

      const errors = templateValidator._validateStructure(templateData);

      // Should pass with basic structure
      expect(errors).toHaveLength(0);
    });

    test('should validate nodejs template structure', () => {
      const templateData = {
        id: 'test-template',
        type: 'nodejs',
        files: ['package.json', 'index.js']
      };

      const errors = templateValidator._validateStructure(templateData);

      // Should pass with basic structure
      expect(errors).toHaveLength(0);
    });

    test('should detect missing required files', () => {
      const templateData = {
        id: 'test-template',
        type: 'react-next',
        files: ['src/index.js'] // Missing package.json
      };

      const errors = templateValidator._validateStructure(templateData);

      expect(errors.some(e => e.code === 'MISSING_REQUIRED_FILE')).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    test('should validate version ranges', () => {
      const templateData = {
        id: 'test-template',
        config: {
          dependencies: {
            'react': '^18.0.0',
            'invalid-package': 'invalid-version'
          }
        }
      };

      mockSemver.validRange.mockReturnValueOnce('^18.0.0').mockReturnValueOnce(null);

      const errors = templateValidator._validateDependencies(templateData);

      expect(errors.some(e => e.code === 'INVALID_VERSION_RANGE')).toBe(true);
    });

    test('should detect conflicting dependencies', () => {
      const templateData = {
        id: 'test-template',
        config: {
          dependencies: {
            'react': '^18.0.0',
            'react-dom': '^17.0.0' // Conflict with react 18
          }
        }
      };

      mockSemver.validRange.mockReturnValue('^18.0.0');
      mockSemver.intersects.mockReturnValue(true);

      const errors = templateValidator._validateDependencies(templateData);

      expect(errors.some(e => e.code === 'CONFLICTING_DEPENDENCIES')).toBe(true);
    });

    test('should check for known vulnerabilities', () => {
      const templateData = {
        id: 'test-template',
        config: {
          dependencies: {
            'vulnerable-package': '1.0.0'
          }
        }
      };

      const errors = templateValidator._validateDependencies(templateData);

      expect(errors.some(e => e.code === 'KNOWN_VULNERABILITY')).toBe(true);
    });
  });

  describe('Version Validation', () => {
    test('should validate semantic versioning', () => {
      const templateData = {
        id: 'test-template',
        version: '1.0.0',
        config: {
          engines: {
            node: '>=18.0.0'
          }
        }
      };

      mockSemver.valid.mockReturnValue('1.0.0');
      mockSemver.satisfies.mockReturnValue(true);

      const errors = templateValidator._validateVersion(templateData);

      expect(errors).toHaveLength(0);
    });

    test('should detect breaking changes', () => {
      const templateData = {
        id: 'test-template',
        version: '2.0.0',
        previousVersion: '1.0.0',
        config: {}
      };

      mockSemver.valid.mockReturnValue('2.0.0');
      mockSemver.diff.mockReturnValue('major');

      const errors = templateValidator._validateVersion(templateData);

      expect(errors.some(e => e.code === 'BREAKING_CHANGE')).toBe(true);
    });
  });

  describe('getValidationStats', () => {
    test('should return validation statistics', () => {
      templateValidator.stats = {
        templatesValidated: 10,
        validationErrors: 5,
        validationWarnings: 3,
        avgValidationTime: 150
      };

      const stats = templateValidator.getValidationStats();

      expect(stats).toEqual({
        templatesValidated: 10,
        validationErrors: 5,
        validationWarnings: 3,
        avgValidationTime: 150,
        successRate: 0.5
      });
    });

    test('should handle empty statistics', () => {
      templateValidator.stats = {};

      const stats = templateValidator.getValidationStats();

      expect(stats).toEqual({
        templatesValidated: 0,
        validationErrors: 0,
        validationWarnings: 0,
        avgValidationTime: 0,
        successRate: 1
      });
    });
  });

  describe('clearValidationCache', () => {
    test('should clear all validation caches', () => {
      templateValidator.schemaCache.set('test', 'value');
      templateValidator.securityCache.set('test', 'value');

      templateValidator.clearValidationCache();

      expect(templateValidator.schemaCache.size).toBe(0);
      expect(templateValidator.securityCache.size).toBe(0);
      expect(mockCacheManager.invalidateCache).toHaveBeenCalledWith('validation');
    });
  });
});