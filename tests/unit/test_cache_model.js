const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const CacheStore = require('../../src/models/cache');

// Helper function to create temporary directory
function createTempDir() {
  return path.join(os.tmpdir(), `cache-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
}

describe('CacheStore Model', () => {
  let tempDir;
  let cacheStore;

  beforeEach(() => {
    tempDir = createTempDir();
    cacheStore = new CacheStore({
      id: 'test-cache-id',
      templateId: 'test-template',
      version: '1.0.0',
      path: tempDir
    });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Constructor', () => {
    test('should create CacheStore instance with required parameters', () => {
      const store = new CacheStore({
        id: 'test-id',
        templateId: 'test-template',
        version: '1.0.0',
        path: '/test/path'
      });

      expect(store.id).toBe('test-id');
      expect(store.templateId).toBe('test-template');
      expect(store.version).toBe('1.0.0');
      expect(store.path).toBe('/test/path');
      expect(store.accessCount).toBe(0);
      expect(store.isValid).toBe(true);
      expect(store.createdAt).toBeInstanceOf(Date);
      expect(store.lastAccessed).toBeInstanceOf(Date);
    });

    test('should throw error if required parameters are missing', () => {
      expect(() => {
        new CacheStore({
          id: 'test-id'
          // Missing templateId, version, path
        });
      }).toThrow('Template ID is required and must be a string');
    });

    test('should accept optional parameters', () => {
      const createdAt = new Date('2023-01-01');
      const lastAccessed = new Date('2023-01-02');

      const store = new CacheStore({
        id: 'test-id',
        templateId: 'test-template',
        version: '1.0.0',
        path: '/test/path',
        size: 1024,
        createdAt,
        lastAccessed,
        accessCount: 5,
        checksum: 'abc123',
        isValid: false
      });

      expect(store.size).toBe(1024);
      expect(store.createdAt).toBe(createdAt);
      expect(store.lastAccessed).toBe(lastAccessed);
      expect(store.accessCount).toBe(5);
      expect(store.checksum).toBe('abc123');
      expect(store.isValid).toBe(false);
    });
  });

  describe('validate', () => {
    test('should validate existing cache directory', async () => {
      // Create test files
      await fs.ensureDir(tempDir);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');

      const isValid = await cacheStore.validate();
      expect(isValid).toBe(true);
      expect(cacheStore.isValid).toBe(true);
    });

    test('should fail validation if path does not exist', async () => {
      cacheStore.path = '/nonexistent/path';

      await expect(cacheStore.validate()).rejects.toThrow('Cache path does not exist');
      expect(cacheStore.isValid).toBe(false);
    });

    test('should fail validation if path is not a directory', async () => {
      const tempFile = path.join(tempDir, 'test-file.txt');
      await fs.ensureDir(tempDir);
      await fs.writeFile(tempFile, 'test content');
      cacheStore.path = tempFile;

      await expect(cacheStore.validate()).rejects.toThrow('Cache path is not a directory');
      expect(cacheStore.isValid).toBe(false);
    });
  });

  describe('touch', () => {
    test('should update lastAccessed timestamp and increment accessCount', async () => {
      const originalAccessCount = cacheStore.accessCount;
      const originalLastAccessed = new Date(cacheStore.lastAccessed);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await cacheStore.touch();

      expect(cacheStore.accessCount).toBe(originalAccessCount + 1);
      expect(cacheStore.lastAccessed.getTime()).toBeGreaterThan(originalLastAccessed.getTime());
    });
  });

  describe('isExpired', () => {
    test('should return true if cache entry is expired', () => {
      const oldDate = new Date(Date.now() - 2000); // 2 seconds ago
      cacheStore.lastAccessed = oldDate;

      const isExpired = cacheStore.isExpired(1000); // 1 second TTL
      expect(isExpired).toBe(true);
    });

    test('should return false if cache entry is not expired', () => {
      const recentDate = new Date(Date.now() - 500); // 0.5 seconds ago
      cacheStore.lastAccessed = recentDate;

      const isExpired = cacheStore.isExpired(1000); // 1 second TTL
      expect(isExpired).toBe(false);
    });
  });

  describe('getSize', () => {
    test('should return size if already set', async () => {
      cacheStore.size = 1024;
      const size = await cacheStore.getSize();
      expect(size).toBe(1024);
    });

    test('should calculate size if not set', async () => {
      // Create test files
      await fs.ensureDir(tempDir);
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'Hello'); // 5 bytes
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'World'); // 5 bytes

      const size = await cacheStore.getSize();
      expect(size).toBe(10);
      expect(cacheStore.size).toBe(10);
    });
  });

  describe('remove', () => {
    test('should remove cache directory', async () => {
      // Create test directory
      await fs.ensureDir(tempDir);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');

      expect(await fs.pathExists(tempDir)).toBe(true);

      await cacheStore.remove();

      expect(await fs.pathExists(tempDir)).toBe(false);
      expect(cacheStore.isValid).toBe(false);
    });

    test('should throw error if path is invalid', async () => {
      cacheStore.path = '/etc/passwd'; // Security-sensitive path

      await expect(cacheStore.remove()).rejects.toThrow('Cannot remove cache entry - path is in system directory');
    });
  });

  describe('toJSON', () => {
    test('should return JSON-serializable object', () => {
      const json = cacheStore.toJSON();

      expect(json).toHaveProperty('id', 'test-cache-id');
      expect(json).toHaveProperty('templateId', 'test-template');
      expect(json).toHaveProperty('version', '1.0.0');
      expect(json).toHaveProperty('path', tempDir);
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('lastAccessed');
      expect(json).toHaveProperty('accessCount', 0);
      expect(json).toHaveProperty('isValid', true);

      // Check that dates are serialized as ISO strings
      expect(typeof json.createdAt).toBe('string');
      expect(typeof json.lastAccessed).toBe('string');
    });
  });

  describe('fromJSON', () => {
    test('should create CacheStore instance from JSON data', () => {
      const data = {
        id: 'test-id',
        templateId: 'test-template',
        version: '1.0.0',
        path: '/test/path',
        size: 1024,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 5,
        checksum: 'abc123',
        isValid: true
      };

      const store = CacheStore.fromJSON(data);

      expect(store).toBeInstanceOf(CacheStore);
      expect(store.id).toBe(data.id);
      expect(store.templateId).toBe(data.templateId);
      expect(store.version).toBe(data.version);
      expect(store.path).toBe(data.path);
      expect(store.size).toBe(data.size);
      expect(store.accessCount).toBe(data.accessCount);
      expect(store.checksum).toBe(data.checksum);
      expect(store.isValid).toBe(data.isValid);
      expect(store.createdAt).toBeInstanceOf(Date);
      expect(store.lastAccessed).toBeInstanceOf(Date);
    });
  });

  describe('Utility Methods', () => {
    test('getFormattedSize should return human-readable format', () => {
      cacheStore.size = 1024;
      expect(cacheStore.getFormattedSize()).toBe('1 KB');

      cacheStore.size = 1048576;
      expect(cacheStore.getFormattedSize()).toBe('1 MB');

      cacheStore.size = 0;
      expect(cacheStore.getFormattedSize()).toBe('0 B');
    });

    test('getFormattedAge should return human-readable age', () => {
      const originalCreatedAt = cacheStore.createdAt;

      // Test recent cache (less than 1 hour)
      cacheStore.createdAt = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      expect(cacheStore.getFormattedAge()).toMatch(/30 minutes? ago/);

      // Test old cache (more than 1 day)
      cacheStore.createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      expect(cacheStore.getFormattedAge()).toMatch(/2 days? ago/);

      // Restore original
      cacheStore.createdAt = originalCreatedAt;
    });
  });

  describe('Checksum Validation', () => {
    test('should calculate checksum for cache directory', async () => {
      // Create test files
      await fs.ensureDir(tempDir);
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'Hello World');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'Test Content');

      // Calculate checksum manually
      const checksum = await cacheStore.calculateChecksum();
      cacheStore.checksum = checksum;

      expect(cacheStore.checksum).toBeDefined();
      expect(typeof cacheStore.checksum).toBe('string');
      expect(cacheStore.checksum.length).toBe(64); // SHA-256 produces 64 character hex string
    });

    test('should fail validation if checksum does not match', async () => {
      // Create test files
      await fs.ensureDir(tempDir);
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Hello World');

      // Set incorrect checksum
      cacheStore.checksum = 'incorrect-checksum';

      await expect(cacheStore.validate()).rejects.toThrow('Checksum mismatch');
      expect(cacheStore.isValid).toBe(false);
    });
  });
});