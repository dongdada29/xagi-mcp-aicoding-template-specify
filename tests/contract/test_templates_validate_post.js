const request = require('supertest');
const app = require('../../src/app');
const fs = require('fs-extra');
const path = require('path');

describe('POST /templates/validate', () => {
  // Valid template structure for testing
  const validTemplate = {
    name: '@xagi/ai-template-react-next-app',
    version: '1.0.0',
    description: 'React Next.js AI project template',
    type: 'react-next-app',
    author: 'XAGI Team',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'https://github.com/xagi/ai-template-react-next-app.git'
    },
    keywords: ['react', 'nextjs', 'ai', 'template'],
    engines: {
      node: '>=18.0.0',
      npm: '>=8.0.0'
    },
    files: ['src/', 'package.json', 'README.md'],
    main: 'src/index.js',
    scripts: {
      start: 'node src/index.js',
      dev: 'nodemon src/index.js',
      test: 'jest',
      build: 'npm run build'
    },
    dependencies: {
      react: '^18.0.0',
      'next': '^14.0.0'
    },
    devDependencies: {
      jest: '^29.0.0',
      nodemon: '^3.0.0'
    },
    xagi: {
      category: 'web-framework',
      framework: 'nextjs',
      language: 'javascript',
      features: ['ssr', 'api-routes', 'static-export'],
      compatibility: {
        node: '>=18.0.0',
        npm: '>=8.0.0'
      },
      setup: {
        commands: ['npm install', 'npm run dev'],
        estimatedTime: '5-10 minutes'
      }
    }
  };

  // Invalid templates for testing different validation scenarios
  const invalidTemplates = {
    wrongNaming: {
      name: 'invalid-template-name',
      version: '1.0.0',
      description: 'Template with invalid naming convention',
      type: 'react',
      author: 'Test Author'
    },
    missingRequiredFields: {
      name: '@xagi/ai-template-test',
      version: '1.0.0'
      // Missing description, type, author
    },
    invalidVersion: {
      name: '@xagi/ai-template-test',
      version: 'invalid-version',
      description: 'Template with invalid version',
      type: 'test',
      author: 'Test Author'
    },
    missingXagiMetadata: {
      name: '@xagi/ai-template-test',
      version: '1.0.0',
      description: 'Template missing xagi metadata',
      type: 'test',
      author: 'Test Author'
      // Missing xagi section
    },
    invalidEngines: {
      name: '@xagi/ai-template-test',
      version: '1.0.0',
      description: 'Template with invalid engines',
      type: 'test',
      author: 'Test Author',
      engines: {
        node: '>=16.0.0', // Below minimum requirement
        npm: '>=6.0.0'    // Below minimum requirement
      }
    }
  };

  const validTemplateStructure = {
    'package.json': JSON.stringify(validTemplate, null, 2),
    'src/index.js': '// Main entry point\nconsole.log("Hello World");',
    'src/components/App.js': '// React component\nexport default function App() { return <div>Hello</div>; }',
    'README.md': '# Template README\nThis is a sample template.',
    'templates/': {
      'base/': {
        'src/': {
          'index.js': '// Template base file'
        }
      }
    }
  };

  const invalidTemplateStructure = {
    'package.json': JSON.stringify(validTemplate, null, 2),
    // Missing required src/ directory
    'README.md': '# Template README\nThis is a sample template.'
  };

  beforeEach(async () => {
    // Clean up any test directories
    jest.clearAllMocks();
  });

  test('should return 200 status code for valid template', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: validTemplate,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: true,
        message: expect.any(String)
      })
    );
  });

  test('should return 400 status code for invalid template', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidTemplates.wrongNaming,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: expect.any(String),
        message: expect.any(String)
      })
    );
  });

  test('should validate template package structure', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: validTemplate,
        structure: invalidTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Structure Validation Error',
        message: expect.stringContaining('required')
      })
    );
  });

  test('should validate template naming convention (@xagi/ai-template-{type})', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidTemplates.wrongNaming,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Naming Convention Error',
        message: expect.stringContaining('@xagi/ai-template-')
      })
    );
  });

  test('should validate required metadata fields', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidTemplates.missingRequiredFields,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Missing Required Fields',
        message: expect.stringMatching(/description|type|author/)
      })
    );
  });

  test('should validate version format', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidTemplates.invalidVersion,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Version Validation Error',
        message: expect.stringContaining('semantic versioning')
      })
    );
  });

  test('should validate xagi metadata section', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidTemplates.missingXagiMetadata,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Missing XAGI Metadata',
        message: expect.stringContaining('xagi')
      })
    );
  });

  test('should validate engine requirements', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidTemplates.invalidEngines,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Engine Requirements Error',
        message: expect.stringContaining('node|npm')
      })
    );
  });

  test('should return detailed validation results for valid template', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: validTemplate,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: true,
        message: expect.stringContaining('valid'),
        validationDetails: expect.objectContaining({
          naming: expect.objectContaining({
            valid: true,
            message: expect.any(String)
          }),
          metadata: expect.objectContaining({
            valid: true,
            message: expect.any(String)
          }),
          structure: expect.objectContaining({
            valid: true,
            message: expect.any(String)
          }),
          engines: expect.objectContaining({
            valid: true,
            message: expect.any(String)
          })
        })
      })
    );
  });

  test('should return proper error messages for validation failures', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidTemplates.missingRequiredFields,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body.valid).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.message).toBeDefined();
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
  });

  test('should handle missing request body', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Missing Required Parameters',
        message: expect.stringContaining('template|structure')
      })
    );
  });

  test('should handle invalid JSON structure', async () => {
    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: 'invalid-json-instead-of-object',
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Invalid Input Format',
        message: expect.stringContaining('object')
      })
    );
  });

  test('should validate template type is supported', async () => {
    const unsupportedTypeTemplate = {
      ...validTemplate,
      name: '@xagi/ai-template-unsupported-type',
      type: 'unsupported-framework'
    };

    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: unsupportedTypeTemplate,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Unsupported Template Type',
        message: expect.stringContaining('unsupported-framework')
      })
    );
  });

  test('should validate repository URL format', async () => {
    const invalidRepoTemplate = {
      ...validTemplate,
      repository: {
        type: 'git',
        url: 'invalid-repo-url'
      }
    };

    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidRepoTemplate,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Repository URL Validation Error',
        message: expect.stringContaining('repository')
      })
    );
  });

  test('should validate files array contains required files', async () => {
    const invalidFilesTemplate = {
      ...validTemplate,
      files: ['optional-file.js'] // Missing required files
    };

    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: invalidFilesTemplate,
        structure: validTemplateStructure
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: false,
        error: 'Files Validation Error',
        message: expect.stringContaining('required')
      })
    );
  });

  test('should handle templates with complex nested structure', async () => {
    const complexStructure = {
      'package.json': JSON.stringify(validTemplate, null, 2),
      'src/': {
        'components/': {
          'App.js': '// React component',
          'Header.js': '// Header component'
        },
        'utils/': {
          'helpers.js': '// Utility functions'
        },
        'index.js': '// Main entry point'
      },
      'templates/': {
        'base/': {
          'src/': {
            'index.js': '// Template base'
          }
        },
        'advanced/': {
          'src/': {
            'index.js': '// Advanced template'
          }
        }
      },
      'README.md': '# Complex Template',
      'LICENSE': 'MIT License'
    };

    const response = await request(app)
      .post('/templates/validate')
      .send({
        template: validTemplate,
        structure: complexStructure
      });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
  });
});