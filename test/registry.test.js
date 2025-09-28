/**
 * Test suite for TemplateRegistry model
 */

const TemplateRegistry = require('../src/models/registry');

describe('TemplateRegistry', () => {
  describe('Constructor', () => {
    test('should create registry with required fields', () => {
      const registry = new TemplateRegistry({
        name: 'Test Registry',
        url: 'https://registry.example.com',
        type: 'public'
      });

      expect(registry.name).toBe('Test Registry');
      expect(registry.url).toBe('https://registry.example.com');
      expect(registry.type).toBe('public');
      expect(registry.status).toBe('active');
      expect(registry.authRequired).toBe(false);
      expect(registry.templateCount).toBe(0);
    });

    test('should generate ID if not provided', () => {
      const registry = new TemplateRegistry({
        name: 'Test Registry',
        url: 'https://registry.example.com',
        type: 'public'
      });

      expect(registry.id).toBeDefined();
      expect(typeof registry.id).toBe('string');
    });

    test('should throw error for invalid configuration', () => {
      expect(() => {
        new TemplateRegistry({
          name: 'Test Registry'
          // Missing required URL
        });
      }).toThrow('Registry URL is required');
    });
  });

  describe('Validation', () => {
    test('should validate URL format', () => {
      expect(() => {
        new TemplateRegistry({
          name: 'Test Registry',
          url: 'invalid-url',
          type: 'public'
        });
      }).toThrow('Invalid registry URL');
    });

    test('should validate registry type', () => {
      expect(() => {
        new TemplateRegistry({
          name: 'Test Registry',
          url: 'https://registry.example.com',
          type: 'invalid-type'
        });
      }).toThrow('Invalid registry type');
    });

    test('should validate status', () => {
      expect(() => {
        new TemplateRegistry({
          name: 'Test Registry',
          url: 'https://registry.example.com',
          type: 'public',
          status: 'invalid-status'
        });
      }).toThrow('Invalid status');
    });
  });

  describe('Methods', () => {
    let registry;

    beforeEach(() => {
      registry = new TemplateRegistry({
        name: 'Test Registry',
        url: 'https://registry.example.com',
        type: 'public'
      });
    });

    test('should serialize to JSON', () => {
      const json = registry.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('name', 'Test Registry');
      expect(json).toHaveProperty('url', 'https://registry.example.com');
      expect(json).toHaveProperty('type', 'public');
      expect(json).toHaveProperty('status', 'active');
    });

    test('should create from JSON', () => {
      const json = {
        name: 'Test Registry',
        url: 'https://registry.example.com',
        type: 'public',
        templateCount: 10,
        status: 'active'
      };

      const newRegistry = TemplateRegistry.fromJSON(json);
      expect(newRegistry.name).toBe('Test Registry');
      expect(newRegistry.templateCount).toBe(10);
    });

    test('should get registry info', () => {
      const info = registry.getInfo();

      expect(info).toHaveProperty('name', 'Test Registry');
      expect(info).toHaveProperty('type', 'public');
      expect(info).toHaveProperty('status', 'active');
      expect(info).toHaveProperty('templateCount', 0);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for local registry sync', () => {
      const registry = new TemplateRegistry({
        name: 'Local Registry',
        url: 'file:///local/templates',
        type: 'local'
      });

      expect(async () => {
        await registry.sync();
      }).toThrow('Local registries cannot be synchronized');
    });

    test('should throw error for authentication with invalid token', async () => {
      const registry = new TemplateRegistry({
        name: 'Private Registry',
        url: 'https://private.registry.com',
        type: 'private',
        authRequired: true
      });

      expect(async () => {
        await registry.authenticate(null);
      }).toThrow('Authentication token is required');
    });
  });
});