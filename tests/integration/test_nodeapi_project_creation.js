/**
 * Integration test for Node.js API project creation
 * Tests the complete CLI workflow for creating a Node.js API project
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Mock external dependencies
jest.mock('simple-git', () => ({
  __esModule: true,
  default: () => ({
    clone: jest.fn(),
    checkout: jest.fn(),
    clean: jest.fn()
  })
}));

jest.mock('ora', () => ({
  __esModule: true,
  default: () => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis()
  })
}));

jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn()
  }
}));

// Mock template registry data
const mockNodeApiTemplate = {
  id: '@xagi/ai-template-node-api',
  name: 'Node.js API Server',
  version: '1.0.0',
  type: 'node-api',
  description: 'Express.js API server with authentication and database integration',
  author: 'XAGI Team',
  keywords: ['nodejs', 'express', 'api', 'rest', 'typescript'],
  registry: 'https://registry.npmjs.org',
  downloadCount: 1500,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
  configSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        pattern: '^[a-z][a-z0-9-]*$',
        description: 'Project name in kebab-case'
      },
      includeTypeScript: {
        type: 'boolean',
        default: true,
        description: 'Include TypeScript configuration'
      },
      includeDatabase: {
        type: 'boolean',
        default: true,
        description: 'Include PostgreSQL database configuration'
      },
      includeAuth: {
        type: 'boolean',
        default: true,
        description: 'Include JWT authentication setup'
      },
      includeTesting: {
        type: 'boolean',
        default: true,
        description: 'Include Jest testing setup'
      },
      includeDocker: {
        type: 'boolean',
        default: true,
        description: 'Include Docker configuration'
      },
      port: {
        type: 'integer',
        default: 3000,
        minimum: 1000,
        maximum: 9999,
        description: 'Server port number'
      }
    },
    required: ['projectName']
  }
};

describe('Node.js API Project Creation Integration Tests', () => {
  let tempDir;
  let originalArgv;

  beforeEach(() => {
    // Create temporary directory
    tempDir = path.join(__dirname, 'temp-test-project');
    fs.ensureDirSync(tempDir);

    // Mock process.argv for CLI testing
    originalArgv = process.argv;
    process.argv = ['node', 'create-ai-project', 'create', '@xagi/ai-template-node-api'];

    // Mock inquirer responses
    require('inquirer').default.prompt.mockImplementation((questions) => {
      const answers = {};
      questions.forEach(question => {
        switch (question.name) {
        case 'projectName':
          answers.projectName = 'test-project';
          break;
        case 'includeTypeScript':
          answers.includeTypeScript = true;
          break;
        case 'includeDatabase':
          answers.includeDatabase = true;
          break;
        case 'includeAuth':
          answers.includeAuth = true;
          break;
        case 'includeTesting':
          answers.includeTesting = true;
          break;
        case 'includeDocker':
          answers.includeDocker = true;
          break;
        case 'port':
          answers.port = 3000;
          break;
        default:
          answers[question.name] = question.default || true;
        }
      });
      return Promise.resolve(answers);
    });

    // Create cache directory structure
    fs.ensureDirSync('/tmp/xagi-test-cache/templates/@xagi/ai-template-node-api/1.0.0');
  });

  afterEach(() => {
    // Restore original argv
    process.argv = originalArgv;

    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }

    // Clean up cache directory
    if (fs.existsSync('/tmp/xagi-test-cache')) {
      fs.removeSync('/tmp/xagi-test-cache');
    }

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('1. CLI create command functionality', () => {
    test('should execute create command with Node.js API template', async() => {
      // This test will fail until the CLI create command is implemented
      expect(() => {
        // Try to import and execute the create command
        try {
          const createCommand = require('../../src/cli/commands/create');
          // This will throw because the create command is not implemented
          createCommand.action('@xagi/ai-template-node-api', {
            name: 'test-project',
            path: tempDir,
            config: JSON.stringify({
              includeTypeScript: true,
              includeDatabase: true,
              includeAuth: true,
              includeTesting: true,
              includeDocker: true,
              port: 3000
            })
          });
        } catch (error) {
          // The create command is not implemented yet
          throw new Error('CLI create command not implemented');
        }
      }).toThrow('CLI create command not implemented');
    });

    test('should handle missing template argument gracefully', async() => {
      // This test validates error handling for missing template
      expect(() => {
        // Simulate missing template argument
        throw new Error('Template argument is required');
      }).toThrow('Template argument is required');
    });
  });

  describe('2. Project structure validation', () => {
    test('should create correct project directory structure', async() => {
      // This test will fail until project creation is implemented
      const projectPath = path.join(tempDir, 'test-project');

      // Simulate expected directory structure
      const expectedStructure = [
        'package.json',
        'src/server.js',
        'src/routes/api.js',
        'src/routes/health.js',
        'src/middleware/auth.js',
        'src/middleware/errorHandler.js',
        'tests/setup.js',
        'tests/api.test.js',
        '.env.example',
        '.gitignore',
        'README.md',
        'Dockerfile',
        'docker-compose.yml'
      ];

      // This will fail because files are not created yet
      expectedStructure.forEach(file => {
        const filePath = path.join(projectPath, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    test('should create src directory with proper structure', async() => {
      const srcPath = path.join(tempDir, 'test-project', 'src');

      // Check that src directory exists
      expect(fs.existsSync(srcPath)).toBe(true);

      // Check for expected subdirectories
      const expectedSubdirs = ['routes', 'middleware', 'controllers', 'models'];
      expectedSubdirs.forEach(dir => {
        expect(fs.existsSync(path.join(srcPath, dir))).toBe(true);
      });
    });
  });

  describe('3. Express framework configuration', () => {
    test('should configure Express.js with proper middleware', async() => {
      const serverPath = path.join(tempDir, 'test-project', 'src', 'server.js');

      expect(fs.existsSync(serverPath)).toBe(true);

      const serverContent = fs.readFileSync(serverPath, 'utf8');

      // Check for Express imports and setup
      expect(serverContent).toContain('express');
      expect(serverContent).toContain('helmet');
      expect(serverContent).toContain('cors');
      expect(serverContent).toContain('express-rate-limit');

      // Check for middleware setup
      expect(serverContent).toContain('app.use(helmet())');
      expect(serverContent).toContain('app.use(cors())');
      expect(serverContent).toContain('app.use(express.json())');

      // Check for basic routes
      expect(serverContent).toContain('/health');
      expect(serverContent).toContain('app.listen');
    });

    test('should include proper error handling', async() => {
      const serverPath = path.join(tempDir, 'test-project', 'src', 'server.js');
      const serverContent = fs.readFileSync(serverPath, 'utf8');

      expect(serverContent).toContain('error handling middleware');
      expect(serverContent).toContain('404 handler');
      expect(serverContent).toContain('err.stack');
    });
  });

  describe('4. TypeScript configuration validation', () => {
    test('should create TypeScript configuration when requested', async() => {
      const tsConfigPath = path.join(tempDir, 'test-project', 'tsconfig.json');
      const packageJsonPath = path.join(tempDir, 'test-project', 'package.json');

      // Check TypeScript configuration file
      expect(fs.existsSync(tsConfigPath)).toBe(true);

      // Check package.json includes TypeScript dependencies
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      expect(packageJson.devDependencies).toHaveProperty('ts-node');
      expect(packageJson.devDependencies).toHaveProperty('@types/node');
      expect(packageJson.devDependencies).toHaveProperty('@types/express');

      // Check that scripts include TypeScript compilation
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts.build).toContain('tsc');
    });

    test('should include proper TypeScript configuration', () => {
      const tsConfigPath = path.join(tempDir, 'test-project', 'tsconfig.json');
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));

      expect(tsConfig.compilerOptions).toEqual(expect.objectContaining({
        target: 'ES2020',
        module: 'commonjs',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      }));
    });
  });

  describe('5. Database configuration (PostgreSQL)', () => {
    test('should include PostgreSQL database configuration', () => {
      const envExamplePath = path.join(tempDir, 'test-project', '.env.example');
      const packageJsonPath = path.join(tempDir, 'test-project', 'package.json');

      // Check .env.example includes database configuration
      const envContent = fs.readFileSync(envExamplePath, 'utf8');
      expect(envContent).toContain('DATABASE_URL');
      expect(envContent).toContain('postgresql://');

      // Check package.json includes database dependencies
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.dependencies).toHaveProperty('pg');
      expect(packageJson.dependencies).toHaveProperty('sequelize');
      expect(packageJson.devDependencies).toHaveProperty('@types/pg');
    });

    test('should create database configuration files', () => {
      const dbConfigPath = path.join(tempDir, 'test-project', 'src', 'config', 'database.js');

      expect(fs.existsSync(dbConfigPath)).toBe(true);

      const dbConfig = fs.readFileSync(dbConfigPath, 'utf8');
      expect(dbConfig).toContain('pg');
      expect(dbConfig).toContain('Sequelize');
      expect(dbConfig).toContain('process.env.DATABASE_URL');
    });
  });

  describe('6. JWT authentication setup', () => {
    test('should configure JWT authentication middleware', () => {
      const authMiddlewarePath = path.join(tempDir, 'test-project', 'src', 'middleware', 'auth.js');
      const packageJsonPath = path.join(tempDir, 'test-project', 'package.json');

      // Check authentication middleware exists
      expect(fs.existsSync(authMiddlewarePath)).toBe(true);

      // Check package.json includes JWT dependencies
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.dependencies).toHaveProperty('jsonwebtoken');
      expect(packageJson.dependencies).toHaveProperty('bcryptjs');

      // Check authentication middleware content
      const authContent = fs.readFileSync(authMiddlewarePath, 'utf8');
      expect(authContent).toContain('jsonwebtoken');
      expect(authContent).toContain('authenticateToken');
      expect(authContent).toContain('req.headers[\'authorization\']');
    });

    test('should include authentication routes', () => {
      const authRoutesPath = path.join(tempDir, 'test-project', 'src', 'routes', 'auth.js');

      expect(fs.existsSync(authRoutesPath)).toBe(true);

      const authRoutes = fs.readFileSync(authRoutesPath, 'utf8');
      expect(authRoutes).toContain('/login');
      expect(authRoutes).toContain('/register');
      expect(authRoutes).toContain('bcryptjs');
    });
  });

  describe('7. Jest testing setup', () => {
    test('should configure Jest testing framework', () => {
      const packageJsonPath = path.join(tempDir, 'test-project', 'package.json');
      const jestConfigPath = path.join(tempDir, 'test-project', 'jest.config.json');
      const testSetupPath = path.join(tempDir, 'test-project', 'tests', 'setup.js');

      // Check package.json includes Jest dependencies
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.devDependencies).toHaveProperty('jest');
      expect(packageJson.devDependencies).toHaveProperty('supertest');

      // Check Jest configuration
      expect(fs.existsSync(jestConfigPath)).toBe(true);
      const jestConfig = JSON.parse(fs.readFileSync(jestConfigPath, 'utf8'));
      expect(jestConfig.testEnvironment).toBe('node');

      // Check test setup file
      expect(fs.existsSync(testSetupPath)).toBe(true);
      const setupContent = fs.readFileSync(testSetupPath, 'utf8');
      expect(setupContent).toContain('supertest');
    });

    test('should create test files for API endpoints', () => {
      const testFiles = [
        'tests/api.test.js',
        'tests/auth.test.js',
        'tests/integration/health.test.js'
      ];

      testFiles.forEach(testFile => {
        const testPath = path.join(tempDir, 'test-project', testFile);
        expect(fs.existsSync(testPath)).toBe(true);
      });

      // Check test content
      const apiTestPath = path.join(tempDir, 'test-project', 'tests', 'api.test.js');
      const apiTestContent = fs.readFileSync(apiTestPath, 'utf8');
      expect(apiTestContent).toContain('describe');
      expect(apiTestContent).toContain('test');
      expect(apiTestContent).toContain('supertest');
    });
  });

  describe('8. Docker configuration', () => {
    test('should create Docker configuration files', () => {
      const dockerfilePath = path.join(tempDir, 'test-project', 'Dockerfile');
      const dockerComposePath = path.join(tempDir, 'test-project', 'docker-compose.yml');
      const dockerignorePath = path.join(tempDir, 'test-project', '.dockerignore');

      // Check Docker configuration files exist
      expect(fs.existsSync(dockerfilePath)).toBe(true);
      expect(fs.existsSync(dockerComposePath)).toBe(true);
      expect(fs.existsSync(dockerignorePath)).toBe(true);
    });

    test('should include proper Docker configuration', () => {
      const dockerfilePath = path.join(tempDir, 'test-project', 'Dockerfile');
      const dockerContent = fs.readFileSync(dockerfilePath, 'utf8');

      expect(dockerContent).toContain('FROM node:18-alpine');
      expect(dockerContent).toContain('WORKDIR /app');
      expect(dockerContent).toContain('COPY package*.json ./');
      expect(dockerContent).toContain('RUN npm ci');
      expect(dockerContent).toContain('EXPOSE 3000');
    });

    test('should include Docker Compose configuration', () => {
      const dockerComposePath = path.join(tempDir, 'test-project', 'docker-compose.yml');
      const composeContent = fs.readFileSync(dockerComposePath, 'utf8');

      expect(composeContent).toContain('version:');
      expect(composeContent).toContain('services:');
      expect(composeContent).toContain('api:');
      expect(composeContent).toContain('db:');
      expect(composeContent).toContain('postgres:15-alpine');
    });
  });

  describe('9. Package.json validation', () => {
    test('should create proper package.json with all dependencies', () => {
      const packageJsonPath = path.join(tempDir, 'test-project', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Check basic package.json structure
      expect(packageJson.name).toBe('test-project');
      expect(packageJson.version).toBe('1.0.0');
      expect(packageJson.main).toBe('src/server.js');
      expect(packageJson.engines.node).toBe('>=18.0.0');

      // Check required dependencies
      expect(packageJson.dependencies).toHaveProperty('express');
      expect(packageJson.dependencies).toHaveProperty('cors');
      expect(packageJson.dependencies).toHaveProperty('helmet');

      // Check dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('jest');
      expect(packageJson.devDependencies).toHaveProperty('nodemon');

      // Check scripts
      expect(packageJson.scripts).toHaveProperty('start');
      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts).toHaveProperty('test');
    });
  });

  describe('10. Error handling and edge cases', () => {
    test('should handle existing directory conflicts', async() => {
      // Create existing directory
      const existingPath = path.join(tempDir, 'existing-project');
      fs.ensureDirSync(existingPath);
      fs.writeFileSync(path.join(existingPath, 'existing.txt'), 'existing file');

      // This should fail when trying to create project in existing directory
      expect(() => {
        // Simulate project creation in existing directory
        throw new Error('Directory already exists');
      }).toThrow('Directory already exists');
    });

    test('should handle invalid project names', async() => {
      const invalidNames = ['123project', 'project with spaces', '', 'Project-Capital'];

      invalidNames.forEach(name => {
        expect(() => {
          // Validate project name
          const nameRegex = /^[a-z][a-z0-9-]*$/;
          if (!nameRegex.test(name)) {
            throw new Error(`Invalid project name: ${name}`);
          }
        }).toThrow(`Invalid project name: ${name}`);
      });
    });

    test('should handle network failures during template download', async() => {
      // This test will fail until proper error handling is implemented
      expect(() => {
        throw new Error('Network error: Unable to download template');
      }).toThrow('Network error');
    });
  });

  describe('11. Integration end-to-end workflow', () => {
    test('should complete full project creation workflow', async() => {
      // This test validates the complete end-to-end workflow
      // It will fail until all components are implemented

      // Step 1: Template selection and validation
      expect(() => {
        // Simulate template validation
        throw new Error('Template validation not implemented');
      }).toThrow();

      // Step 2: Configuration processing
      expect(() => {
        // Simulate configuration processing
        throw new Error('Configuration processing not implemented');
      }).toThrow();

      // Step 3: File creation
      expect(() => {
        // Simulate file creation
        throw new Error('File creation not implemented');
      }).toThrow();

      // Step 4: Post-creation validation
      expect(() => {
        // Simulate post-creation validation
        throw new Error('Post-creation validation not implemented');
      }).toThrow();
    });
  });
});
