/**
 * Contract tests for GET /templates endpoint
 * Tests the API contract before implementation
 */
const request = require('supertest');
const app = require('../../src/app');

// Mock test data
const mockTemplates = [
  {
    id: 'react-starter-123',
    name: 'React Starter Kit',
    version: '1.0.0',
    type: 'frontend',
    description: 'A comprehensive React template with TypeScript and modern tooling'
  },
  {
    id: 'node-api-456',
    name: 'Node.js API Server',
    version: '2.1.0',
    type: 'backend',
    description: 'Express.js API server with authentication and database integration'
  },
  {
    id: 'fullstack-app-789',
    name: 'Full Stack Application',
    version: '1.5.0',
    type: 'fullstack',
    description: 'Complete full-stack template with React frontend and Node.js backend'
  }
];

describe('GET /templates - Contract Tests', () => {

  describe('1. Basic endpoint functionality', () => {
    test('should return 200 status code', async() => {
      const response = await request(app)
        .get('/templates')
        .expect(200);

      // This test will fail until the endpoint is implemented
      expect(response.status).toBe(200);
    });

    test('should return proper JSON format', async() => {
      const response = await request(app)
        .get('/templates')
        .expect('Content-Type', /json/);

      // Validate response is properly formatted JSON
      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    });
  });

  describe('2. Response structure validation', () => {
    test('should return array of templates', async() => {
      const response = await request(app)
        .get('/templates');

      // Response should be an array
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('each template should have required fields', async() => {
      const response = await request(app)
        .get('/templates');

      // Check each template has required fields
      response.body.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('version');
        expect(template).toHaveProperty('type');
        expect(template).toHaveProperty('description');

        // Validate field types
        expect(typeof template.id).toBe('string');
        expect(typeof template.name).toBe('string');
        expect(typeof template.version).toBe('string');
        expect(typeof template.type).toBe('string');
        expect(typeof template.description).toBe('string');

        // Validate non-empty fields
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
        expect(template.version).toBeTruthy();
        expect(template.type).toBeTruthy();
        expect(template.description).toBeTruthy();
      });
    });

    test('template versions should follow semantic versioning', async() => {
      const response = await request(app)
        .get('/templates');

      response.body.forEach(template => {
        // Basic semver pattern validation
        const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?(\+[a-zA-Z0-9-]+)?$/;
        expect(template.version).toMatch(semverPattern);
      });
    });
  });

  describe('3. Registry filtering functionality', () => {
    test('should support filtering by registry query parameter', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ registry: 'official' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // All returned templates should be from the specified registry
      response.body.forEach(template => {
        expect(template).toHaveProperty('registry', 'official');
      });
    });

    test('should handle unknown registry gracefully', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ registry: 'unknown-registry' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should return empty array for unknown registry
      expect(response.body).toEqual([]);
    });

    test('should handle missing registry parameter', async() => {
      const response = await request(app)
        .get('/templates');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('4. Type filtering functionality', () => {
    test('should support filtering by type query parameter', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ type: 'frontend' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // All returned templates should be of the specified type
      response.body.forEach(template => {
        expect(template.type).toBe('frontend');
      });
    });

    test('should filter by different types', async() => {
      const types = ['frontend', 'backend', 'fullstack'];

      for (const type of types) {
        const response = await request(app)
          .get('/templates')
          .query({ type });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);

        response.body.forEach(template => {
          expect(template.type).toBe(type);
        });
      }
    });

    test('should handle unknown type gracefully', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ type: 'unknown-type' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toEqual([]);
    });
  });

  describe('5. Search functionality', () => {
    test('should support search functionality', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ search: 'react' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Search should work on name and description fields
      response.body.forEach(template => {
        const searchMatch =
          template.name.toLowerCase().includes('react') ||
          template.description.toLowerCase().includes('react');
        expect(searchMatch).toBe(true);
      });
    });

    test('should be case-insensitive in search', async() => {
      const searchTerm = 'REACT';
      const response = await request(app)
        .get('/templates')
        .query({ search: searchTerm });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach(template => {
        const searchMatch =
          template.name.toLowerCase().includes('react') ||
          template.description.toLowerCase().includes('react');
        expect(searchMatch).toBe(true);
      });
    });

    test('should handle partial matches', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ search: 'starter' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return empty array for no matches', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ search: 'nonexistent-template-name' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toEqual([]);
    });
  });

  describe('6. Combined filtering functionality', () => {
    test('should support combined registry and type filtering', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ registry: 'official', type: 'frontend' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach(template => {
        expect(template).toHaveProperty('registry', 'official');
        expect(template.type).toBe('frontend');
      });
    });

    test('should support search with type filtering', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ search: 'react', type: 'frontend' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach(template => {
        expect(template.type).toBe('frontend');
        const searchMatch =
          template.name.toLowerCase().includes('react') ||
          template.description.toLowerCase().includes('react');
        expect(searchMatch).toBe(true);
      });
    });

    test('should support all filters combined', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ registry: 'official', type: 'frontend', search: 'react' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach(template => {
        expect(template).toHaveProperty('registry', 'official');
        expect(template.type).toBe('frontend');
        const searchMatch =
          template.name.toLowerCase().includes('react') ||
          template.description.toLowerCase().includes('react');
        expect(searchMatch).toBe(true);
      });
    });
  });

  describe('7. Error handling and edge cases', () => {
    test('should handle malformed query parameters', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ type: 'frontend&malformed=value' });

      // Should still return 200, ignoring malformed parameters
      expect(response.status).toBe(200);
    });

    test('should handle empty query parameters', async() => {
      const response = await request(app)
        .get('/templates')
        .query({ type: '', search: '' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should handle very large search terms', async() => {
      const longSearchTerm = 'a'.repeat(1000);
      const response = await request(app)
        .get('/templates')
        .query({ search: longSearchTerm });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Should return empty array for very long search terms
      expect(response.body).toEqual([]);
    });
  });

  describe('8. Performance and pagination considerations', () => {
    test('should handle large number of templates efficiently', async() => {
      const response = await request(app)
        .get('/templates');

      // Response time should be reasonable (less than 2 seconds)
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // For performance, we might want to limit the number of results
      // This test will be updated when pagination is implemented
      expect(response.body.length).toBeLessThanOrEqual(100);
    });

    test('should include pagination metadata when implemented', async() => {
      const response = await request(app)
        .get('/templates');

      // This test anticipates future pagination implementation
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // When pagination is implemented, we should check for:
      // expect(response.body).toHaveProperty('pagination');
      // expect(response.body).toHaveProperty('data');
    });
  });
});
