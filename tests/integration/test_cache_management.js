/**
 * Cache Management and Performance Integration Tests
 *
 * Tests for template caching functionality including:
 * - Performance improvements with repeated template use
 * - Cache storage location validation
 * - Cache invalidation when templates are updated
 * - Cache size limits enforcement
 * - TTL functionality
 * - Cache pruning of expired entries
 * - Performance metrics validation
 * - Cache clearing functionality
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const MemoryFS = require('memory-fs');

// Test constants
const CACHE_DIR = path.join(os.homedir(), '.xagi/create-ai-project/cache');
const TEST_TEMPLATE = 'react-next-template@1.0.0';
const TEST_TEMPLATE_NAME = 'React Next Template';
const PERFORMANCE_THRESHOLD_MS = 1000;
const CACHE_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Mock template data
const mockTemplate = {
  id: TEST_TEMPLATE,
  name: TEST_TEMPLATE_NAME,
  version: '1.0.0',
  description: 'React Next.js template for AI projects',
  author: 'XAGI Team',
  repository: 'https://github.com/xagi/react-next-template',
  size: 2048,
  files: [
    'package.json',
    'README.md',
    'src/index.js',
    'src/App.js',
    'public/index.html'
  ],
  dependencies: {
    'react': '^18.0.0',
    'next': '^13.0.0'
  }
};

describe('Cache Management and Performance Integration Tests', () => {
  let testCacheDir;
  let testTempDir;
  let memoryFS;
  let originalCacheDir;

  beforeAll(async () => {
    // Store original cache directory
    originalCacheDir = process.env.XAGI_CACHE_DIR;

    // Create test directories
    testCacheDir = path.join(os.tmpdir(), `xagi-cache-test-${Date.now()}`);
    testTempDir = path.join(os.tmpdir(), `xagi-temp-test-${Date.now()}`);

    await fs.ensureDir(testCacheDir);
    await fs.ensureDir(testTempDir);

    // Set test cache directory
    process.env.XAGI_CACHE_DIR = testCacheDir;

    // Initialize in-memory file system for mocking
    memoryFS = new MemoryFS();

    // Create mock template structure
    await createMockTemplate();
  });

  afterAll(async () => {
    // Restore original cache directory
    process.env.XAGI_CACHE_DIR = originalCacheDir;

    // Clean up test directories
    await fs.remove(testCacheDir);
    await fs.remove(testTempDir);
  });

  beforeEach(async () => {
    // Clear cache before each test
    await fs.emptyDir(testCacheDir);

    // Reset mock timers
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    // Restore real timers
    jest.useRealTimers();
  });

  describe('Template Caching Performance', () => {
    test('Template caching improves performance on repeated use', async () => {
      // First access - should be slow (no cache)
      const firstAccessStart = Date.now();
      await simulateTemplateAccess(TEST_TEMPLATE, 'first-access');
      const firstAccessDuration = Date.now() - firstAccessStart;

      // Verify cache was created
      const cacheEntryPath = path.join(testCacheDir, TEST_TEMPLATE);
      expect(await fs.pathExists(cacheEntryPath)).toBe(true);

      // Second access - should be fast (cached)
      const secondAccessStart = Date.now();
      await simulateTemplateAccess(TEST_TEMPLATE, 'second-access');
      const secondAccessDuration = Date.now() - secondAccessStart;

      // Performance improvement validation
      expect(secondAccessDuration).toBeLessThan(firstAccessDuration);
      expect(secondAccessDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);

      // Cache hit validation
      const cacheStats = await getCacheStats();
      expect(cacheStats.totalEntries).toBe(1);
      expect(cacheStats.totalAccessCount).toBeGreaterThanOrEqual(2);
    });

    test('Cache stores template metadata correctly', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'metadata-test');

      const cacheEntryPath = path.join(testCacheDir, TEST_TEMPLATE);
      const metadataPath = path.join(cacheEntryPath, 'metadata.json');

      expect(await fs.pathExists(metadataPath)).toBe(true);

      const metadata = await fs.readJSON(metadataPath);
      expect(metadata).toHaveProperty('id', TEST_TEMPLATE);
      expect(metadata).toHaveProperty('name', TEST_TEMPLATE_NAME);
      expect(metadata).toHaveProperty('version', '1.0.0');
      expect(metadata).toHaveProperty('cachedAt');
      expect(metadata).toHaveProperty('lastAccessed');
      expect(metadata).toHaveProperty('accessCount');
      expect(metadata.accessCount).toBe(1);
    });

    test('Cache updates access statistics on repeated use', async () => {
      // Access template multiple times
      for (let i = 0; i < 5; i++) {
        await simulateTemplateAccess(TEST_TEMPLATE, `access-${i}`);
      }

      const metadataPath = path.join(testCacheDir, TEST_TEMPLATE, 'metadata.json');
      const metadata = await fs.readJSON(metadataPath);

      expect(metadata.accessCount).toBe(5);
      expect(new Date(metadata.lastAccessed).getTime()).toBeGreaterThan(
        new Date(metadata.cachedAt).getTime()
      );
    });
  });

  describe('Cache Storage Location', () => {
    test('Cache is stored in correct location (~/.xagi/create-ai-project/cache/)', async () => {
      // Test with default cache location
      delete process.env.XAGI_CACHE_DIR;

      const defaultCacheDir = path.join(os.homedir(), '.xagi/create-ai-project/cache');

      // This test will fail because the cache directory doesn't exist yet
      expect(() => {
        if (!fs.pathExistsSync(defaultCacheDir)) {
          throw new Error(`Cache directory does not exist: ${defaultCacheDir}`);
        }
      }).toThrow('Cache directory does not exist');

      // Restore test cache directory
      process.env.XAGI_CACHE_DIR = testCacheDir;
    });

    test('Cache directory structure is properly organized', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'structure-test');

      const cacheEntryPath = path.join(testCacheDir, TEST_TEMPLATE);

      // Verify cache entry directory exists
      expect(await fs.pathExists(cacheEntryPath)).toBe(true);

      // Verify required subdirectories exist
      const subdirs = ['src', 'public', 'config'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(cacheEntryPath, subdir);
        expect(await fs.pathExists(subdirPath)).toBe(true);
      }

      // Verify metadata file exists
      const metadataPath = path.join(cacheEntryPath, 'metadata.json');
      expect(await fs.pathExists(metadataPath)).toBe(true);
    });

    test('Cache directory permissions are secure', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'permissions-test');

      const cacheEntryPath = path.join(testCacheDir, TEST_TEMPLATE);
      const stats = await fs.stat(cacheEntryPath);

      // Verify directory has appropriate permissions
      expect(stats.mode).toBe(parseInt('755', 8)); // rwxr-xr-x

      // Verify files are not world-writable
      const files = await fs.readdir(cacheEntryPath);
      for (const file of files) {
        const filePath = path.join(cacheEntryPath, file);
        const fileStats = await fs.stat(filePath);
        expect(fileStats.mode & parseInt('022', 8)).toBe(0); // No write permissions for group/others
      }
    });
  });

  describe('Cache Invalidation', () => {
    test('Cache invalidation works when templates are updated', async () => {
      // Cache original template
      await simulateTemplateAccess(TEST_TEMPLATE, 'original');

      let metadataPath = path.join(testCacheDir, TEST_TEMPLATE, 'metadata.json');
      let originalMetadata = await fs.readJSON(metadataPath);

      // Simulate template update by changing version
      const updatedTemplate = `${TEST_TEMPLATE.replace('1.0.0', '1.1.0')}`;

      // Access updated template
      await simulateTemplateAccess(updatedTemplate, 'updated');

      // Verify cache invalidation occurred
      const cacheStats = await getCacheStats();
      expect(cacheStats.totalEntries).toBe(2); // Both versions should be cached

      // Verify updated template metadata
      const updatedMetadataPath = path.join(testCacheDir, updatedTemplate, 'metadata.json');
      const updatedMetadata = await fs.readJSON(updatedMetadataPath);
      expect(updatedMetadata.version).toBe('1.1.0');
    });

    test('Cache detects template modifications', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'modification-test');

      // Simulate template modification
      const cacheEntryPath = path.join(testCacheDir, TEST_TEMPLATE);
      const packageJsonPath = path.join(cacheEntryPath, 'package.json');

      // Modify cached file
      const packageJson = await fs.readJSON(packageJsonPath);
      packageJson.version = '1.0.1-modified';
      await fs.writeJSON(packageJsonPath, packageJson);

      // This should trigger cache invalidation on next access
      const validationResult = await validateCacheIntegrity(TEST_TEMPLATE);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.reason).toContain('modification detected');
    });
  });

  describe('Cache Size Limits', () => {
    test('Cache size limits are enforced', async () => {
      // Create multiple large cache entries
      const largeTemplates = [
        'large-template-1@1.0.0',
        'large-template-2@1.0.0',
        'large-template-3@1.0.0'
      ];

      for (const template of largeTemplates) {
        await simulateTemplateAccess(template, 'size-test', {
          size: 20 * 1024 * 1024 // 20MB each
        });
      }

      const cacheStats = await getCacheStats();

      // This test will fail because cache size limits are not implemented yet
      expect(cacheStats.totalSize).toBeLessThan(CACHE_SIZE_LIMIT);

      // Verify that oldest entries are removed when limit is exceeded
      expect(cacheStats.totalEntries).toBeLessThanOrEqual(2); // Should keep only 2 entries
    });

    test('Cache size calculation is accurate', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'size-calculation');

      const cacheEntryPath = path.join(testCacheDir, TEST_TEMPLATE);
      const actualSize = await calculateDirectorySize(cacheEntryPath);
      const metadata = await fs.readJSON(path.join(cacheEntryPath, 'metadata.json'));

      // Verify cached size matches actual size
      expect(metadata.size).toBe(actualSize);

      // Verify size is within reasonable bounds
      expect(actualSize).toBeGreaterThan(0);
      expect(actualSize).toBeLessThan(1024 * 1024); // Less than 1MB
    });
  });

  describe('Cache TTL (Time-to-Live)', () => {
    test('Cache TTL functionality works', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'ttl-test');

      // Fast-forward time beyond TTL
      jest.advanceTimersByTime(CACHE_TTL_MS + 1000);

      // Try to access expired cache
      const result = await simulateTemplateAccess(TEST_TEMPLATE, 'expired-access');

      // This test will fail because TTL functionality is not implemented yet
      expect(result.fromCache).toBe(false);
      expect(result.reason).toContain('expired');
    });

    test('Cache entries have proper TTL metadata', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'ttl-metadata');

      const metadataPath = path.join(testCacheDir, TEST_TEMPLATE, 'metadata.json');
      const metadata = await fs.readJSON(metadataPath);

      expect(metadata).toHaveProperty('ttl', CACHE_TTL_MS);
      expect(metadata).toHaveProperty('expiresAt');

      const expiresAt = new Date(metadata.expiresAt);
      const cachedAt = new Date(metadata.cachedAt);

      expect(expiresAt.getTime()).toBe(cachedAt.getTime() + CACHE_TTL_MS);
    });
  });

  describe('Cache Pruning', () => {
    test('Cache pruning removes expired entries', async () => {
      // Create cache entries with different ages
      const templates = [
        { id: 'old-template@1.0.0', age: CACHE_TTL_MS + 1000 },
        { id: 'recent-template@1.0.0', age: CACHE_TTL_MS - 1000 },
        { id: 'very-old-template@1.0.0', age: CACHE_TTL_MS * 2 }
      ];

      for (const template of templates) {
        await simulateTemplateAccess(template.id, 'prune-test');

        // Modify metadata to simulate different ages
        const metadataPath = path.join(testCacheDir, template.id, 'metadata.json');
        const metadata = await fs.readJSON(metadataPath);
        metadata.cachedAt = new Date(Date.now() - template.age).toISOString();
        await fs.writeJSON(metadataPath, metadata);
      }

      // Run cache pruning
      const pruneResult = await pruneCache();

      // This test will fail because cache pruning is not implemented yet
      expect(pruneResult.removedEntries).toBe(2); // Should remove expired entries
      expect(pruneResult.remainingEntries).toBe(1); // Should keep recent entry

      // Verify expired entries are removed
      expect(await fs.pathExists(path.join(testCacheDir, 'old-template@1.0.0'))).toBe(false);
      expect(await fs.pathExists(path.join(testCacheDir, 'very-old-template@1.0.0'))).toBe(false);
      expect(await fs.pathExists(path.join(testCacheDir, 'recent-template@1.0.0'))).toBe(true);
    });

    test('Cache pruning respects size limits', async () => {
      // Create cache entries that exceed size limit
      const largeTemplates = Array.from({ length: 10 }, (_, i) => `large-template-${i}@1.0.0`);

      for (const template of largeTemplates) {
        await simulateTemplateAccess(template, 'size-prune-test', {
          size: 10 * 1024 * 1024 // 10MB each
        });
      }

      const beforeStats = await getCacheStats();

      // Run cache pruning with size limit
      const pruneResult = await pruneCache({ maxSize: 30 * 1024 * 1024 }); // 30MB limit

      // This test will fail because size-based pruning is not implemented yet
      expect(pruneResult.removedEntries).toBeGreaterThan(0);
      expect(pruneResult.reason).toContain('size limit');

      const afterStats = await getCacheStats();
      expect(afterStats.totalSize).toBeLessThan(30 * 1024 * 1024);
    });
  });

  describe('Performance Metrics', () => {
    test('Performance metrics meet requirements (<1s template download)', async () => {
      // Test cold cache (first access)
      const coldStart = Date.now();
      await simulateTemplateAccess(TEST_TEMPLATE, 'cold-cache');
      const coldDuration = Date.now() - coldStart;

      // Test warm cache (second access)
      const warmStart = Date.now();
      await simulateTemplateAccess(TEST_TEMPLATE, 'warm-cache');
      const warmDuration = Date.now() - warmStart;

      // This test will fail because performance requirements are not met yet
      expect(warmDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(warmDuration).toBeLessThan(coldDuration);

      // Verify performance metrics are recorded
      const metadataPath = path.join(testCacheDir, TEST_TEMPLATE, 'metadata.json');
      const metadata = await fs.readJSON(metadataPath);

      expect(metadata).toHaveProperty('performance');
      expect(metadata.performance).toHaveProperty('lastAccessTime');
      expect(metadata.performance).toHaveProperty('averageAccessTime');
      expect(metadata.performance.averageAccessTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    test('Performance metrics are accurately tracked', async () => {
      const accessTimes = [];

      // Access template multiple times to gather performance data
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await simulateTemplateAccess(TEST_TEMPLATE, `perf-test-${i}`);
        const duration = Date.now() - start;
        accessTimes.push(duration);
      }

      const metadataPath = path.join(testCacheDir, TEST_TEMPLATE, 'metadata.json');
      const metadata = await fs.readJSON(metadataPath);

      // Verify performance metrics
      expect(metadata.performance).toHaveProperty('accessTimes');
      expect(metadata.performance.accessTimes.length).toBe(5);

      // Calculate average from recorded times
      const recordedAverage = metadata.performance.averageAccessTime;
      const actualAverage = accessTimes.reduce((a, b) => a + b, 0) / accessTimes.length;

      expect(recordedAverage).toBeCloseTo(actualAverage, 10);
    });
  });

  describe('Cache Clearing Functionality', () => {
    test('Cache clearing works correctly', async () => {
      // Create multiple cache entries
      const templates = [
        'template-1@1.0.0',
        'template-2@1.0.0',
        'template-3@1.0.0'
      ];

      for (const template of templates) {
        await simulateTemplateAccess(template, 'clear-test');
      }

      // Verify cache entries exist
      for (const template of templates) {
        expect(await fs.pathExists(path.join(testCacheDir, template))).toBe(true);
      }

      // Clear entire cache
      const clearResult = await clearCache();

      // This test will fail because cache clearing is not implemented yet
      expect(clearResult.success).toBe(true);
      expect(clearResult.clearedEntries).toBe(3);

      // Verify cache is empty
      const cacheStats = await getCacheStats();
      expect(cacheStats.totalEntries).toBe(0);
      expect(cacheStats.totalSize).toBe(0);

      // Verify files are removed
      for (const template of templates) {
        expect(await fs.pathExists(path.join(testCacheDir, template))).toBe(false);
      }
    });

    test('Selective cache clearing works', async () => {
      const templates = [
        'keep-template@1.0.0',
        'remove-template@1.0.0',
        'another-template@1.0.0'
      ];

      for (const template of templates) {
        await simulateTemplateAccess(template, 'selective-clear-test');
      }

      // Clear specific template
      const clearResult = await clearCache({ template: 'remove-template@1.0.0' });

      // This test will fail because selective cache clearing is not implemented yet
      expect(clearResult.success).toBe(true);
      expect(clearResult.clearedEntries).toBe(1);

      // Verify specific entry is removed
      expect(await fs.pathExists(path.join(testCacheDir, 'remove-template@1.0.0'))).toBe(false);

      // Verify other entries remain
      expect(await fs.pathExists(path.join(testCacheDir, 'keep-template@1.0.0'))).toBe(true);
      expect(await fs.pathExists(path.join(testCacheDir, 'another-template@1.0.0'))).toBe(true);
    });

    test('Cache clearing with confirmation works', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'confirmation-test');

      // This test will fail because cache clearing with confirmation is not implemented yet
      const clearResult = await clearCache({ requireConfirmation: true });

      expect(clearResult.success).toBe(true);
      expect(clearResult.confirmed).toBe(true);
      expect(clearResult.clearedEntries).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('Cache handles concurrent access gracefully', async () => {
      const accessPromises = [];

      // Simulate concurrent access
      for (let i = 0; i < 10; i++) {
        accessPromises.push(simulateTemplateAccess(TEST_TEMPLATE, `concurrent-${i}`));
      }

      const results = await Promise.allSettled(accessPromises);

      // All concurrent accesses should complete successfully
      const successfulAccesses = results.filter(r => r.status === 'fulfilled');
      expect(successfulAccesses.length).toBe(10);

      // Cache should not be corrupted
      const cacheStats = await getCacheStats();
      expect(cacheStats.totalEntries).toBe(1);
      expect(cacheStats.totalAccessCount).toBe(10);
    });

    test('Cache handles disk space errors gracefully', async () => {
      // Mock disk space error
      const originalEnsureDir = fs.ensureDir;
      fs.ensureDir = jest.fn().mockRejectedValue(new Error('No space left on device'));

      try {
        await expect(simulateTemplateAccess(TEST_TEMPLATE, 'disk-error-test'))
          .rejects.toThrow('No space left on device');
      } finally {
        fs.ensureDir = originalEnsureDir;
      }

      // Cache should be in consistent state
      const cacheStats = await getCacheStats();
      expect(cacheStats.totalEntries).toBe(0);
    });

    test('Cache handles corrupted metadata gracefully', async () => {
      await simulateTemplateAccess(TEST_TEMPLATE, 'corruption-test');

      // Corrupt metadata file
      const metadataPath = path.join(testCacheDir, TEST_TEMPLATE, 'metadata.json');
      await fs.writeFile(metadataPath, 'corrupted json content');

      // Should detect corruption and handle gracefully
      const result = await validateCacheIntegrity(TEST_TEMPLATE);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('corrupted');
    });
  });

  // Helper functions
  async function createMockTemplate() {
    const templatePath = path.join(testTempDir, 'templates', TEST_TEMPLATE);
    await fs.ensureDir(templatePath);

    // Create package.json
    const packageJson = {
      name: 'react-next-template',
      version: '1.0.0',
      description: 'React Next.js template for AI projects',
      main: 'src/index.js',
      dependencies: {
        'react': '^18.0.0',
        'next': '^13.0.0'
      }
    };
    await fs.writeJSON(path.join(templatePath, 'package.json'), packageJson);

    // Create source files
    await fs.ensureDir(path.join(templatePath, 'src'));
    await fs.writeFile(path.join(templatePath, 'src', 'index.js'), '// Entry point');
    await fs.writeFile(path.join(templatePath, 'src', 'App.js'), '// App component');

    // Create other directories
    await fs.ensureDir(path.join(templatePath, 'public'));
    await fs.writeFile(path.join(templatePath, 'public', 'index.html'), '<html></html>');
    await fs.ensureDir(path.join(templatePath, 'config'));
    await fs.writeFile(path.join(templatePath, 'config', 'next.config.js'), '// Next.js config');
  }

  async function simulateTemplateAccess(templateId, scenario, options = {}) {
    const cacheEntryPath = path.join(testCacheDir, templateId);
    const metadataPath = path.join(cacheEntryPath, 'metadata.json');

    // Simulate cache access logic
    if (await fs.pathExists(cacheEntryPath)) {
      // Cache hit
      const metadata = await fs.readJSON(metadataPath);
      metadata.lastAccessed = new Date().toISOString();
      metadata.accessCount = (metadata.accessCount || 0) + 1;

      // Update performance metrics
      if (!metadata.performance) {
        metadata.performance = {};
      }
      metadata.performance.lastAccessTime = Date.now();
      metadata.performance.accessTimes = metadata.performance.accessTimes || [];
      metadata.performance.accessTimes.push(10); // Simulated access time

      const avgTime = metadata.performance.accessTimes.reduce((a, b) => a + b, 0) / metadata.performance.accessTimes.length;
      metadata.performance.averageAccessTime = avgTime;

      await fs.writeJSON(metadataPath, metadata);

      return {
        fromCache: true,
        scenario,
        accessTime: 10 // Simulated cache access time
      };
    } else {
      // Cache miss - create cache entry
      await fs.ensureDir(cacheEntryPath);

      // Copy template files
      await fs.copy(path.join(testTempDir, 'templates', TEST_TEMPLATE), cacheEntryPath);

      // Create metadata
      const metadata = {
        id: templateId,
        name: options.name || TEST_TEMPLATE_NAME,
        version: '1.0.0',
        size: options.size || 2048,
        cachedAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
        ttl: CACHE_TTL_MS,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        performance: {
          lastAccessTime: Date.now(),
          accessTimes: [100], // Simulated download time
          averageAccessTime: 100
        }
      };

      await fs.writeJSON(metadataPath, metadata);

      return {
        fromCache: false,
        scenario,
        accessTime: 100 // Simulated download time
      };
    }
  }

  async function getCacheStats() {
    const entries = await fs.readdir(testCacheDir);
    let totalSize = 0;
    let totalAccessCount = 0;

    for (const entry of entries) {
      const entryPath = path.join(testCacheDir, entry);
      const stats = await fs.stat(entryPath);

      if (stats.isDirectory()) {
        totalSize += await calculateDirectorySize(entryPath);

        const metadataPath = path.join(entryPath, 'metadata.json');
        if (await fs.pathExists(metadataPath)) {
          const metadata = await fs.readJSON(metadataPath);
          totalAccessCount += metadata.accessCount || 0;
        }
      }
    }

    return {
      totalEntries: entries.length,
      totalSize,
      totalAccessCount
    };
  }

  async function calculateDirectorySize(dirPath) {
    let totalSize = 0;
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        totalSize += await calculateDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  async function validateCacheIntegrity(templateId) {
    const cacheEntryPath = path.join(testCacheDir, templateId);
    const metadataPath = path.join(cacheEntryPath, 'metadata.json');

    try {
      if (!await fs.pathExists(cacheEntryPath)) {
        return { isValid: false, reason: 'Cache entry not found' };
      }

      if (!await fs.pathExists(metadataPath)) {
        return { isValid: false, reason: 'Metadata file missing' };
      }

      const metadata = await fs.readJSON(metadataPath);

      // Validate metadata structure
      const requiredFields = ['id', 'name', 'version', 'cachedAt', 'lastAccessed'];
      for (const field of requiredFields) {
        if (!metadata[field]) {
          return { isValid: false, reason: `Missing required field: ${field}` };
        }
      }

      return { isValid: true, reason: 'Valid' };
    } catch (error) {
      return { isValid: false, reason: `Corrupted metadata: ${error.message}` };
    }
  }

  async function pruneCache(options = {}) {
    // This is a mock implementation - will fail because pruning is not implemented
    throw new Error('Cache pruning not implemented');
  }

  async function clearCache(options = {}) {
    // This is a mock implementation - will fail because clearing is not implemented
    throw new Error('Cache clearing not implemented');
  }
});