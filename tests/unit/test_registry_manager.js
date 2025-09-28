/**
 * RegistryManager Unit Tests
 * Tests private registry management functionality
 */

const RegistryManager = require('../../src/core/registry-manager');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('axios');
jest.mock('../../src/core/logger');

describe('RegistryManager', () => {
  let registryManager;
  let mockLogger;
  let configDir;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    configDir = '/test/config';
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

    // Create RegistryManager instance
    registryManager = new RegistryManager({
      configDir,
      logger: mockLogger,
      enableEncryption: false // Disable encryption for testing
    });

    // Reset registry cache
    registryManager._registryCache.clear();
  });

  describe('Constructor', () => {
    test('should create RegistryManager with default options', () => {
      const manager = new RegistryManager();
      expect(manager).toBeInstanceOf(RegistryManager);
      expect(manager._enableEncryption).toBe(true);
      expect(manager._configDir).toContain('.xagi');
    });

    test('should create RegistryManager with custom options', () => {
      const options = {
        configDir: '/custom/config',
        logger: mockLogger,
        enableEncryption: false
      };

      const manager = new RegistryManager(options);
      expect(manager._configDir).toBe('/custom/config');
      expect(manager._logger).toBe(mockLogger);
      expect(manager._enableEncryption).toBe(false);
    });

    test('should initialize correctly', () => {
      expect(fs.ensureDirSync).toHaveBeenCalledWith(configDir);
      expect(mockLogger.info).toHaveBeenCalledWith('RegistryManager initialized', expect.any(Object));
    });
  });

  describe('addRegistry', () => {
    test('should add registry successfully', () => {
      const registryConfig = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none',
        credentials: {}
      };

      const result = registryManager.addRegistry(registryConfig);

      expect(result.id).toBe('test-registry');
      expect(result.name).toBe('Test Registry');
      expect(result.url).toBe('https://registry.example.com');
      expect(result.authType).toBe('none');
      expect(result.enabled).toBe(true);
      expect(registryManager._registryCache.has('test-registry')).toBe(true);
      expect(fs.writeJSONSync).toHaveBeenCalled();
    });

    test('should throw error for missing required fields', () => {
      const invalidConfig = {
        id: 'test-registry',
        name: 'Test Registry'
        // Missing url
      };

      expect(() => registryManager.addRegistry(invalidConfig)).toThrow('Registry id, name, and url are required');
    });

    test('should throw error for invalid URL', () => {
      const invalidConfig = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'invalid-url',
        authType: 'none',
        credentials: {}
      };

      expect(() => registryManager.addRegistry(invalidConfig)).toThrow('Invalid registry URL');
    });

    test('should throw error for invalid auth type', () => {
      const invalidConfig = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'invalid-auth',
        credentials: {}
      };

      expect(() => registryManager.addRegistry(invalidConfig)).toThrow('Invalid auth type');
    });

    test('should validate token authentication credentials', () => {
      const config = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'token',
        credentials: {
          authToken: 'test-token'
        }
      };

      const result = registryManager.addRegistry(config);
      expect(result.authType).toBe('token');
    });

    test('should throw error for missing token credentials', () => {
      const config = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'token',
        credentials: {}
      };

      expect(() => registryManager.addRegistry(config)).toThrow('authToken is required for token authentication');
    });

    test('should validate basic authentication credentials', () => {
      const config = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'basic',
        credentials: {
          username: 'test-user',
          password: 'test-pass'
        }
      };

      const result = registryManager.addRegistry(config);
      expect(result.authType).toBe('basic');
    });

    test('should handle priority correctly', () => {
      const config = {
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none',
        credentials: {},
        priority: 5
      };

      const result = registryManager.addRegistry(config);
      expect(result.priority).toBe(5);
    });
  });

  describe('removeRegistry', () => {
    beforeEach(() => {
      // Add a test registry
      registryManager.addRegistry({
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none',
        credentials: {}
      });
    });

    test('should remove registry successfully', () => {
      const result = registryManager.removeRegistry('test-registry');

      expect(result).toBe(true);
      expect(registryManager._registryCache.has('test-registry')).toBe(false);
      expect(fs.writeJSONSync).toHaveBeenCalled();
    });

    test('should throw error for non-existent registry', () => {
      expect(() => registryManager.removeRegistry('non-existent')).toThrow('Registry not found');
    });
  });

  describe('getRegistry', () => {
    beforeEach(() => {
      // Add a test registry
      registryManager.addRegistry({
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none',
        credentials: {}
      });
    });

    test('should get registry successfully', () => {
      const result = registryManager.getRegistry('test-registry');

      expect(result.id).toBe('test-registry');
      expect(result.name).toBe('Test Registry');
      expect(result.url).toBe('https://registry.example.com');
    });

    test('should throw error for non-existent registry', () => {
      expect(() => registryManager.getRegistry('non-existent')).toThrow('Registry not found');
    });
  });

  describe('listRegistries', () => {
    beforeEach(() => {
      // Add test registries
      registryManager.addRegistry({
        id: 'registry-1',
        name: 'Registry 1',
        url: 'https://registry1.example.com',
        authType: 'none',
        credentials: {},
        priority: 2
      });

      registryManager.addRegistry({
        id: 'registry-2',
        name: 'Registry 2',
        url: 'https://registry2.example.com',
        authType: 'none',
        credentials: {},
        priority: 1,
        enabled: false
      });

      registryManager.addRegistry({
        id: 'registry-3',
        name: 'Registry 3',
        url: 'https://registry3.example.com',
        authType: 'token',
        credentials: { authToken: 'token' },
        priority: 3
      });
    });

    test('should list all registries', () => {
      const result = registryManager.listRegistries();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('registry-3'); // Highest priority
      expect(result[1].id).toBe('registry-1'); // Medium priority
      expect(result[2].id).toBe('registry-2'); // Low priority
    });

    test('should filter by type', () => {
      const result = registryManager.listRegistries({ type: 'private' });

      expect(result).toHaveLength(3);
      result.forEach(registry => {
        expect(registry.type).toBe('private');
      });
    });

    test('should exclude disabled registries by default', () => {
      const result = registryManager.listRegistries();

      expect(result).toHaveLength(2); // registry-2 is disabled
      expect(result.find(r => r.id === 'registry-2')).toBeUndefined();
    });

    test('should include disabled registries when requested', () => {
      const result = registryManager.listRegistries({ includeDisabled: true });

      expect(result).toHaveLength(3);
      expect(result.find(r => r.id === 'registry-2')).toBeDefined();
    });
  });

  describe('updateRegistry', () => {
    beforeEach(() => {
      // Add a test registry
      registryManager.addRegistry({
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none',
        credentials: {}
      });
    });

    test('should update registry successfully', () => {
      const updates = {
        name: 'Updated Registry',
        enabled: false
      };

      const result = registryManager.updateRegistry('test-registry', updates);

      expect(result.name).toBe('Updated Registry');
      expect(result.enabled).toBe(false);
      expect(result.id).toBe('test-registry'); // ID should not change
      expect(fs.writeJSONSync).toHaveBeenCalled();
    });

    test('should throw error for non-existent registry', () => {
      expect(() => registryManager.updateRegistry('non-existent', { name: 'Updated' })).toThrow('Registry not found');
    });

    test('should validate URL when updating', () => {
      expect(() => registryManager.updateRegistry('test-registry', { url: 'invalid-url' })).toThrow('Invalid registry URL');
    });

    test('should validate credentials when updating', () => {
      expect(() => registryManager.updateRegistry('test-registry', {
        authType: 'token',
        credentials: {}
      })).toThrow('authToken is required for token authentication');
    });
  });

  describe('testConnectivity', () => {
    const axios = require('axios');

    beforeEach(() => {
      // Add a test registry
      registryManager.addRegistry({
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none',
        credentials: {}
      });

      // Mock axios.create
      const mockAxiosInstance = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockAxiosInstance);
    });

    test('should test connectivity successfully', async () => {
      const mockAxiosInstance = axios.create();
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      const result = await registryManager.testConnectivity('test-registry');

      expect(result.success).toBe(true);
      expect(result.registryId).toBe('test-registry');
      expect(result.endpoint).toBe('/-/ping');
      expect(typeof result.responseTime).toBe('number');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/-/ping');
    });

    test('should handle connectivity failure', async () => {
      const mockAxiosInstance = axios.create();
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await registryManager.testConnectivity('test-registry');

      expect(result.success).toBe(false);
      expect(result.registryId).toBe('test-registry');
      expect(result.error).toBe('Connection failed');
    });

    test('should throw error for non-existent registry', async () => {
      await expect(registryManager.testConnectivity('non-existent')).rejects.toThrow('Registry not found');
    });

    test('should try multiple endpoints', async () => {
      const mockAxiosInstance = axios.create();
      mockAxiosInstance.get.mockImplementation((endpoint) => {
        if (endpoint === '/-/whoami') {
          return Promise.resolve({ status: 200 });
        }
        return Promise.reject(new Error('Not found'));
      });

      const result = await registryManager.testConnectivity('test-registry');

      expect(result.success).toBe(true);
      expect(result.endpoint).toBe('/-/whoami');
    });

    test('should update lastUsed timestamp on success', async () => {
      const mockAxiosInstance = axios.create();
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      await registryManager.testConnectivity('test-registry');

      const registry = registryManager.getRegistry('test-registry');
      expect(registry.lastUsed).toBeDefined();
      expect(fs.writeJSONSync).toHaveBeenCalled();
    });
  });

  describe('searchPackages', () => {
    const axios = require('axios');

    beforeEach(() => {
      // Add a test registry
      registryManager.addRegistry({
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none',
        credentials: {}
      });

      // Mock axios.create
      const mockAxiosInstance = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockAxiosInstance);
    });

    test('should search packages successfully', async () => {
      const mockAxiosInstance = axios.create();
      const mockResponse = {
        data: {
          objects: [
            { package: { name: 'test-package', version: '1.0.0', description: 'Test package' } }
          ]
        }
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await registryManager.searchPackages('test-registry', 'test-query');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-package');
      expect(result[0].version).toBe('1.0.0');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/-/v1/search?text=test-query&size=20');
    });

    test('should handle empty search results', async () => {
      const mockAxiosInstance = axios.create();
      mockAxiosInstance.get.mockResolvedValue({ data: { objects: [] } });

      const result = await registryManager.searchPackages('test-registry', 'test-query');

      expect(result).toEqual([]);
    });

    test('should handle search errors', async () => {
      const mockAxiosInstance = axios.create();
      mockAxiosInstance.get.mockRejectedValue(new Error('Search failed'));

      await expect(registryManager.searchPackages('test-registry', 'test-query')).rejects.toThrow('Failed to search packages');
    });

    test('should use custom limit', async () => {
      const mockAxiosInstance = axios.create();
      mockAxiosInstance.get.mockResolvedValue({ data: { objects: [] } });

      await registryManager.searchPackages('test-registry', 'test-query', { limit: 50 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/-/v1/search?text=test-query&size=50');
    });
  });

  describe('getPackageInfo', () => {
    const axios = require('axios');

    beforeEach(() => {
      // Add a test registry
      registryManager.addRegistry({
        id: 'test-registry',
        name: 'Test Registry',
        url: 'https://registry.example.com',
        authType: 'none',
        credentials: {}
      });

      // Mock axios.create
      const mockAxiosInstance = {
        get: jest.fn()
      };
      axios.create.mockReturnValue(mockAxiosInstance);
    });

    test('should get package info successfully', async () => {
      const mockAxiosInstance = axios.create();
      const mockPackageInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
        dependencies: { lodash: '^4.0.0' }
      };
      mockAxiosInstance.get.mockResolvedValue({ data: mockPackageInfo });

      const result = await registryManager.getPackageInfo('test-registry', 'test-package');

      expect(result.name).toBe('test-package');
      expect(result.version).toBe('1.0.0');
      expect(result.dependencies).toEqual({ lodash: '^4.0.0' });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-package');
    });

    test('should handle package info errors', async () => {
      const mockAxiosInstance = axios.create();
      mockAxiosInstance.get.mockRejectedValue(new Error('Package not found'));

      await expect(registryManager.getPackageInfo('test-registry', 'test-package')).rejects.toThrow('Failed to get package info');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      // Add test registries
      registryManager.addRegistry({
        id: 'registry-1',
        name: 'Registry 1',
        url: 'https://registry1.example.com',
        authType: 'none',
        credentials: {}
      });

      registryManager.addRegistry({
        id: 'registry-2',
        name: 'Registry 2',
        url: 'https://registry2.example.com',
        authType: 'token',
        credentials: { authToken: 'token' },
        enabled: false
      });
    });

    test('should return correct statistics', () => {
      const stats = registryManager.getStats();

      expect(stats.totalRegistries).toBe(2);
      expect(stats.enabledRegistries).toBe(1);
      expect(stats.privateRegistries).toBe(2);
      expect(stats.authTypes.token).toBe(1);
      expect(stats.authTypes.none).toBe(1);
      expect(stats.encryptionEnabled).toBe(false);
      expect(stats.configDir).toBe(configDir);
    });
  });

  describe('clearAll', () => {
    beforeEach(() => {
      // Add test registries
      registryManager.addRegistry({
        id: 'registry-1',
        name: 'Registry 1',
        url: 'https://registry1.example.com',
        authType: 'none',
        credentials: {}
      });

      registryManager.addRegistry({
        id: 'registry-2',
        name: 'Registry 2',
        url: 'https://registry2.example.com',
        authType: 'token',
        credentials: { authToken: 'token' }
      });
    });

    test('should clear all registries', () => {
      const result = registryManager.clearAll();

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(registryManager._registryCache.size).toBe(0);
      expect(fs.removeSync).toHaveBeenCalledWith(registryManager._credentialPath);
    });

    test('should handle file removal errors gracefully', () => {
      fs.removeSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = registryManager.clearAll();

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(registryManager._registryCache.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to remove credential file', expect.any(Object));
    });
  });

  describe('Encryption (disabled for tests)', () => {
    test('should use plaintext when encryption is disabled', () => {
      const testData = 'sensitive-data';

      const encrypted = registryManager._encrypt(testData);
      const decrypted = registryManager._decrypt(encrypted);

      expect(encrypted).toBe(testData);
      expect(decrypted).toBe(testData);
    });
  });
});