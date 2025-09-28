/**
 * TemplateManager Unit Tests
 * Tests core template management functionality
 */

const TemplateManager = require('../../src/core/template-manager');
const TemplatePackage = require('../../src/models/template');
const fs = require('fs-extra');
const path = require('path');

// Mock dependencies
jest.mock('../../src/models/template');
jest.mock('fs-extra');
jest.mock('../../src/core/cache-manager');
jest.mock('../../src/core/template-validator');
jest.mock('../../src/core/registry-manager');

describe('TemplateManager', () => {
  let templateManager;
  let mockCacheManager;
  let mockTemplateValidator;
  let mockRegistryManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockCacheManager = {
      getCacheEntry: jest.fn(),
      setCacheEntry: jest.fn(),
      invalidateCache: jest.fn(),
      getCacheStats: jest.fn()
    };

    mockTemplateValidator = {
      validateTemplatePackage: jest.fn()
    };

    mockRegistryManager = {
      addRegistry: jest.fn(),
      removeRegistry: jest.fn(),
      getRegistry: jest.fn(),
      listRegistries: jest.fn(),
      testConnectivity: jest.fn(),
      searchPackages: jest.fn(),
      getPackageInfo: jest.fn()
    };

    // Create TemplateManager instance with mocked dependencies
    templateManager = new TemplateManager({
      cacheManager: mockCacheManager,
      enableCache: true
    });

    // Replace the validator and registry manager with mocks
    templateManager.templateValidator = mockTemplateValidator;
    templateManager.registryManager = mockRegistryManager;

    // Mock logger
    templateManager.logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Initialize stats
    templateManager.stats = {
      templatesDownloaded: 0,
      templatesInstalled: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  });

  describe('Constructor', () => {
    test('should create TemplateManager with default options', () => {
      const manager = new TemplateManager();
      expect(manager).toBeInstanceOf(TemplateManager);
      expect(manager.enableCache).toBe(true);
      expect(manager.registries).toEqual([]);
    });

    test('should create TemplateManager with custom options', () => {
      const options = {
        cacheDir: '/custom/cache',
        enableCache: false,
        registries: ['test-registry']
      };
      const manager = new TemplateManager(options);
      expect(manager.cacheDir).toBe('/custom/cache');
      expect(manager.enableCache).toBe(false);
      expect(manager.registries).toEqual(['test-registry']);
    });
  });

  describe('initialize', () => {
    test('should initialize successfully', async () => {
      fs.ensureDirSync.mockReturnValue();
      await expect(templateManager.initialize()).resolves.not.toThrow();
      expect(fs.ensureDirSync).toHaveBeenCalledWith(templateManager.cacheDir);
    });

    test('should handle initialization errors', async () => {
      fs.ensureDirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      await expect(templateManager.initialize()).rejects.toThrow('TemplateManager initialization failed');
    });
  });

  describe('downloadTemplate', () => {
    const mockTemplate = {
      id: '@xagi/test-template',
      name: 'Test Template',
      version: '1.0.0',
      type: 'react-next'
    };

    beforeEach(() => {
      // Mock template package
      TemplatePackage.mockImplementation(() => mockTemplate);

      // Mock getTemplate method
      templateManager.getTemplate = jest.fn().mockResolvedValue(mockTemplate);

      // Mock cache methods
      templateManager.getCachedTemplatePath = jest.fn().mockResolvedValue(null);
      templateManager.getTemplateDownloadPath = jest.fn().mockResolvedValue('/tmp/download');

      // Mock download methods
      templateManager.downloadNpmTemplate = jest.fn().mockResolvedValue();
      templateManager.downloadGitTemplate = jest.fn().mockResolvedValue();
      templateManager.validateDownloadedTemplate = jest.fn().mockResolvedValue();
      templateManager.cacheDownloadedTemplate = jest.fn().mockResolvedValue();
    });

    test('should download NPM template successfully', async () => {
      const result = await templateManager.downloadTemplate('@xagi/test-template', '1.0.0');

      expect(result.success).toBe(true);
      expect(result.path).toBe('/tmp/download');
      expect(result.template).toEqual(mockTemplate);
      expect(templateManager.downloadNpmTemplate).toHaveBeenCalledWith('@xagi/test-template', '1.0.0', '/tmp/download');
    });

    test('should download Git template successfully', async () => {
      await templateManager.downloadTemplate('https://github.com/test/repo', 'main');

      expect(templateManager.downloadGitTemplate).toHaveBeenCalledWith('https://github.com/test/repo', 'main', '/tmp/download');
    });

    test('should throw error for unsupported template type', async () => {
      await expect(templateManager.downloadTemplate('unsupported:template')).rejects.toThrow('Unsupported template type');
    });

    test('should use cached template if available', async () => {
      templateManager.getCachedTemplatePath.mockResolvedValue('/cached/template');

      const result = await templateManager.downloadTemplate('@xagi/test-template', '1.0.0');

      expect(result.cached).toBe(true);
      expect(result.path).toBe('/cached/template');
      expect(templateManager.stats.cacheHits).toBe(1);
    });

    test('should handle download errors', async () => {
      templateManager.downloadNpmTemplate.mockRejectedValue(new Error('Download failed'));

      await expect(templateManager.downloadTemplate('@xagi/test-template', '1.0.0')).rejects.toThrow('Failed to download template');
      expect(templateManager.stats.errors).toBe(1);
    });

    test('should force download when specified', async () => {
      templateManager.getCachedTemplatePath.mockResolvedValue('/cached/template');

      await templateManager.downloadTemplate('@xagi/test-template', '1.0.0', { forceDownload: true });

      expect(templateManager.downloadNpmTemplate).toHaveBeenCalled();
      expect(templateManager.stats.cacheMisses).toBe(1);
    });
  });

  describe('installTemplate', () => {
    const mockTemplate = {
      id: '@xagi/test-template',
      name: 'Test Template',
      version: '1.0.0',
      type: 'react-next',
      validateConfig: jest.fn().mockReturnValue({ isValid: true })
    };

    beforeEach(() => {
      // Mock dependencies
      templateManager.getTemplate = jest.fn().mockResolvedValue(mockTemplate);
      templateManager.downloadTemplate = jest.fn().mockResolvedValue({
        success: true,
        path: '/tmp/template'
      });
      templateManager.prepareTargetDirectory = jest.fn().mockResolvedValue();
      templateManager.copyTemplateFiles = jest.fn().mockResolvedValue();
      templateManager.processTemplateVariables = jest.fn().mockResolvedValue();
      templateManager.installDependencies = jest.fn().mockResolvedValue();
      templateManager.initializeGitRepo = jest.fn().mockResolvedValue();
      templateManager.generateProjectInfo = jest.fn().mockResolvedValue({});
    });

    test('should install template successfully', async () => {
      const config = {
        projectName: 'test-project',
        variables: { test: 'value' }
      };

      const result = await templateManager.installTemplate('@xagi/test-template', config);

      expect(result.success).toBe(true);
      expect(result.projectName).toBe('test-project');
      expect(templateManager.stats.templatesInstalled).toBe(1);
    });

    test('should validate configuration', async () => {
      const config = {
        projectName: 'test-project',
        variables: { test: 'value' }
      };

      mockTemplate.validateConfig.mockReturnValue({
        isValid: false,
        errors: ['Invalid configuration']
      });

      await expect(templateManager.installTemplate('@xagi/test-template', config)).rejects.toThrow('Invalid configuration');
    });

    test('should skip dependency installation when specified', async () => {
      const config = {
        projectName: 'test-project',
        skipInstall: true
      };

      await templateManager.installTemplate('@xagi/test-template', config);

      expect(templateManager.installDependencies).not.toHaveBeenCalled();
    });

    test('should skip git initialization when specified', async () => {
      const config = {
        projectName: 'test-project',
        skipGit: true
      };

      await templateManager.installTemplate('@xagi/test-template', config);

      expect(templateManager.initializeGitRepo).not.toHaveBeenCalled();
    });

    test('should handle installation errors', async () => {
      templateManager.downloadTemplate.mockRejectedValue(new Error('Download failed'));

      await expect(templateManager.installTemplate('@xagi/test-template', {
        projectName: 'test-project'
      })).rejects.toThrow('Failed to install template');
      expect(templateManager.stats.errors).toBe(1);
    });
  });

  describe('validateTemplate', () => {
    const mockTemplateData = {
      id: 'test-template',
      name: 'Test Template',
      version: '1.0.0',
      type: 'react-next'
    };

    beforeEach(() => {
      // Mock validation result
      mockTemplateValidator.validateTemplatePackage.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {
          validationDuration: 100,
          checksPerformed: [
            { name: 'schema', passed: true, duration: 20 },
            { name: 'security', passed: true, duration: 30 },
            { name: 'structure', passed: true, duration: 50 }
          ]
        }
      });
    });

    test('should validate template successfully', async () => {
      const result = await templateManager.validateTemplate(mockTemplateData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.template).toEqual(expect.any(Object));
      expect(mockTemplateValidator.validateTemplatePackage).toHaveBeenCalled();
    });

    test('should handle validation failure', async () => {
      mockTemplateValidator.validateTemplatePackage.mockResolvedValue({
        isValid: false,
        errors: [{ message: 'Schema validation failed', code: 'SCHEMA_ERROR' }],
        warnings: [],
        metadata: {
          validationDuration: 100,
          checksPerformed: [
            { name: 'schema', passed: false, duration: 20 }
          ]
        }
      });

      const result = await templateManager.validateTemplate(mockTemplateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Schema validation failed');
    });

    test('should handle validation errors', async () => {
      mockTemplateValidator.validateTemplatePackage.mockRejectedValue(new Error('Validation service unavailable'));

      const result = await templateManager.validateTemplate(mockTemplateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Validation service unavailable');
    });

    test('should pass validation options correctly', async () => {
      const options = {
        strictMode: true,
        enableSecurityValidation: false,
        path: '/test/path'
      };

      await templateManager.validateTemplate(mockTemplateData, options);

      expect(mockTemplateValidator.validateTemplatePackage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          strictMode: true,
          enableSecurityValidation: false,
          path: '/test/path'
        })
      );
    });
  });

  describe('Private Registry Methods', () => {
    test('should add private registry', () => {
      const registryConfig = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none'
      };

      const mockRegistry = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com'
      };

      mockRegistryManager.addRegistry.mockReturnValue(mockRegistry);

      const result = templateManager.addPrivateRegistry(registryConfig);

      expect(result).toEqual(mockRegistry);
      expect(mockRegistryManager.addRegistry).toHaveBeenCalledWith(registryConfig);
    });

    test('should remove private registry', () => {
      mockRegistryManager.removeRegistry.mockReturnValue(true);

      const result = templateManager.removePrivateRegistry('test-registry');

      expect(result).toBe(true);
      expect(mockRegistryManager.removeRegistry).toHaveBeenCalledWith('test-registry');
    });

    test('should list private registries', () => {
      const mockRegistries = [
        { id: 'test-registry', name: 'Test Registry' }
      ];

      mockRegistryManager.listRegistries.mockReturnValue(mockRegistries);

      const result = templateManager.listPrivateRegistries();

      expect(result).toEqual(mockRegistries);
      expect(mockRegistryManager.listRegistries).toHaveBeenCalled();
    });

    test('should test private registry connectivity', async () => {
      const mockResult = {
        success: true,
        registryId: 'test-registry',
        responseTime: 500
      };

      mockRegistryManager.testConnectivity.mockResolvedValue(mockResult);

      const result = await templateManager.testPrivateRegistry('test-registry');

      expect(result).toEqual(mockResult);
      expect(mockRegistryManager.testConnectivity).toHaveBeenCalledWith('test-registry');
    });

    test('should search private packages', async () => {
      const mockPackages = [
        { name: 'test-package', version: '1.0.0' }
      ];

      mockRegistryManager.searchPackages.mockResolvedValue(mockPackages);

      const result = await templateManager.searchPrivatePackages('test-registry', 'test-query');

      expect(result).toEqual(mockPackages);
      expect(mockRegistryManager.searchPackages).toHaveBeenCalledWith('test-registry', 'test-query');
    });

    test('should get private package info', async () => {
      const mockPackageInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package'
      };

      mockRegistryManager.getPackageInfo.mockResolvedValue(mockPackageInfo);

      const result = await templateManager.getPrivatePackageInfo('test-registry', 'test-package');

      expect(result).toEqual(mockPackageInfo);
      expect(mockRegistryManager.getPackageInfo).toHaveBeenCalledWith('test-registry', 'test-package');
    });
  });

  describe('Utility Methods', () => {
    test('should get statistics', () => {
      templateManager.stats = {
        templatesDownloaded: 5,
        templatesInstalled: 3,
        cacheHits: 2,
        cacheMisses: 3,
        errors: 1
      };

      const stats = templateManager.getStats();

      expect(stats).toEqual({
        templatesDownloaded: 5,
        templatesInstalled: 3,
        cacheHits: 2,
        cacheMisses: 3,
        errors: 1,
        cacheHitRate: 0.4
      });
    });

    test('should reset statistics', () => {
      templateManager.stats = {
        templatesDownloaded: 5,
        templatesInstalled: 3,
        cacheHits: 2,
        cacheMisses: 3,
        errors: 1
      };

      templateManager.resetStats();

      expect(templateManager.stats).toEqual({
        templatesDownloaded: 0,
        templatesInstalled: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0
      });
    });
  });
});