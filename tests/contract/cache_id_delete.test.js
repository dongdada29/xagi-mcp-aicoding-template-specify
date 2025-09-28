const request = require('supertest');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');

// Mock cache service that doesn't exist yet
let cacheService;
try {
  cacheService = require('../../../src/services/cacheService');
  jest.mock('../../../src/services/cacheService', () => ({
    getCacheEntry: jest.fn(),
    deleteCacheEntry: jest.fn(),
    invalidateCache: jest.fn(),
    getCacheStats: jest.fn()
  }));
} catch (error) {
  // If the module doesn't exist, create mock functions directly
  cacheService = {
    getCacheEntry: jest.fn(),
    deleteCacheEntry: jest.fn(),
    invalidateCache: jest.fn(),
    getCacheStats: jest.fn()
  };
}

// Create a minimal Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock DELETE /cache/{id} endpoint that will be implemented later
  app.delete('/cache/:id', (req, res) => {
    // This endpoint doesn't exist yet, so it should return 404
    res.status(404).json({ error: 'Endpoint not implemented' });
  });

  return app;
};

describe('DELETE /cache/{id} endpoint', () => {
  let app;
  let testCacheDir;
  let testCacheEntry;

  beforeEach(async() => {
    app = createTestApp();
    testCacheDir = path.join('/tmp', `cache-delete-test-${Date.now()}`);
    await fs.ensureDir(testCacheDir);

    // Set up test cache entry
    testCacheEntry = {
      id: 'react-next-template@1.0.0',
      name: 'React Next Template',
      version: '1.0.0',
      size: 2048,
      accessCount: 5,
      lastAccessed: new Date().toISOString(),
      cachedAt: new Date().toISOString(),
      path: path.join(testCacheDir, 'react-next-template-1.0.0')
    };

    // Create actual cache files for testing
    await fs.ensureDir(testCacheEntry.path);
    await fs.writeFile(
      path.join(testCacheEntry.path, 'template.json'),
      JSON.stringify({ name: 'React Next Template', version: '1.0.0' })
    );
    await fs.writeFile(
      path.join(testCacheEntry.path, 'package.json'),
      JSON.stringify({ name: 'react-next-template', version: '1.0.0' })
    );

    // Mock cache service methods
    cacheService.getCacheEntry.mockResolvedValue(testCacheEntry);
    cacheService.deleteCacheEntry.mockResolvedValue(true);
    cacheService.invalidateCache.mockResolvedValue({
      invalidatedEntries: 1,
      remainingEntries: 2
    });
    cacheService.getCacheStats.mockResolvedValue({
      totalSize: 6656,
      totalEntries: 3,
      totalAccessCount: 16
    });
  });

  afterEach(async() => {
    await fs.remove(testCacheDir);
    jest.clearAllMocks();
  });

  describe('Success scenarios', () => {
    test('should return 200 status code for successful cache deletion', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect('Content-Type', /json/);

      // This test will fail initially because endpoint returns 404
      expect(response.status).toBe(200);
    });

    test('should return confirmation message with deleted entry details', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('successfully deleted');
      expect(response.body).toHaveProperty('deletedEntry');
      expect(response.body.deletedEntry).toHaveProperty('id', 'react-next-template@1.0.0');
      expect(response.body.deletedEntry).toHaveProperty('name', 'React Next Template');
      expect(response.body.deletedEntry).toHaveProperty('version', '1.0.0');
    });

    test('should include cache statistics after deletion', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('cacheStats');
      expect(response.body.cacheStats).toHaveProperty('totalSize');
      expect(response.body.cacheStats).toHaveProperty('totalEntries');
      expect(response.body.cacheStats).toHaveProperty('totalAccessCount');
      expect(response.body.cacheStats).toHaveProperty('lastUpdated');

      expect(typeof response.body.cacheStats.totalSize).toBe('number');
      expect(typeof response.body.cacheStats.totalEntries).toBe('number');
      expect(typeof response.body.cacheStats.totalAccessCount).toBe('number');
    });

    test('should remove cache files from filesystem', async() => {
      // Verify files exist before deletion
      expect(await fs.pathExists(testCacheEntry.path)).toBe(true);
      expect(await fs.pathExists(path.join(testCacheEntry.path, 'template.json'))).toBe(true);

      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      // Verify files are removed after deletion
      expect(await fs.pathExists(testCacheEntry.path)).toBe(false);
      expect(response.body).toHaveProperty('filesRemoved', true);
    });

    test('should handle cache invalidation properly', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('invalidation');
      expect(response.body.invalidation).toHaveProperty('invalidatedEntries', 1);
      expect(response.body.invalidation).toHaveProperty('remainingEntries', 2);
      expect(response.body.invalidation).toHaveProperty('status', 'completed');
    });

    test('should handle bulk deletion when requested', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .query({ bulk: true })
        .expect(200);

      expect(response.body).toHaveProperty('bulkOperation', true);
      expect(response.body).toHaveProperty('affectedEntries');
      expect(Array.isArray(response.body.affectedEntries)).toBe(true);
    });
  });

  describe('Error scenarios', () => {
    test('should return 404 status code for non-existent cache entry', async() => {
      cacheService.getCacheEntry.mockResolvedValue(null);

      const response = await request(app)
        .delete('/cache/non-existent-template@1.0.0')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not found');
    });

    test('should handle cache service errors gracefully', async() => {
      cacheService.deleteCacheEntry.mockRejectedValue(new Error('Cache service unavailable'));

      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Failed to delete cache entry');
    });

    test('should handle file system deletion errors', async() => {
      // Mock file system error
      const originalRemove = fs.remove;
      fs.remove = jest.fn().mockRejectedValue(new Error('Permission denied'));

      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Failed to remove cache files');

      // Restore original function
      fs.remove = originalRemove;
    });

    test('should handle invalid cache ID format', async() => {
      const response = await request(app)
        .delete('/cache/invalid-id-format')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid cache ID format');
    });

    test('should handle cache locked scenario', async() => {
      cacheService.deleteCacheEntry.mockRejectedValue(new Error('Cache entry is locked'));

      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Conflict');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Cache entry is locked');
    });

    test('should handle concurrent deletion attempts', async() => {
      // Simulate concurrent deletion by having the service reject
      cacheService.deleteCacheEntry.mockRejectedValueOnce(new Error('Already being deleted'));

      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Conflict');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already being deleted');
    });
  });

  describe('Response format validation', () => {
    test('should return proper JSON format', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      // Verify response is valid JSON
      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

      // Verify expected structure
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('deletedEntry');
      expect(response.body).toHaveProperty('cacheStats');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should include operation timestamp', async() => {
      const beforeRequest = new Date();

      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      const responseTime = new Date(response.body.timestamp);
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(responseTime.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    test('should include operation metadata', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('operation');
      expect(response.body.operation).toHaveProperty('type', 'delete');
      expect(response.body.operation).toHaveProperty('duration');
      expect(typeof response.body.operation.duration).toBe('number');
      expect(response.body.operation.duration).toBeGreaterThan(0);
    });
  });

  describe('Security and validation', () => {
    test('should validate cache ID parameter', async() => {
      const invalidIds = [
        'cache/../../../malicious-path',
        'cache/|rm -rf|',
        'cache/; DROP TABLE cache;',
        'cache/../../etc/passwd'
      ];

      for (const invalidId of invalidIds) {
        const response = await request(app)
          .delete(`/cache/${invalidId}`)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Bad Request');
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Invalid cache ID');
      }
    });

    test('should handle overly long cache IDs', async() => {
      const longId = 'a'.repeat(1000); // Very long ID

      const response = await request(app)
        .delete(`/cache/${longId}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Cache ID too long');
    });

    test('should sanitize cache ID properly', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      // Verify that the cache service was called with sanitized ID
      expect(cacheService.deleteCacheEntry).toHaveBeenCalledWith(
        expect.stringMatching(/^[\w\-@.]+$/)
      );
    });
  });

  describe('Performance and edge cases', () => {
    test('should handle large cache deletion efficiently', async() => {
      // Create a large cache entry
      const largeCacheEntry = {
        ...testCacheEntry,
        size: 1024 * 1024 * 100, // 100MB
        id: 'large-template@1.0.0'
      };

      cacheService.getCacheEntry.mockResolvedValue(largeCacheEntry);

      const startTime = Date.now();
      const response = await request(app)
        .delete('/cache/large-template@1.0.0')
        .expect(200);
      const endTime = Date.now();

      expect(response.body.deletedEntry.size).toBe(1024 * 1024 * 100);
      expect(response.body.operation.duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle cache deletion when cache is empty', async() => {
      cacheService.getCacheStats.mockResolvedValue({
        totalSize: 0,
        totalEntries: 0,
        totalAccessCount: 0
      });

      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      expect(response.body.cacheStats.totalEntries).toBe(0);
      expect(response.body.cacheStats.totalSize).toBe(0);
    });

    test('should handle deletion of currently accessed cache entry', async() => {
      // Mock scenario where cache entry is being accessed
      cacheService.deleteCacheEntry.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(true), 100); // Simulate delay
        });
      });

      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('warning');
      expect(response.body.warning).toContain('Cache entry was in use');
    });

    test('should log deletion operation for audit purposes', async() => {
      const response = await request(app)
        .delete('/cache/react-next-template@1.0.0')
        .expect(200);

      expect(response.body).toHaveProperty('auditLog');
      expect(response.body.auditLog).toHaveProperty('operationId');
      expect(response.body.auditLog).toHaveProperty('userId');
      expect(response.body.auditLog).toHaveProperty('timestamp');
      expect(response.body.auditLog).toHaveProperty('details');
    });
  });
});
