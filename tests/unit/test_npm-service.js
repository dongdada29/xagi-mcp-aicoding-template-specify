/**
 * NpmService Unit Tests
 */

const NpmService = require('../../src/services/npm-service');
const fs = require('fs-extra');
const path = require('path');

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('NpmService', () => {
  let npmService;
  let mockTempDir;
  let mockAxiosInstance;

  beforeEach(() => {
    // Set up mock before creating service
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn()
    };
    axios.create.mockReturnValue(mockAxiosInstance);

    mockTempDir = path.join(__dirname, '.temp-test-cache');
    npmService = new NpmService({
      registryUrl: 'https://registry.npmjs.org',
      timeout: 5000,
      enableCache: true,
      cacheDir: mockTempDir,
      cacheTtl: 60000,
      maxCacheSize: 1024 * 1024 // 1MB
    });

    // Clear mocks
    axios.create.mockClear();
    jest.clearAllMocks();

    // Reset mock after service creation
    axios.create.mockReturnValue(mockAxiosInstance);
  });

  afterEach(async() => {
    // Clean up temp directory
    if (fs.existsSync(mockTempDir)) {
      await fs.remove(mockTempDir);
    }
  });

  describe('Constructor', () => {
    test('should create service with default configuration', () => {
      const service = new NpmService();
      expect(service._registryUrl).toBe('https://registry.npmjs.org');
      expect(service._timeout).toBe(30000);
      expect(service._enableCache).toBe(true);
    });

    test('should create service with custom configuration', () => {
      const config = {
        registryUrl: 'https://custom.registry.com',
        timeout: 10000,
        enableCache: false,
        authToken: 'test-token'
      };

      const service = new NpmService(config);
      expect(service._registryUrl).toBe('https://custom.registry.com');
      expect(service._timeout).toBe(10000);
      expect(service._enableCache).toBe(false);
      expect(service._authToken).toBe('test-token');
    });

    test('should validate configuration parameters', () => {
      expect(() => {
        new NpmService({ timeout: -1 });
      }).toThrow('Timeout must be a positive number');

      expect(() => {
        new NpmService({ registryUrl: 'invalid-url' });
      }).toThrow('Invalid registry URL');
    });

    test('should create HTTP client with proper configuration', () => {
      // Create a new mock for this specific test
      const testMockInstance = { get: jest.fn() };
      axios.create.mockReturnValue(testMockInstance);

      const service = new NpmService({
        registryUrl: 'https://test.registry.com',
        authToken: 'test-token',
        headers: { 'Custom-Header': 'test-value' }
      });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://test.registry.com',
        timeout: 30000,
        headers: {
          'User-Agent': 'NpmService/1.0.0',
          'Accept': 'application/json',
          'Authorization': 'Bearer test-token',
          'Custom-Header': 'test-value'
        },
        validateStatus: expect.any(Function)
      });
    });
  });

  describe('getPackageInfo', () => {
    test('should get package information from registry', async() => {
      const mockPackageInfo = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
        versions: {
          '1.0.0': { version: '1.0.0' },
          '1.1.0': { version: '1.1.0' }
        },
        'dist-tags': { latest: '1.1.0' }
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockPackageInfo });

      const result = await npmService.getPackageInfo('test-package');

      expect(result).toEqual(mockPackageInfo);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-package');
    });

    test('should validate package name format', async() => {
      await expect(npmService.getPackageInfo('')).rejects.toThrow('Package name is required');
      await expect(npmService.getPackageInfo('invalid name')).rejects.toThrow('Invalid package name format');
    });

    test('should handle HTTP errors properly', async() => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: { message: 'Not found' } }
      });

      await expect(npmService.getPackageInfo('nonexistent-package'))
        .rejects.toThrow('Resource not found for getPackageInfo(nonexistent-package): Not found');
    });

    test('should handle network errors properly', async() => {
      mockAxiosInstance.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'Timeout'
      });

      await expect(npmService.getPackageInfo('test-package'))
        .rejects.toThrow('Timeout during getPackageInfo(test-package): Request took longer than 5000ms');
    });

    test('should use cache when enabled', async() => {
      const mockPackageInfo = { name: 'test-package', version: '1.0.0' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockPackageInfo });

      // First call should hit the network
      const result1 = await npmService.getPackageInfo('test-package');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await npmService.getPackageInfo('test-package');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1); // Still 1, no additional call
      expect(result2).toEqual(result1);
    });
  });

  describe('getPackageVersions', () => {
    test('should get package versions from registry', async() => {
      const mockPackageInfo = {
        name: 'test-package',
        versions: {
          '1.0.0': { version: '1.0.0' },
          '1.1.0': { version: '1.1.0' },
          '2.0.0': { version: '2.0.0' }
        }
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockPackageInfo });

      const versions = await npmService.getPackageVersions('test-package');

      expect(versions).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    test('should handle package with no versions', async() => {
      const mockPackageInfo = {
        name: 'test-package',
        versions: {}
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockPackageInfo });

      const versions = await npmService.getPackageVersions('test-package');

      expect(versions).toEqual([]);
    });
  });

  describe('searchPackages', () => {
    test('should search packages with query', async() => {
      const mockSearchResult = {
        objects: [
          { package: { name: 'test-package', description: 'A test package' } },
          { package: { name: 'another-package', description: 'Another package' } }
        ],
        total: 2,
        time: Date.now()
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockSearchResult });

      const result = await npmService.searchPackages('test query', { limit: 10 });

      expect(result).toEqual(mockSearchResult);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/-/v1/search?text=test+query&size=10&from=0');
    });

    test('should validate search parameters', async() => {
      await expect(npmService.searchPackages('')).rejects.toThrow('Search query is required');
      await expect(npmService.searchPackages(null)).rejects.toThrow('Search query is required');
    });
  });

  describe('validatePackage', () => {
    test('should validate package name format', async() => {
      const result = await npmService.validatePackage('valid-package-name', { checkRegistry: false });

      expect(result.isValid).toBe(true);
      expect(result.packageName).toBe('valid-package-name');
      expect(result.errors).toEqual([]);
    });

    test('should reject invalid package names', async() => {
      // This should throw an error due to _validatePackageName being called first
      await expect(npmService.validatePackage('invalid name', { checkRegistry: false }))
        .rejects.toThrow('Invalid package name format: invalid name');
    });

    test('should reject reserved names', async() => {
      const result = await npmService.validatePackage('npm', { checkRegistry: false });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Package name is reserved');
    });

    test('should check registry when enabled', async() => {
      const mockPackageInfo = {
        name: 'existing-package',
        versions: { '1.0.0': {} },
        'dist-tags': { latest: '1.0.0' }
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockPackageInfo });

      const result = await npmService.validatePackage('existing-package', { checkRegistry: true });

      expect(result.registryInfo.exists).toBe(true);
      expect(result.registryInfo.versionCount).toBe(1);
      expect(result.registryInfo.latestVersion).toBe('1.0.0');
    });
  });

  describe('getRegistryInfo', () => {
    test('should get registry information', async() => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Registry endpoints not available'));

      const result = await npmService.getRegistryInfo();

      expect(result.status).toBe('limited');
      expect(result.url).toBe('https://registry.npmjs.org');
    });

    test('should handle offline registry', async() => {
      // Mock axios create to throw ENOTFOUND error during client creation
      axios.create.mockImplementation(() => {
        const error = new Error('ENOTFOUND');
        error.code = 'ENOTFOUND';
        throw error;
      });

      const result = await npmService.getRegistryInfo();

      expect(result.status).toBe('offline');
      expect(result.error).toBe('Registry not reachable');

      // Reset the mock for other tests
      axios.create.mockReturnValue(mockAxiosInstance);
    });
  });

  describe('authenticateRegistry', () => {
    test('should authenticate with registry successfully', async() => {
      mockAxiosInstance.get.mockResolvedValue({ data: { username: 'testuser' } });

      const result = await npmService.authenticateRegistry('https://registry.npmjs.org', 'test-token');

      expect(result.success).toBe(true);
      expect(result.user).toEqual({ username: 'testuser' });
    });

    test('should validate authentication parameters', async() => {
      await expect(npmService.authenticateRegistry('', 'token')).rejects.toThrow('Registry URL is required');
      await expect(npmService.authenticateRegistry('https://registry.com', '')).rejects.toThrow('Authentication token is required');
      await expect(npmService.authenticateRegistry('invalid-url', 'token')).rejects.toThrow('Invalid registry URL');
    });

    test('should handle authentication failure', async() => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 401 }
      });

      await expect(npmService.authenticateRegistry('https://registry.com', 'invalid-token'))
        .rejects.toThrow('Authentication error: Authentication failed: Unable to access registry with provided token');
    });
  });

  describe('cache management', () => {
    test('should clear cache successfully', async() => {
      // Add something to cache first
      npmService._memoryCache.set('test-key', { data: 'test-value' });

      const result = await npmService.clearCache();

      expect(result.success).toBe(true);
      expect(npmService._memoryCache.size).toBe(0);
    });

    test('should get cache statistics', async() => {
      // Add some test data
      npmService._memoryCache.set('key1', { data: 'value1' });
      npmService._memoryCache.set('key2', { data: 'value2' });

      const stats = await npmService.getCacheStats();

      expect(stats.enabled).toBe(true);
      expect(stats.entryCount).toBe(2);
      expect(stats.cacheDir).toBe(mockTempDir);
    });

    test('should handle cache when disabled', async() => {
      const service = new NpmService({ enableCache: false });

      const result = await service.clearCache();
      expect(result.success).toBe(false);
      expect(result.message).toBe('Cache is not enabled');

      const stats = await service.getCacheStats();
      expect(stats.enabled).toBe(false);
    });
  });

  describe('configuration management', () => {
    test('should update service configuration', () => {
      npmService.updateConfig({
        registryUrl: 'https://new.registry.com',
        timeout: 15000,
        authToken: 'new-token'
      });

      expect(npmService._registryUrl).toBe('https://new.registry.com');
      expect(npmService._timeout).toBe(15000);
      expect(npmService._authToken).toBe('new-token');
    });

    test('should validate configuration on update', () => {
      expect(() => {
        npmService.updateConfig({ timeout: -1 });
      }).toThrow('Timeout must be a positive number');

      expect(() => {
        npmService.updateConfig({ registryUrl: 'invalid-url' });
      }).toThrow('Invalid registry URL');
    });

    test('should get current configuration', () => {
      const config = npmService.getConfig();

      expect(config).toHaveProperty('registryUrl');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('enableCache');
      expect(config).toHaveProperty('cacheDir');
      expect(config).toHaveProperty('cacheTtl');
      expect(config).toHaveProperty('maxCacheSize');
      expect(config).toHaveProperty('hasAuthToken');
      expect(config).toHaveProperty('headers');
    });
  });
});
