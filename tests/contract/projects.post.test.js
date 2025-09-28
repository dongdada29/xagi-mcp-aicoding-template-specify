const request = require('supertest');
const fs = require('fs-extra');
const path = require('path');

// Import app/server instance (will be created later)
let app;

describe('POST /projects - Contract Tests', () => {
  const BASE_URL = '/projects';

  // Sample test data
  const validProjectRequest = {
    templateId: '@xagi/ai-template-react-next-app',
    templateVersion: '1.0.0',
    config: {
      projectName: 'test-project',
      projectPath: '/tmp/test-project',
      configValues: {
        framework: 'next',
        language: 'typescript',
        cssFramework: 'tailwind'
      }
    }
  };

  const invalidProjectRequest = {
    templateId: '@xagi/ai-template-react-next-app',
    config: {
      // Missing required projectName
      projectPath: '/tmp/test-project',
      configValues: {}
    }
  };

  const duplicatePathRequest = {
    templateId: '@xagi/ai-template-react-next-app',
    config: {
      projectName: 'test-project',
      projectPath: '/tmp/existing-project',
      configValues: {}
    }
  };

  beforeAll(() => {
    // Import the Express app (will be implemented later)
    // For now, this will cause the tests to fail as expected
    try {
      app = require('../../../src/api/server');
    } catch (error) {
      console.log('Server not implemented yet - tests will fail as expected');
    }
  });

  afterAll(async() => {
    // Clean up any test directories created
    const testDirs = ['/tmp/test-project', '/tmp/existing-project'];
    for (const dir of testDirs) {
      if (await fs.pathExists(dir)) {
        await fs.remove(dir);
      }
    }
  });

  describe('Successful Project Creation', () => {
    test('should return 200 status code for valid project creation', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const response = await request(app)
        .post(BASE_URL)
        .send(validProjectRequest)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('projectName', validProjectRequest.config.projectName);
      expect(response.body).toHaveProperty('projectPath', validProjectRequest.config.projectPath);
      expect(response.body).toHaveProperty('templateId', validProjectRequest.templateId);
      expect(response.body).toHaveProperty('status', 'created');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('lastModified');
    });

    test('should create project files in correct location', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const response = await request(app)
        .post(BASE_URL)
        .send(validProjectRequest)
        .expect(200);

      // Verify project directory was created
      const projectExists = await fs.pathExists(validProjectRequest.config.projectPath);
      expect(projectExists).toBe(true);

      // Verify expected files were created
      const packageJsonExists = await fs.pathExists(
        path.join(validProjectRequest.config.projectPath, 'package.json')
      );
      expect(packageJsonExists).toBe(true);

      // Verify response includes created files list
      expect(response.body).toHaveProperty('files');
      expect(Array.isArray(response.body.files)).toBe(true);
      expect(response.body.files.length).toBeGreaterThan(0);
    });

    test('should return complete project creation details', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const response = await request(app)
        .post(BASE_URL)
        .send(validProjectRequest)
        .expect(200);

      // Validate required fields according to OpenAPI spec
      expect(response.body).toMatchObject({
        id: expect.any(String),
        projectName: validProjectRequest.config.projectName,
        projectPath: validProjectRequest.config.projectPath,
        templateId: validProjectRequest.templateId,
        templateVersion: validProjectRequest.templateVersion,
        status: 'created',
        createdAt: expect.any(String),
        lastModified: expect.any(String),
        files: expect.any(Array)
      });

      // Validate timestamp format
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.lastModified)).toBeInstanceOf(Date);
    });
  });

  describe('Invalid Configuration Handling', () => {
    test('should return 400 status code for missing required fields', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const response = await request(app)
        .post(BASE_URL)
        .send(invalidProjectRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('projectName');
    });

    test('should return 400 status code for invalid template configuration', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const invalidConfigRequest = {
        templateId: '@xagi/ai-template-react-next-app',
        config: {
          projectName: 'test-project',
          projectPath: '/tmp/test-project',
          configValues: {
            // Invalid framework value
            framework: 'invalid-framework',
            language: 'typescript'
          }
        }
      };

      const response = await request(app)
        .post(BASE_URL)
        .send(invalidConfigRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('framework');
    });

    test('should return 400 for non-existent template', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const nonExistentTemplateRequest = {
        templateId: '@xagi/non-existent-template',
        config: {
          projectName: 'test-project',
          projectPath: '/tmp/test-project',
          configValues: {}
        }
      };

      const response = await request(app)
        .post(BASE_URL)
        .send(nonExistentTemplateRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('template');
    });
  });

  describe('Project Name and Path Validation', () => {
    test('should validate project name format', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const invalidNameRequest = {
        templateId: '@xagi/ai-template-react-next-app',
        config: {
          projectName: 'invalid project name with spaces', // Invalid characters
          projectPath: '/tmp/test-project',
          configValues: {}
        }
      };

      const response = await request(app)
        .post(BASE_URL)
        .send(invalidNameRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('projectName');
    });

    test('should validate project path format and permissions', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const invalidPathRequest = {
        templateId: '@xagi/ai-template-react-next-app',
        config: {
          projectName: 'test-project',
          projectPath: '/root/invalid-path', // Should not have permission
          configValues: {}
        }
      };

      const response = await request(app)
        .post(BASE_URL)
        .send(invalidPathRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('projectPath');
    });

    test('should return 409 for duplicate project path', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      // Create a directory first to simulate existing project
      await fs.ensureDir('/tmp/existing-project');
      await fs.writeFile(
        path.join('/tmp/existing-project', 'package.json'),
        JSON.stringify({ name: 'existing-project' })
      );

      const response = await request(app)
        .post(BASE_URL)
        .send(duplicatePathRequest)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('Template Configuration Validation', () => {
    test('should validate required template-specific config values', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const missingConfigRequest = {
        templateId: '@xagi/ai-template-react-next-app',
        config: {
          projectName: 'test-project',
          projectPath: '/tmp/test-project',
          configValues: {
            // Missing required config values for this template
          }
        }
      };

      const response = await request(app)
        .post(BASE_URL)
        .send(missingConfigRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('configValues');
    });

    test('should validate config value types and constraints', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const invalidTypeRequest = {
        templateId: '@xagi/ai-template-react-next-app',
        config: {
          projectName: 'test-project',
          projectPath: '/tmp/test-project',
          configValues: {
            framework: 123, // Should be string
            language: true // Should be string
          }
        }
      };

      const response = await request(app)
        .post(BASE_URL)
        .send(invalidTypeRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Dry Run Mode', () => {
    test('should validate configuration without creating files when dryRun=true', async() => {
      if (!app) {
        throw new Error('Server not implemented');
      }

      const dryRunRequest = {
        ...validProjectRequest,
        dryRun: true
      };

      const response = await request(app)
        .post(BASE_URL)
        .send(dryRunRequest)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'creating');
      expect(response.body).toHaveProperty('files');

      // Verify no files were actually created
      const projectExists = await fs.pathExists(validProjectRequest.config.projectPath);
      expect(projectExists).toBe(false);
    });
  });
});
