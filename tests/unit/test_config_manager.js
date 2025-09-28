/**
 * ConfigManager Unit Tests
 * Tests configuration management functionality
 */

const ConfigManager = require('../../src/core/config-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../../src/core/logger');

describe('ConfigManager', () => {
  let configManager;
  let mockLogger;
  let testConfigDir;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    testConfigDir = '/test/config';
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock fs operations
    fs.ensureDirSync.mockReturnValue();
    fs.existsSync.mockReturnValue(false);
    fs.readJSONSync.mockReturnValue({});
    fs.writeJSONSync.mockReturnValue();
    fs.watchFile.mockReturnValue();
    fs.unwatchFile.mockReturnValue();
    fs.readdirSync.mockReturnValue([]);

    // Create ConfigManager instance
    configManager = new ConfigManager({
      configDir: testConfigDir,
      logger: mockLogger,
      enableEncryption: false // Disable encryption for testing
    });
  });

  describe('Constructor', () => {
    test('should create ConfigManager with default options', () => {
      const manager = new ConfigManager();

      expect(manager).toBeInstanceOf(ConfigManager);
      expect(manager.configDir).toContain('.xagi/create-ai-project');
      expect(manager.configFile).toBe('config.json');
      expect(manager.enableEncryption).toBe(true);
    });

    test('should create ConfigManager with custom options', () => {
      const options = {
        configDir: '/custom/config',
        configFile: 'custom-config.json',
        enableEncryption: false,
        logger: mockLogger
      };

      const manager = new ConfigManager(options);

      expect(manager.configDir).toBe('/custom/config');
      expect(manager.configFile).toBe('custom-config.json');
      expect(manager.enableEncryption).toBe(false);
      expect(manager.logger).toBe(mockLogger);
    });

    test('should initialize configuration schema', () => {
      expect(configManager.schema).toBeDefined();
      expect(configManager.schema.type).toBe('object');
      expect(configManager.schema.properties).toBeDefined();
      expect(configManager.schema.properties.general).toBeDefined();
    });

    test('should create config directory', () => {
      expect(fs.ensureDirSync).toHaveBeenCalledWith(testConfigDir);
    });
  });

  describe('initialize', () => {
    test('should initialize successfully with new config', async () => {
      fs.existsSync.mockReturnValue(false);

      const result = await configManager.initialize();

      expect(result.success).toBe(true);
      expect(configManager.config).toBeDefined();
      expect(configManager.config.general).toBeDefined();
      expect(fs.writeJSONSync).toHaveBeenCalledWith(configManager.configPath, expect.any(Object));
    });

    test('should load existing config', async () => {
      const existingConfig = {
        general: {
          defaultTemplateType: 'react-next',
          defaultRegistry: 'npm'
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readJSONSync.mockReturnValue(existingConfig);

      const result = await configManager.initialize();

      expect(result.success).toBe(true);
      expect(configManager.config.general.defaultTemplateType).toBe('react-next');
    });

    test('should handle config file read errors', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJSONSync.mockImplementation(() => {
        throw new Error('Read failed');
      });

      const result = await configManager.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read failed');
    });

    test('should validate loaded config', async () => {
      const invalidConfig = {
        general: {
          defaultTemplateType: 'invalid-type'
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readJSONSync.mockReturnValue(invalidConfig);

      const result = await configManager.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should return configuration value', () => {
      configManager.config.general.defaultTemplateType = 'react-next';

      const result = configManager.get('general.defaultTemplateType');

      expect(result).toBe('react-next');
    });

    test('should return default value for missing key', () => {
      const result = configManager.get('nonexistent.key', 'default');

      expect(result).toBe('default');
    });

    test('should return undefined for missing key without default', () => {
      const result = configManager.get('nonexistent.key');

      expect(result).toBeUndefined();
    });

    test('should return entire config when no key provided', () => {
      const result = configManager.get();

      expect(result).toBe(configManager.config);
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should set configuration value', async () => {
      const result = await configManager.set('general.defaultTemplateType', 'vue');

      expect(result.success).toBe(true);
      expect(configManager.config.general.defaultTemplateType).toBe('vue');
      expect(fs.writeJSONSync).toHaveBeenCalled();
    });

    test('should create nested objects if they don\'t exist', async () => {
      const result = await configManager.set('newSection.newKey', 'newValue');

      expect(result.success).toBe(true);
      expect(configManager.config.newSection.newKey).toBe('newValue');
    });

    test('should validate configuration after update', async () => {
      const result = await configManager.set('general.defaultTemplateType', 'invalid-type');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration value');
    });

    test('should handle write errors', async () => {
      fs.writeJSONSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const result = await configManager.set('general.defaultTemplateType', 'vue');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Write failed');
    });
  });

  describe('has', () => {
    beforeEach(async () => {
      await configManager.initialize();
      configManager.config.general.defaultTemplateType = 'react-next';
    });

    test('should return true for existing key', () => {
      expect(configManager.has('general.defaultTemplateType')).toBe(true);
    });

    test('should return false for non-existent key', () => {
      expect(configManager.has('nonexistent.key')).toBe(false);
    });

    test('should return true for existing nested object', () => {
      expect(configManager.has('general')).toBe(true);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await configManager.initialize();
      configManager.config.general.defaultTemplateType = 'react-next';
    });

    test('should delete configuration key', async () => {
      const result = await configManager.delete('general.defaultTemplateType');

      expect(result.success).toBe(true);
      expect(configManager.config.general.defaultTemplateType).toBeUndefined();
    });

    test('should handle deleting non-existent key', async () => {
      const result = await configManager.delete('nonexistent.key');

      expect(result.success).toBe(true); // Should succeed even if key doesn't exist
    });

    test('should persist changes after deletion', async () => {
      await configManager.delete('general.defaultTemplateType');

      expect(fs.writeJSONSync).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    beforeEach(async () => {
      await configManager.initialize();
      configManager.config.general.defaultTemplateType = 'custom-value';
    });

    test('should reset to default configuration', async () => {
      const result = await configManager.reset();

      expect(result.success).toBe(true);
      expect(configManager.config.general.defaultTemplateType).toBe('react-next'); // Default value
      expect(fs.writeJSONSync).toHaveBeenCalled();
    });

    test('should reset specific section', async () => {
      configManager.config.cache = { custom: 'value' };

      const result = await configManager.reset('cache');

      expect(result.success).toBe(true);
      expect(configManager.config.cache).toEqual(expect.objectContaining({
        enabled: true,
        ttl: expect.any(Number)
      }));
    });

    test('should handle reset errors', async () => {
      fs.writeJSONSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const result = await configManager.reset();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Write failed');
    });
  });

  describe('reload', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should reload configuration from file', async () => {
      const newConfig = {
        general: {
          defaultTemplateType: 'vue'
        }
      };

      fs.readJSONSync.mockReturnValue(newConfig);

      const result = await configManager.reload();

      expect(result.success).toBe(true);
      expect(configManager.config.general.defaultTemplateType).toBe('vue');
    });

    test('should handle reload errors', async () => {
      fs.readJSONSync.mockImplementation(() => {
        throw new Error('Read failed');
      });

      const result = await configManager.reload();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read failed');
    });
  });

  describe('watch', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should start watching config file', async () => {
      const callback = jest.fn();

      const result = await configManager.watch(callback);

      expect(result.success).toBe(true);
      expect(fs.watchFile).toHaveBeenCalledWith(configManager.configPath, expect.any(Object));
      expect(configManager.isWatching).toBe(true);
    });

    test('should handle multiple watchers', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await configManager.watch(callback1);
      await configManager.watch(callback2);

      expect(configManager.watchers.size).toBe(2);
    });

    test('should not duplicate watchers for same callback', async () => {
      const callback = jest.fn();

      await configManager.watch(callback);
      await configManager.watch(callback);

      expect(configManager.watchers.size).toBe(1);
    });
  });

  describe('unwatch', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should stop watching specific callback', async () => {
      const callback = jest.fn();

      await configManager.watch(callback);
      await configManager.unwatch(callback);

      expect(configManager.watchers.size).toBe(0);
    });

    test('should stop watching all callbacks when no callback provided', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await configManager.watch(callback1);
      await configManager.watch(callback2);

      await configManager.unwatch();

      expect(configManager.watchers.size).toBe(0);
      expect(fs.unwatchFile).toHaveBeenCalledWith(configManager.configPath);
      expect(configManager.isWatching).toBe(false);
    });
  });

  describe('exportConfig', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should export configuration to file', async () => {
      const exportPath = '/export/config.json';

      const result = await configManager.exportConfig(exportPath);

      expect(result.success).toBe(true);
      expect(fs.writeJSONSync).toHaveBeenCalledWith(exportPath, configManager.config, expect.any(Object));
    });

    test('should handle export errors', async () => {
      fs.writeJSONSync.mockImplementation(() => {
        throw new Error('Export failed');
      });

      const result = await configManager.exportConfig('/export/config.json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Export failed');
    });
  });

  describe('importConfig', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should import configuration from file', async () => {
      const importConfig = {
        general: {
          defaultTemplateType: 'vue'
        }
      };

      fs.readJSONSync.mockReturnValue(importConfig);

      const result = await configManager.importConfig('/import/config.json');

      expect(result.success).toBe(true);
      expect(configManager.config.general.defaultTemplateType).toBe('vue');
    });

    test('should validate imported configuration', async () => {
      const invalidConfig = {
        general: {
          defaultTemplateType: 'invalid-type'
        }
      };

      fs.readJSONSync.mockReturnValue(invalidConfig);

      const result = await configManager.importConfig('/import/config.json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    test('should return configuration statistics', () => {
      const stats = configManager.getStats();

      expect(stats).toEqual(expect.objectContaining({
        configPath: expect.any(String),
        configExists: expect.any(Boolean),
        isWatching: expect.any(Boolean),
        watcherCount: expect.any(Number),
        configSize: expect.any(Object)
      }));
    });
  });

  describe('Utility Methods', () => {
    test('should validate configuration value', () => {
      const validValue = 'react-next';
      const invalidValue = 'invalid-type';

      expect(configManager._validateConfigValue('general.defaultTemplateType', validValue)).toBe(true);
      expect(configManager._validateConfigValue('general.defaultTemplateType', invalidValue)).toBe(false);
    });

    test('should get default configuration', () => {
      const defaultConfig = configManager._getDefaultConfig();

      expect(defaultConfig).toEqual(expect.objectContaining({
        general: expect.any(Object),
        cache: expect.any(Object),
        security: expect.any(Object),
        performance: expect.any(Object)
      }));
    });

    test('should merge configurations', () => {
      const base = { a: 1, b: { c: 2 } };
      const override = { b: { d: 3 }, e: 4 };

      const merged = configManager._mergeConfig(base, override);

      expect(merged).toEqual({
        a: 1,
        b: { c: 2, d: 3 },
        e: 4
      });
    });
  });
});