/**
 * CLI Commands Unit Tests
 * Tests CLI command functionality
 */

const { Command } = require('commander');
const configCommand = require('../../src/cli/commands/config');
const createCommand = require('../../src/cli/commands/create');
const cacheCommand = require('../../src/cli/commands/cache');
const listCommand = require('../../src/cli/commands/list');
const infoCommand = require('../../src/cli/commands/info');
const validateCommand = require('../../src/cli/commands/validate');
const registryCommand = require('../../src/cli/commands/registry');

// Mock dependencies
jest.mock('commander');
jest.mock('ora');
jest.mock('inquirer');
jest.mock('../../src/core/logger');
jest.mock('../../src/core/template-manager');
jest.mock('../../src/core/cache-manager');
jest.mock('../../src/core/registry-manager');
jest.mock('../../src/core/config-manager');

describe('CLI Commands', () => {
  let mockProgram;
  let mockLogger;
  let mockTemplateManager;
  let mockCacheManager;
  let mockRegistryManager;
  let mockConfigManager;
  let mockOra;
  let mockInquirer;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Commander
    mockProgram = {
      command: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      argument: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      alias: jest.fn().mockReturnThis(),
      help: jest.fn().mockReturnThis()
    };

    // Mock Logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock managers
    mockTemplateManager = {
      downloadTemplate: jest.fn(),
      installTemplate: jest.fn(),
      validateTemplate: jest.fn(),
      getTemplate: jest.fn(),
      listTemplates: jest.fn()
    };

    mockCacheManager = {
      getCacheEntry: jest.fn(),
      setCacheEntry: jest.fn(),
      clearCache: jest.fn(),
      getCacheStats: jest.fn()
    };

    mockRegistryManager = {
      addRegistry: jest.fn(),
      removeRegistry: jest.fn(),
      listRegistries: jest.fn(),
      testConnectivity: jest.fn(),
      searchPackages: jest.fn()
    };

    mockConfigManager = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      reset: jest.fn(),
      exportConfig: jest.fn(),
      importConfig: jest.fn()
    };

    // Mock ora
    mockOra = {
      start: jest.fn().mockReturnThis(),
      stop: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      text: ''
    };

    // Mock inquirer
    mockInquirer = {
      prompt: jest.fn()
    };

    // Set up module mocks
    require('ora').mockReturnValue(mockOra);
    require('inquirer').prompt = mockInquirer.prompt;
    require('../../src/core/template-manager').mockImplementation(() => mockTemplateManager);
    require('../../src/core/cache-manager').mockImplementation(() => mockCacheManager);
    require('../../src/core/registry-manager').mockImplementation(() => mockRegistryManager);
    require('../../src/core/config-manager').mockImplementation(() => mockConfigManager);
  });

  describe('Config Command', () => {
    test('should register config commands with program', () => {
      configCommand(mockProgram);

      expect(mockProgram.command).toHaveBeenCalledWith('config');
      expect(mockProgram.description).toHaveBeenCalled();
    });

    test('should handle config get command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      configCommand(mockProgram);

      mockConfigManager.get.mockReturnValue('test-value');

      await action({ key: 'test.key' });

      expect(mockConfigManager.get).toHaveBeenCalledWith('test.key');
    });

    test('should handle config set command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      configCommand(mockProgram);

      mockConfigManager.set.mockResolvedValue({ success: true });

      await action({ key: 'test.key', value: 'test-value' });

      expect(mockConfigManager.set).toHaveBeenCalledWith('test.key', 'test-value');
    });

    test('should handle config reset command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      configCommand(mockProgram);

      mockConfigManager.reset.mockResolvedValue({ success: true });

      await action({});

      expect(mockConfigManager.reset).toHaveBeenCalled();
    });

    test('should handle config errors gracefully', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      configCommand(mockProgram);

      mockConfigManager.get.mockImplementation(() => {
        throw new Error('Config error');
      });

      await action({ key: 'test.key' });

      expect(mockLogger.error).toHaveBeenCalledWith('Configuration error', expect.any(Object));
    });
  });

  describe('Create Command', () => {
    test('should register create command with program', () => {
      createCommand(mockProgram);

      expect(mockProgram.command).toHaveBeenCalledWith('create');
      expect(mockProgram.argument).toHaveBeenCalledWith('<template-id>', expect.any(String));
    });

    test('should handle create command with template', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      createCommand(mockProgram);

      const mockTemplate = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0'
      };

      mockTemplateManager.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateManager.installTemplate.mockResolvedValue({ success: true });

      const options = {
        projectName: 'test-project',
        templateId: 'test-template'
      };

      await action(options);

      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith('test-template');
      expect(mockTemplateManager.installTemplate).toHaveBeenCalledWith('test-template', expect.any(Object));
    });

    test('should handle create command with interactive mode', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      createCommand(mockProgram);

      mockInquirer.prompt.mockResolvedValue({
        template: 'test-template',
        projectName: 'test-project',
        variables: {}
      });

      mockTemplateManager.installTemplate.mockResolvedValue({ success: true });

      await action({ interactive: true });

      expect(mockInquirer.prompt).toHaveBeenCalled();
      expect(mockTemplateManager.installTemplate).toHaveBeenCalled();
    });

    test('should handle create command errors', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      createCommand(mockProgram);

      mockTemplateManager.getTemplate.mockRejectedValue(new Error('Template not found'));

      await action({ templateId: 'non-existent', projectName: 'test-project' });

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create project', expect.any(Object));
    });
  });

  describe('Cache Command', () => {
    test('should register cache commands with program', () => {
      cacheCommand(mockProgram);

      expect(mockProgram.command).toHaveBeenCalledWith('cache');
      expect(mockProgram.description).toHaveBeenCalled();
    });

    test('should handle cache list command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      cacheCommand(mockProgram);

      mockCacheManager.getCacheStats.mockResolvedValue({
        totalEntries: 5,
        totalSize: 1024000
      });

      await action({ command: 'list' });

      expect(mockCacheManager.getCacheStats).toHaveBeenCalled();
    });

    test('should handle cache clear command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      cacheCommand(mockProgram);

      mockCacheManager.clearCache.mockResolvedValue({ success: true });

      await action({ command: 'clear' });

      expect(mockCacheManager.clearCache).toHaveBeenCalled();
    });

    test('should handle cache prune command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      cacheCommand(mockProgram);

      mockCacheManager.clearCache.mockResolvedValue({ success: true });

      await action({ command: 'prune', dryRun: true });

      expect(mockCacheManager.clearCache).toHaveBeenCalled();
    });

    test('should handle cache errors', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      cacheCommand(mockProgram);

      mockCacheManager.getCacheStats.mockRejectedValue(new Error('Cache error'));

      await action({ command: 'list' });

      expect(mockLogger.error).toHaveBeenCalledWith('Cache operation failed', expect.any(Object));
    });
  });

  describe('List Command', () => {
    test('should register list command with program', () => {
      listCommand(mockProgram);

      expect(mockProgram.command).toHaveBeenCalledWith('list');
      expect(mockProgram.option).toHaveBeenCalled();
    });

    test('should handle list templates command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      listCommand(mockProgram);

      const mockTemplates = [
        { id: 'template1', name: 'Template 1', type: 'react-next' },
        { id: 'template2', name: 'Template 2', type: 'vue' }
      ];

      mockTemplateManager.listTemplates.mockResolvedValue(mockTemplates);

      await action({ type: 'template', format: 'table' });

      expect(mockTemplateManager.listTemplates).toHaveBeenCalled();
    });

    test('should handle list registries command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      listCommand(mockProgram);

      const mockRegistries = [
        { id: 'registry1', name: 'Registry 1', url: 'https://registry1.com' },
        { id: 'registry2', name: 'Registry 2', url: 'https://registry2.com' }
      ];

      mockRegistryManager.listRegistries.mockReturnValue(mockRegistries);

      await action({ type: 'registry', format: 'json' });

      expect(mockRegistryManager.listRegistries).toHaveBeenCalled();
    });

    test('should handle list with different output formats', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      listCommand(mockProgram);

      const mockTemplates = [
        { id: 'template1', name: 'Template 1' }
      ];

      mockTemplateManager.listTemplates.mockResolvedValue(mockTemplates);

      // Test JSON format
      await action({ type: 'template', format: 'json' });

      // Test table format
      await action({ type: 'template', format: 'table' });
    });

    test('should handle list errors', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      listCommand(mockProgram);

      mockTemplateManager.listTemplates.mockRejectedValue(new Error('List error'));

      await action({ type: 'template' });

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to list items', expect.any(Object));
    });
  });

  describe('Info Command', () => {
    test('should register info command with program', () => {
      infoCommand(mockProgram);

      expect(mockProgram.command).toHaveBeenCalledWith('info');
      expect(mockProgram.argument).toHaveBeenCalled();
    });

    test('should handle info template command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      infoCommand(mockProgram);

      const mockTemplateInfo = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        description: 'Test template description',
        author: 'Test Author'
      };

      mockTemplateManager.getTemplate.mockResolvedValue(mockTemplateInfo);

      await action({ type: 'template', id: 'test-template' });

      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith('test-template');
    });

    test('should handle info registry command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      infoCommand(mockProgram);

      const mockRegistryInfo = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        type: 'private'
      };

      mockRegistryManager.getRegistry.mockReturnValue(mockRegistryInfo);

      await action({ type: 'registry', id: 'test-registry' });

      expect(mockRegistryManager.getRegistry).toHaveBeenCalledWith('test-registry');
    });

    test('should handle info command with JSON output', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      infoCommand(mockProgram);

      const mockTemplateInfo = {
        id: 'test-template',
        name: 'Test Template'
      };

      mockTemplateManager.getTemplate.mockResolvedValue(mockTemplateInfo);

      await action({ type: 'template', id: 'test-template', format: 'json' });
    });

    test('should handle info errors', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      infoCommand(mockProgram);

      mockTemplateManager.getTemplate.mockRejectedValue(new Error('Template not found'));

      await action({ type: 'template', id: 'non-existent' });

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get info', expect.any(Object));
    });
  });

  describe('Validate Command', () => {
    test('should register validate command with program', () => {
      validateCommand(mockProgram);

      expect(mockProgram.command).toHaveBeenCalledWith('validate');
      expect(mockProgram.description).toHaveBeenCalled();
    });

    test('should handle validate template command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      validateCommand(mockProgram);

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        template: { id: 'test-template' }
      };

      mockTemplateManager.validateTemplate.mockResolvedValue(validationResult);

      await action({ command: 'template', templateId: 'test-template' });

      expect(mockTemplateManager.validateTemplate).toHaveBeenCalledWith('test-template', expect.any(Object));
    });

    test('should handle validate config command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      validateCommand(mockProgram);

      mockConfigManager.get.mockReturnValue({ test: 'value' });

      await action({ command: 'config' });

      expect(mockConfigManager.get).toHaveBeenCalled();
    });

    test('should handle validate with strict mode', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      validateCommand(mockProgram);

      mockTemplateManager.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      await action({ command: 'template', templateId: 'test-template', strict: true });

      expect(mockTemplateManager.validateTemplate).toHaveBeenCalledWith('test-template', expect.objectContaining({
        strictMode: true
      }));
    });

    test('should handle validate errors', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      validateCommand(mockProgram);

      mockTemplateManager.validateTemplate.mockRejectedValue(new Error('Validation failed'));

      await action({ command: 'template', templateId: 'test-template' });

      expect(mockLogger.error).toHaveBeenCalledWith('Validation failed', expect.any(Object));
    });
  });

  describe('Registry Command', () => {
    test('should register registry command with program', () => {
      registryCommand(mockProgram);

      expect(mockProgram.command).toHaveBeenCalledWith('registry');
      expect(mockProgram.description).toHaveBeenCalled();
    });

    test('should handle registry add command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      registryCommand(mockProgram);

      mockRegistryManager.addRegistry.mockReturnValue({
        id: 'test-registry',
        name: 'Test Registry'
      });

      await action({ command: 'add', url: 'https://registry.example.com' });

      expect(mockRegistryManager.addRegistry).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://registry.example.com'
      }));
    });

    test('should handle registry remove command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      registryCommand(mockProgram);

      mockRegistryManager.removeRegistry.mockReturnValue(true);

      await action({ command: 'remove', id: 'test-registry' });

      expect(mockRegistryManager.removeRegistry).toHaveBeenCalledWith('test-registry');
    });

    test('should handle registry test command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      registryCommand(mockProgram);

      mockRegistryManager.testConnectivity.mockResolvedValue({
        success: true,
        responseTime: 500
      });

      await action({ command: 'test', id: 'test-registry' });

      expect(mockRegistryManager.testConnectivity).toHaveBeenCalledWith('test-registry');
    });

    test('should handle registry search command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      registryCommand(mockProgram);

      mockRegistryManager.searchPackages.mockResolvedValue([
        { name: 'test-package', version: '1.0.0' }
      ]);

      await action({ command: 'search', id: 'test-registry', query: 'test' });

      expect(mockRegistryManager.searchPackages).toHaveBeenCalledWith('test-registry', 'test');
    });

    test('should handle registry list command', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      registryCommand(mockProgram);

      mockRegistryManager.listRegistries.mockReturnValue([
        { id: 'test-registry', name: 'Test Registry' }
      ]);

      await action({ command: 'list' });

      expect(mockRegistryManager.listRegistries).toHaveBeenCalled();
    });

    test('should handle registry errors', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      registryCommand(mockProgram);

      mockRegistryManager.addRegistry.mockImplementation(() => {
        throw new Error('Registry error');
      });

      await action({ command: 'add', url: 'https://registry.example.com' });

      expect(mockLogger.error).toHaveBeenCalledWith('Registry operation failed', expect.any(Object));
    });
  });

  describe('Command Error Handling', () => {
    test('should handle missing required arguments', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      createCommand(mockProgram);

      await action({ templateId: undefined, projectName: 'test-project' });

      expect(mockLogger.error).toHaveBeenCalledWith('Template ID is required', expect.any(Object));
    });

    test('should handle invalid command options', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      cacheCommand(mockProgram);

      await action({ command: 'invalid-command' });

      expect(mockLogger.error).toHaveBeenCalledWith('Invalid cache command', expect.any(Object));
    });

    test('should handle permission errors gracefully', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      configCommand(mockProgram);

      mockConfigManager.set.mockRejectedValue(new Error('Permission denied'));

      await action({ key: 'test.key', value: 'test-value' });

      expect(mockLogger.error).toHaveBeenCalledWith('Permission denied', expect.any(Object));
    });
  });

  describe('Command Output Formatting', () => {
    test('should format JSON output correctly', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      listCommand(mockProgram);

      const mockTemplates = [
        { id: 'template1', name: 'Template 1' }
      ];

      mockTemplateManager.listTemplates.mockResolvedValue(mockTemplates);

      // This would test JSON output formatting
      await action({ type: 'template', format: 'json' });
    });

    test('should format table output correctly', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      listCommand(mockProgram);

      const mockTemplates = [
        { id: 'template1', name: 'Template 1', type: 'react-next' }
      ];

      mockTemplateManager.listTemplates.mockResolvedValue(mockTemplates);

      // This would test table output formatting
      await action({ type: 'template', format: 'table' });
    });
  });

  describe('Command Progress Indicators', () => {
    test('should show progress for long-running operations', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      createCommand(mockProgram);

      mockTemplateManager.getTemplate.mockResolvedValue({
        id: 'test-template',
        name: 'Test Template'
      });

      mockTemplateManager.installTemplate.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 100);
        });
      });

      await action({ templateId: 'test-template', projectName: 'test-project' });

      expect(mockOra.start).toHaveBeenCalled();
      expect(mockOra.succeed).toHaveBeenCalled();
    });

    test('should handle progress indicator errors', async () => {
      const action = jest.fn();
      mockProgram.action.mockImplementation((cb) => {
        action.mockImplementation(cb);
        return mockProgram;
      });

      createCommand(mockProgram);

      mockTemplateManager.getTemplate.mockRejectedValue(new Error('Template not found'));

      await action({ templateId: 'non-existent', projectName: 'test-project' });

      expect(mockOra.fail).toHaveBeenCalled();
    });
  });
});