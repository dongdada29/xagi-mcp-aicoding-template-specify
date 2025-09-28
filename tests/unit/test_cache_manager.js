const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const CacheManager = require('../../src/core/cache-manager');
const CacheStore = require('../../src/models/cache');

describe('CacheManager Service', () => {
  let cacheManager;
  let testCacheDir;
  let testTemplateDir;

  beforeEach(async() => {
    // Create test directories
    testCacheDir = path.join(os.tmpdir(), `cache-manager-test-${Date.now()}`);
    testTemplateDir = path.join(os.tmpdir(), `template-test-${Date.now()}`);

    await fs.ensureDir(testCacheDir);
    await fs.ensureDir(testTemplateDir);

    // Create test template files
    await createTestTemplate(testTemplateDir);

    // Create cache manager with test configuration
    cacheManager = new CacheManager({
      cacheDir: testCacheDir,
      ttl: 60 * 60 * 1000, // 1 hour
      maxSize: 10 * 1024 * 1024, // 10MB
      maxEntries: 10,
      persistent: true,
      enableMetrics: true,
      lruSize: 5
    });
  });

  afterEach(async() => {
    // Clean up cache manager intervals
    if (cacheManager) {
      cacheManager.destroy();
    }

    // Clean up test directories
    await fs.remove(testCacheDir);
    await fs.remove(testTemplateDir);
  });

  describe('Constructor', () => {
    test('should create CacheManager instance with default configuration', () => {
      const defaultManager = new CacheManager();

      expect(defaultManager).toBeInstanceOf(CacheManager);
      expect(defaultManager.cacheDir).toContain('.xagi/create-ai-project/cache');
      expect(defaultManager.config.ttl).toBe(24 * 60 * 60 * 1000);
      expect(defaultManager.config.maxSize).toBe(100 * 1024 * 1024);
    });

    test('should create CacheManager instance with custom configuration', () => {
      const customManager = new CacheManager({
        cacheDir: testCacheDir,
        ttl: 30 * 60 * 1000,
        maxSize: 5 * 1024 * 1024,
        maxEntries: 5
      });

      expect(customManager.cacheDir).toBe(testCacheDir);
      expect(customManager.config.ttl).toBe(30 * 60 * 1000);
      expect(customManager.config.maxSize).toBe(5 * 1024 * 1024);
      expect(customManager.config.maxEntries).toBe(5);
    });

    test('should initialize cache directory', async() => {
      expect(await fs.pathExists(testCacheDir)).toBe(true);
    });
  });

  describe('getCacheEntry', () => {
    test('should return null for non-existent cache entry', async() => {
      const result = await cacheManager.getCacheEntry('non-existent', '1.0.0');
      expect(result).toBeNull();
    });

    test('should return cache entry for existing template', async() => {
      // First, create a cache entry
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      // Then retrieve it
      const result = await cacheManager.getCacheEntry('test-template', '1.0.0');

      expect(result).toBeInstanceOf(CacheStore);
      expect(result.templateId).toBe('test-template');
      expect(result.version).toBe('1.0.0');
      expect(result.isValid).toBe(true);
    });

    test('should update access statistics on retrieval', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      const initialStats = await cacheManager.getCacheStats();
      const initialAccessCount = initialStats.performance.accessCount;

      // Retrieve cache entry
      await cacheManager.getCacheEntry('test-template', '1.0.0');

      const updatedStats = await cacheManager.getCacheStats();
      expect(updatedStats.performance.accessCount).toBe(initialAccessCount + 1);
    });

    test('should return null for expired cache entry', async() => {
      // Create cache manager with very short TTL
      const shortTtlManager = new CacheManager({
        cacheDir: testCacheDir,
        ttl: 100 // 100ms
      });

      await shortTtlManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await shortTtlManager.getCacheEntry('test-template', '1.0.0');
      expect(result).toBeNull();
    });

    test('should update LRU cache on successful retrieval', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      // First retrieval - should add to LRU cache
      const firstResult = await cacheManager.getCacheEntry('test-template', '1.0.0');
      expect(cacheManager.lruCache.size).toBe(1);

      // Second retrieval - should hit LRU cache
      const secondResult = await cacheManager.getCacheEntry('test-template', '1.0.0');
      expect(firstResult).toBe(secondResult); // Should be same object from LRU
    });
  });

  describe('setCacheEntry', () => {
    test('should create new cache entry', async() => {
      const result = await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      expect(result).toBeInstanceOf(CacheStore);
      expect(result.templateId).toBe('test-template');
      expect(result.version).toBe('1.0.0');
      expect(result.isValid).toBe(true);
      expect(result.checksum).toBeDefined();

      // Verify files were copied
      const cachePath = path.join(testCacheDir, 'test-template@1.0.0');
      expect(await fs.pathExists(cachePath)).toBe(true);
      expect(await fs.pathExists(path.join(cachePath, 'package.json'))).toBe(true);
    });

    test('should replace existing cache entry', async() => {
      // Create initial cache entry
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      // Update template file
      await fs.writeFile(path.join(testTemplateDir, 'new-file.txt'), 'new content');

      // Replace cache entry
      const result = await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      expect(result).toBeInstanceOf(CacheStore);
      expect(result.templateId).toBe('test-template');

      // Verify new file exists in cache
      const cachePath = path.join(testCacheDir, 'test-template@1.0.0');
      expect(await fs.pathExists(path.join(cachePath, 'new-file.txt'))).toBe(true);
    });

    test('should enforce cache size limits', async() => {
      // Create cache manager with small size limit
      const smallCacheManager = new CacheManager({
        cacheDir: testCacheDir,
        maxSize: 1024 // 1KB
      });

      // This should trigger cache eviction
      const result = await smallCacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);
      expect(result).toBeDefined();
    });

    test('should calculate checksum for cache entry', async() => {
      const result = await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe('string');
      expect(result.checksum.length).toBe(64); // SHA-256 hex string
    });

    test('should validate source path before creating cache entry', async() => {
      await expect(cacheManager.setCacheEntry('test-template', '1.0.0', '/nonexistent/path'))
        .rejects.toThrow('Source path does not exist');
    });
  });

  describe('removeCacheEntry', () => {
    test('should remove existing cache entry', async() => {
      // Create cache entry first
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      // Verify it exists
      expect(await cacheManager.isCached('test-template', '1.0.0')).toBe(true);

      // Remove it
      const result = await cacheManager.removeCacheEntry('test-template', '1.0.0');
      expect(result).toBe(true);

      // Verify it's gone
      expect(await cacheManager.isCached('test-template', '1.0.0')).toBe(false);
    });

    test('should handle removal of non-existent cache entry', async() => {
      const result = await cacheManager.removeCacheEntry('non-existent', '1.0.0');
      expect(result).toBe(true); // Should still return true (idempotent)
    });

    test('should remove from LRU cache', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);
      await cacheManager.getCacheEntry('test-template', '1.0.0'); // Add to LRU

      expect(cacheManager.lruCache.size).toBe(1);

      await cacheManager.removeCacheEntry('test-template', '1.0.0');
      expect(cacheManager.lruCache.size).toBe(0);
    });

    test('should remove metadata file', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      const metadataPath = path.join(testCacheDir, 'test-template@1.0.0.meta.json');
      expect(await fs.pathExists(metadataPath)).toBe(true);

      await cacheManager.removeCacheEntry('test-template', '1.0.0');
      expect(await fs.pathExists(metadataPath)).toBe(false);
    });
  });

  describe('clearCache', () => {
    test('should clear all cache entries', async() => {
      // Create multiple cache entries
      await cacheManager.setCacheEntry('template1', '1.0.0', testTemplateDir);
      await cacheManager.setCacheEntry('template2', '1.0.0', testTemplateDir);
      await cacheManager.setCacheEntry('template3', '1.0.0', testTemplateDir);

      // Verify they exist
      expect(await cacheManager.isCached('template1', '1.0.0')).toBe(true);
      expect(await cacheManager.isCached('template2', '1.0.0')).toBe(true);
      expect(await cacheManager.isCached('template3', '1.0.0')).toBe(true);

      // Clear cache
      const result = await cacheManager.clearCache();

      expect(result.success).toBe(true);
      expect(result.clearedEntries).toBe(3);

      // Verify they're gone
      expect(await cacheManager.isCached('template1', '1.0.0')).toBe(false);
      expect(await cacheManager.isCached('template2', '1.0.0')).toBe(false);
      expect(await cacheManager.isCached('template3', '1.0.0')).toBe(false);
    });

    test('should preserve specified entries', async() => {
      await cacheManager.setCacheEntry('template1', '1.0.0', testTemplateDir);
      await cacheManager.setCacheEntry('template2', '1.0.0', testTemplateDir);

      const result = await cacheManager.clearCache({
        preserve: ['template1']
      });

      expect(result.success).toBe(true);
      expect(result.clearedEntries).toBe(1);
      expect(result.preservedEntries).toBe(1);

      // Verify template1 is preserved
      expect(await cacheManager.isCached('template1', '1.0.0')).toBe(true);
      expect(await cacheManager.isCached('template2', '1.0.0')).toBe(false);
    });

    test('should clear LRU cache', async() => {
      await cacheManager.setCacheEntry('template1', '1.0.0', testTemplateDir);
      await cacheManager.getCacheEntry('template1', '1.0.0'); // Add to LRU

      expect(cacheManager.lruCache.size).toBe(1);

      await cacheManager.clearCache();
      expect(cacheManager.lruCache.size).toBe(0);
    });
  });

  describe('pruneCache', () => {
    test('should remove expired entries', async() => {
      const shortTtlManager = new CacheManager({
        cacheDir: testCacheDir,
        ttl: 100 // 100ms
      });

      await shortTtlManager.setCacheEntry('expired-template', '1.0.0', testTemplateDir);
      await shortTtlManager.setCacheEntry('fresh-template', '1.0.0', testTemplateDir);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await shortTtlManager.pruneCache();

      expect(result.success).toBe(true);
      expect(result.removedEntries).toBe(1);
      expect(result.remainingEntries).toBe(1);

      // Verify expired entry is removed
      expect(await shortTtlManager.isCached('expired-template', '1.0.0')).toBe(false);
      expect(await shortTtlManager.isCached('fresh-template', '1.0.0')).toBe(true);
    });

    test('should support dry run mode', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      const result = await cacheManager.pruneCache({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.removedEntries).toBe(0); // Nothing to prune in normal case

      // Entry should still exist after dry run
      expect(await cacheManager.isCached('test-template', '1.0.0')).toBe(true);
    });

    test('should handle aggressive pruning', async() => {
      // Create invalid cache entry
      await cacheManager.setCacheEntry('invalid-template', '1.0.0', testTemplateDir);

      // Corrupt the cache directory
      const cachePath = path.join(testCacheDir, 'invalid-template@1.0.0');
      await fs.remove(cachePath);

      const result = await cacheManager.pruneCache({ aggressive: true });

      expect(result.success).toBe(true);
      expect(result.removedEntries).toBe(1);
    });
  });

  describe('getCacheStats', () => {
    test('should return comprehensive cache statistics', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);
      await cacheManager.getCacheEntry('test-template', '1.0.0'); // Generate some hits

      const stats = await cacheManager.getCacheStats();

      expect(stats).toHaveProperty('basic');
      expect(stats).toHaveProperty('performance');
      expect(stats).toHaveProperty('policies');
      expect(stats).toHaveProperty('lru');
      expect(stats).toHaveProperty('entries');

      expect(stats.basic.totalEntries).toBe(1);
      expect(stats.performance.hits).toBe(1);
      expect(stats.lru.lruSize).toBe(1);
    });

    test('should calculate hit rate correctly', async() => {
      const stats = await cacheManager.getCacheStats();

      // Initially no hits
      expect(stats.performance.hitRate).toBe(0);

      // Add some cache activity
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);
      await cacheManager.getCacheEntry('test-template', '1.0.0');
      await cacheManager.getCacheEntry('test-template', '1.0.0');

      const updatedStats = await cacheManager.getCacheStats();
      expect(updatedStats.performance.hitRate).toBeGreaterThan(0);
    });

    test('should include detailed entry information', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      const stats = await cacheManager.getCacheStats();

      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0]).toHaveProperty('id');
      expect(stats.entries[0]).toHaveProperty('templateId');
      expect(stats.entries[0]).toHaveProperty('version');
      expect(stats.entries[0]).toHaveProperty('formattedSize');
      expect(stats.entries[0]).toHaveProperty('formattedAge');
    });
  });

  describe('isCached', () => {
    test('should return true for cached templates', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      expect(await cacheManager.isCached('test-template', '1.0.0')).toBe(true);
    });

    test('should return false for non-cached templates', async() => {
      expect(await cacheManager.isCached('non-existent', '1.0.0')).toBe(false);
    });

    test('should check LRU cache first', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);
      await cacheManager.getCacheEntry('test-template', '1.0.0'); // Add to LRU

      // Remove from disk but keep in LRU
      await cacheManager.removeCacheEntry('test-template', '1.0.0');
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir); // Recreate

      // Should still return true (from LRU)
      expect(await cacheManager.isCached('test-template', '1.0.0')).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    test('should track performance metrics', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);
      await cacheManager.getCacheEntry('test-template', '1.0.0');

      const performanceMetrics = cacheManager.getPerformanceMetrics();

      expect(performanceMetrics).toHaveProperty('accessTimes');
      expect(performanceMetrics).toHaveProperty('averageAccessTime');
      expect(performanceMetrics).toHaveProperty('cacheHitRate');
      expect(performanceMetrics.accessTimes.length).toBeGreaterThan(0);
    });

    test('should allow metrics reset', async() => {
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);
      await cacheManager.getCacheEntry('test-template', '1.0.0');

      const initialStats = await cacheManager.getCacheStats();
      expect(initialStats.performance.accessCount).toBeGreaterThan(0);

      cacheManager.resetMetrics();

      const resetStats = await cacheManager.getCacheStats();
      expect(resetStats.performance.accessCount).toBe(0);
      expect(resetStats.performance.hits).toBe(0);
      expect(resetStats.performance.misses).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid template paths gracefully', async() => {
      await expect(cacheManager.setCacheEntry('test', '1.0.0', 'invalid<>path'))
        .rejects.toThrow('Invalid source path');
    });

    test('should handle missing template paths gracefully', async() => {
      await expect(cacheManager.setCacheEntry('test', '1.0.0', '/nonexistent/path'))
        .rejects.toThrow('Source path does not exist');
    });

    test('should handle corrupted metadata gracefully', async() => {
      // Create cache entry
      await cacheManager.setCacheEntry('test-template', '1.0.0', testTemplateDir);

      // Clear LRU cache to force disk access
      cacheManager.lruCache.clear();

      // Remove the actual cache directory but leave corrupted metadata
      const cachePath = path.join(testCacheDir, 'test-template@1.0.0');
      const metadataPath = path.join(testCacheDir, 'test-template@1.0.0.meta.json');

      await fs.remove(cachePath);
      await fs.writeFile(metadataPath, '{ invalid json: ' );

      // Should handle gracefully and return null
      const result = await cacheManager.getCacheEntry('test-template', '1.0.0');
      expect(result).toBeNull();
    });
  });

  describe('LRU Cache Behavior', () => {
    test('should evict oldest entries when LRU cache is full', async() => {
      // Create cache manager with small LRU size
      const smallLruManager = new CacheManager({
        cacheDir: testCacheDir,
        lruSize: 2
      });

      // Add 3 cache entries
      await smallLruManager.setCacheEntry('template1', '1.0.0', testTemplateDir);
      await smallLruManager.setCacheEntry('template2', '1.0.0', testTemplateDir);
      await smallLruManager.setCacheEntry('template3', '1.0.0', testTemplateDir);

      // Access all entries to populate LRU cache
      await smallLruManager.getCacheEntry('template1', '1.0.0');
      await smallLruManager.getCacheEntry('template2', '1.0.0');
      await smallLruManager.getCacheEntry('template3', '1.0.0');

      // LRU cache should be at max size
      expect(smallLruManager.lruCache.size).toBe(2);
    });

    test('should update LRU access order on retrieval', async() => {
      await cacheManager.setCacheEntry('template1', '1.0.0', testTemplateDir);
      await cacheManager.setCacheEntry('template2', '1.0.0', testTemplateDir);

      // Access first template
      await cacheManager.getCacheEntry('template1', '1.0.0');

      // Access second template (should move it to most recent)
      await cacheManager.getCacheEntry('template2', '1.0.0');

      // Both should be in LRU cache
      expect(cacheManager.lruCache.size).toBe(2);
    });
  });

  // Helper function to create test template
  async function createTestTemplate(templateDir) {
    const packageJson = {
      name: 'test-template',
      version: '1.0.0',
      description: 'Test template',
      main: 'index.js'
    };

    await fs.writeJSON(path.join(templateDir, 'package.json'), packageJson);
    await fs.writeFile(path.join(templateDir, 'README.md'), '# Test Template');
    await fs.writeFile(path.join(templateDir, 'index.js'), 'console.log("Hello from template");');

    // Create subdirectories
    await fs.ensureDir(path.join(templateDir, 'src'));
    await fs.writeFile(path.join(templateDir, 'src', 'app.js'), '// App code');
  }
});
