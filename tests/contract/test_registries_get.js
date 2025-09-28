const request = require('supertest');
const express = require('express');

// Create Express app for testing - without registries router (will cause 404)
const app = express();
app.use(express.json());
// Note: registries router is not implemented yet, so this will return 404

describe('GET /registries', () => {
  const mockRegistries = [
    {
      id: 'npm-registry',
      url: 'https://registry.npmjs.org',
      type: 'npm',
      status: 'active',
      name: 'NPM Registry',
      description: 'Official NPM package registry'
    },
    {
      id: 'github-packages',
      url: 'https://npm.pkg.github.com',
      type: 'github',
      status: 'active',
      name: 'GitHub Packages',
      description: 'GitHub package registry'
    },
    {
      id: 'private-registry',
      url: 'https://registry.company.com',
      type: 'private',
      status: 'inactive',
      name: 'Company Private Registry',
      description: 'Internal company registry'
    }
  ];

  beforeEach(() => {
    // Reset any mocks or setup before each test
    jest.clearAllMocks();
  });

  test('should return 200 status code', async() => {
    const response = await request(app)
      .get('/api/registries')
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
  });

  test('should return array of configured registries', async() => {
    const response = await request(app)
      .get('/api/registries')
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('should return registry metadata with url, type, and status', async() => {
    const response = await request(app)
      .get('/api/registries')
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    if (response.body.length > 0) {
      const registry = response.body[0];
      expect(registry).toHaveProperty('url');
      expect(registry).toHaveProperty('type');
      expect(registry).toHaveProperty('status');
      expect(typeof registry.url).toBe('string');
      expect(typeof registry.type).toBe('string');
      expect(typeof registry.status).toBe('string');
    }
  });

  test('should support filtering by registry type', async() => {
    const response = await request(app)
      .get('/api/registries?type=npm')
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // All returned registries should have type 'npm'
    response.body.forEach(registry => {
      expect(registry.type).toBe('npm');
    });
  });

  test('should return empty array when filtering by non-existent type', async() => {
    const response = await request(app)
      .get('/api/registries?type=nonexistent')
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(0);
  });

  test('should return proper JSON format with valid structure', async() => {
    const response = await request(app)
      .get('/api/registries')
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // Validate JSON structure
    response.body.forEach(registry => {
      expect(registry).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          url: expect.any(String),
          type: expect.any(String),
          status: expect.any(String)
        })
      );

      // Validate status values
      expect(['active', 'inactive', 'error']).toContain(registry.status);

      // Validate URL format
      expect(registry.url).toMatch(/^https?:\/\//);
    });
  });

  test('should handle invalid type parameter gracefully', async() => {
    const response = await request(app)
      .get('/api/registries?type=')
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('should be case-insensitive for type filtering', async() => {
    const response = await request(app)
      .get('/api/registries?type=NPM')
      .expect('Content-Type', /json/);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // Should return npm registries regardless of case
    response.body.forEach(registry => {
      expect(registry.type.toLowerCase()).toBe('npm');
    });
  });
});
