const request = require('supertest');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');

// Mock cache service that doesn't exist yet
let cacheService;
try {
  cacheService = require('../../../src/services/cacheService');
  jest.mock('../../../src/services/cacheService', () => ({
    getCacheEntries: jest.fn(),
    getCacheStats: jest.fn(),
  }));
} catch (error) {
  // Create a mock service if the real one doesn't exist
  cacheService = {
    getCacheEntries: jest.fn(),
    getCacheStats: jest.fn(),
  };
}

// Create a minimal Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock GET /cache endpoint that will be implemented later
  app.get('/cache', (req, res) => {
    // This endpoint doesn't exist yet, so it should return 404
    res.status(404).json({ error: 'Endpoint not implemented' });
  });

  return app;
};

describe('GET /cache endpoint', () => {
  let app;
  let testCacheDir;

  beforeEach(async () => {
    app = createTestApp();
    testCacheDir = path.join('/tmp', `cache-test-${Date.now()}`);
    await fs.ensureDir(testCacheDir);

    // Set up test cache entries
    const mockCacheEntries = [
      {
        id: 'react-next-template@1.0.0',
        name: 'React Next Template',
        version: '1.0.0',
        size: 2048,
        accessCount: 5,
        lastAccessed: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
        path: path.join(testCacheDir, 'react-next-template-1.0.0')
      },
      {
        id: 'node-api-template@2.1.0',
        name: 'Node API Template',
        version: '2.1.0',
        size: 1536,
        accessCount: 3,
        lastAccessed: new Date(Date.now() - 3600000).toISOString(),
        cachedAt: new Date(Date.now() - 86400000).toISOString(),
        path: path.join(testCacheDir, 'node-api-template-2.1.0')
      },
      {
        id: 'vue-app-template@1.5.0',
        name: 'Vue App Template',
        version: '1.5.0',
        size: 3072,
        accessCount: 8,
        lastAccessed: new Date().toISOString(),
        cachedAt: new Date(Date.now() - 43200000).toISOString(),
        path: path.join(testCacheDir, 'vue-app-template-1.5.0')
      }
    ];

    cacheService.getCacheEntries.mockResolvedValue(mockCacheEntries);
    cacheService.getCacheStats.mockResolvedValue({
      totalSize: 6656,
      totalEntries: 3,
      totalAccessCount: 16
    });
  });

  afterEach(async () => {
    await fs.remove(testCacheDir);
    jest.clearAllMocks();
  });

  describe('Success scenarios', () => {
    test('should return 200 status code', async () => {
      const response = await request(app)
        .get('/cache')
        .expect('Content-Type', /json/);

      // This test will fail initially because endpoint returns 404
      expect(response.status).toBe(200);
    });

    test('should return array of cached templates', async () => {
      const response = await request(app)
        .get('/cache')
        .expect(200);

      expect(Array.isArray(response.body.cachedTemplates)).toBe(true);
      expect(response.body.cachedTemplates.length).toBeGreaterThan(0);

      // Verify each cached template has required fields
      response.body.cachedTemplates.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('version');
        expect(template).toHaveProperty('size');
        expect(template).toHaveProperty('accessCount');
        expect(template).toHaveProperty('lastAccessed');
        expect(template).toHaveProperty('cachedAt');
      });
    });

    test('should show cache metadata', async () => {
      const response = await request(app)
        .get('/cache')
        .expect(200);

      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('totalSize');
      expect(response.body.metadata).toHaveProperty('totalEntries');
      expect(response.body.metadata).toHaveProperty('totalAccessCount');
      expect(response.body.metadata).toHaveProperty('lastUpdated');

      expect(typeof response.body.metadata.totalSize).toBe('number');
      expect(typeof response.body.metadata.totalEntries).toBe('number');
      expect(typeof response.body.metadata.totalAccessCount).toBe('number');
      expect(response.body.metadata.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    test('should support filtering by template', async () => {
      const response = await request(app)
        .get('/cache?template=react-next')
        .expect(200);

      expect(Array.isArray(response.body.cachedTemplates)).toBe(true);

      // Verify filtered results only contain matching templates
      response.body.cachedTemplates.forEach(template => {
        expect(template.id.toLowerCase()).toContain('react-next');
        expect(template.name.toLowerCase()).toContain('react next');
      });
    });

    test('should support filtering by version', async () => {
      const response = await request(app)
        .get('/cache?version=1.0.0')
        .expect(200);

      expect(Array.isArray(response.body.cachedTemplates)).toBe(true);

      // Verify filtered results only contain matching versions
      response.body.cachedTemplates.forEach(template => {
        expect(template.version).toBe('1.0.0');
      });
    });

    test('should support sorting by different fields', async () => {
      const sortByFields = ['name', 'size', 'accessCount', 'lastAccessed'];

      for (const field of sortByFields) {
        const response = await request(app)
          .get(`/cache?sortBy=${field}`)
          .expect(200);

        expect(Array.isArray(response.body.cachedTemplates)).toBe(true);
        expect(response.body.cachedTemplates.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error scenarios', () => {
    test('should handle cache service errors gracefully', async () => {
      cacheService.getCacheEntries.mockRejectedValue(new Error('Cache service unavailable'));

      const response = await request(app)
        .get('/cache')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to retrieve cache entries');
    });

    test('should handle invalid filter parameters', async () => {
      const response = await request(app)
        .get('/cache?template=invalid<>template&version=invalid.version')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid filter parameters');
    });

    test('should handle invalid sort parameters', async () => {
      const response = await request(app)
        .get('/cache?sortBy=invalidField')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid sort field');
    });
  });

  describe('Response format validation', () => {
    test('should return proper JSON format', async () => {
      const response = await request(app)
        .get('/cache')
        .expect(200);

      // Verify response is valid JSON
      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

      // Verify expected structure
      expect(response.body).toHaveProperty('cachedTemplates');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body).toHaveProperty('filters');

      // Verify filters object contains applied filters
      expect(response.body.filters).toHaveProperty('applied');
      expect(Array.isArray(response.body.filters.applied)).toBe(true);
    });

    test('should include pagination information', async () => {
      const response = await request(app)
        .get('/cache?page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('totalItems');
      expect(response.body.pagination).toHaveProperty('totalPages');

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
  });

  describe('Performance and edge cases', () => {
    test('should handle empty cache', async () => {
      cacheService.getCacheEntries.mockResolvedValue([]);
      cacheService.getCacheStats.mockResolvedValue({
        totalSize: 0,
        totalEntries: 0,
        totalAccessCount: 0
      });

      const response = await request(app)
        .get('/cache')
        .expect(200);

      expect(response.body.cachedTemplates).toEqual([]);
      expect(response.body.metadata.totalEntries).toBe(0);
      expect(response.body.metadata.totalSize).toBe(0);
    });

    test('should handle large cache responses efficiently', async () => {
      // Mock 1000 cache entries
      const largeCacheEntries = Array.from({ length: 1000 }, (_, i) => ({
        id: `template-${i}@1.0.0`,
        name: `Template ${i}`,
        version: '1.0.0',
        size: 1024,
        accessCount: Math.floor(Math.random() * 100),
        lastAccessed: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
        path: path.join(testCacheDir, `template-${i}-1.0.0`)
      }));

      cacheService.getCacheEntries.mockResolvedValue(largeCacheEntries);
      cacheService.getCacheStats.mockResolvedValue({
        totalSize: 1024000,
        totalEntries: 1000,
        totalAccessCount: 50000
      });

      const response = await request(app)
        .get('/cache')
        .expect(200);

      expect(response.body.cachedTemplates.length).toBe(1000);
      expect(response.body.metadata.totalEntries).toBe(1000);
    });
  });
});