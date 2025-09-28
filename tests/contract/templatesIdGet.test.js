const request = require('supertest');
let app;
let Template;

try {
  app = require('../../../src/app'); // This will fail initially - app doesn't exist
  Template = require('../../../src/models/Template'); // This will fail initially - model doesn't exist
} catch (error) {
  // Modules don't exist yet - tests will fail gracefully
}

describe('GET /templates/{id}', () => {
  const testTemplate = {
    id: '@xagi/react-next-template',
    name: 'React Next.js Template',
    version: '1.2.3',
    type: 'react-next',
    description: 'A modern React template with Next.js, TypeScript, and Tailwind CSS',
    author: 'XAGI Team',
    keywords: ['react', 'nextjs', 'typescript', 'tailwind'],
    registry: 'https://registry.npmjs.org',
    downloadCount: 15420,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-03-20T14:45:00Z'
  };

  const mockTemplateResponse = {
    id: '@xagi/react-next-template',
    name: 'React Next.js Template',
    version: '1.2.3',
    type: 'react-next',
    description: 'A modern React template with Next.js, TypeScript, and Tailwind CSS',
    author: 'XAGI Team',
    keywords: ['react', 'nextjs', 'typescript', 'tailwind'],
    registry: 'https://registry.npmjs.org',
    downloadCount: 15420,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-03-20T14:45:00Z'
  };

  beforeEach(async() => {
    // Clear any existing test data
    if (Template && Template.deleteMany) {
      await Template.deleteMany({});
    }
  });

  test('should return 200 status code for existing template', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    // This test will fail because the endpoint doesn't exist yet
    const response = await request(app)
      .get('/templates/@xagi/react-next-template');

    expect(response.status).toBe(200);
  });

  test('should return 404 status code for non-existent template', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    const response = await request(app)
      .get('/templates/non-existent-template-999');

    expect(response.status).toBe(404);
  });

  test('should return template details with all required fields', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    const response = await request(app)
      .get('/templates/@xagi/react-next-template');

    expect(response.status).toBe(200);

    // Verify all required fields are present
    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        version: expect.any(String),
        type: expect.any(String),
        description: expect.any(String)
      })
    );

    // Verify required fields are not empty
    expect(response.body.id).toBeTruthy();
    expect(response.body.name).toBeTruthy();
    expect(response.body.version).toBeTruthy();
    expect(response.body.type).toBeTruthy();
    expect(response.body.description).toBeTruthy();
  });

  test('should support specific template versions', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    const response = await request(app)
      .get('/templates/@xagi/react-next-template')
      .query({ version: '1.0.0' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: '@xagi/react-next-template',
        version: '1.0.0'
      })
    );
  });

  test('should return proper JSON format', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    const response = await request(app)
      .get('/templates/@xagi/react-next-template');

    expect(response.status).toBe(200);

    // Verify response is valid JSON
    expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();

    // Verify content type header
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  test('should return template with correct structure according to contract', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    const response = await request(app)
      .get('/templates/@xagi/react-next-template');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        version: expect.any(String),
        type: expect.oneOf(['react-next', 'node-api', 'vue-app', 'mcp-server']),
        description: expect.any(String),
        author: expect.any(String),
        keywords: expect.arrayOf(expect.any(String)),
        registry: expect.any(String),
        downloadCount: expect.any(Number),
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/),
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/)
      })
    );
  });

  test('should handle version parameter validation', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    // Test with invalid version format
    const response = await request(app)
      .get('/templates/@xagi/react-next-template')
      .query({ version: 'invalid-version-format' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        message: expect.any(String)
      })
    );
  });

  test('should handle missing template gracefully', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    const response = await request(app)
      .get('/templates/never-existed-template');

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        message: expect.stringContaining('not found')
      })
    );
  });

  test('should return 404 for template with invalid ID format', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    const response = await request(app)
      .get('/templates/invalid@template@name');

    expect(response.status).toBe(404);
  });

  test('should handle case-sensitive template IDs correctly', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    // Test case sensitivity - should treat IDs as case-insensitive for npm packages
    const response = await request(app)
      .get('/templates/@XAGI/REACT-NEXT-TEMPLATE');

    // Should either return 200 (if case-insensitive) or 404 (if case-sensitive)
    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/@xagi\/react-next-template/i)
        })
      );
    }
  });

  test('should include metadata for version queries', async() => {
    if (!app || !Template) {
      throw new Error('Server not implemented - missing app or Template model');
    }

    const response = await request(app)
      .get('/templates/@xagi/react-next-template')
      .query({ version: '1.2.3' });

    expect(response.status).toBe(200);

    // Should include version-specific metadata
    expect(response.body).toEqual(
      expect.objectContaining({
        id: '@xagi/react-next-template',
        version: '1.2.3',
        type: 'react-next'
      })
    );

    // Should return latest version metadata when no version specified
    const latestResponse = await request(app)
      .get('/templates/@xagi/react-next-template');

    expect(latestResponse.status).toBe(200);
    expect(latestResponse.body.version).toBeDefined();
    expect(latestResponse.body.version).not.toBe('');
  });
});
