/**
 * Utility Functions Unit Tests
 * Tests utility functions across the application
 */

const validationUtils = require('../../src/utils/validation');
const environmentUtils = require('../../src/utils/environment');
const configUtils = require('../../src/utils/config');
const securityScanner = require('../../src/utils/securityScanner');
const integrityVerifier = require('../../src/utils/integrityVerifier');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('path');
jest.mock('crypto');
jest.mock('semver');
jest.mock('chalk');

describe('Utility Functions', () => {
  let mockFs;
  let mockPath;
  let mockCrypto;
  let mockSemver;
  let mockChalk;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock fs
    mockFs = {
      existsSync: jest.fn(),
      readFileSync: jest.fn(),
      writeFileSync: jest.fn(),
      ensureDirSync: jest.fn(),
      readdirSync: jest.fn(),
      statSync: jest.fn()
    };

    // Mock path
    mockPath = {
      join: jest.fn((...args) => args.join('/')),
      resolve: jest.fn((...args) => args.join('/')),
      basename: jest.fn((path) => path.split('/').pop()),
      dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
      extname: jest.fn((path) => {
        const match = path.match(/\.[^.]+$/);
        return match ? match[0] : '';
      }),
      normalize: jest.fn((path) => path.replace(/\\/g, '/'))
    };

    // Mock crypto
    mockCrypto = {
      createHash: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-hash'),
      randomUUID: jest.fn().mockReturnValue('mock-uuid'),
      createCipheriv: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      final: jest.fn().mockReturnValue('encrypted-data'),
      createDecipheriv: jest.fn().mockReturnThis(),
      randomBytes: jest.fn().mockReturnValue(Buffer.from('random-bytes'))
    };

    // Mock semver
    mockSemver = {
      valid: jest.fn(),
      validRange: jest.fn(),
      satisfies: jest.fn(),
      gt: jest.fn(),
      lt: jest.fn(),
      eq: jest.fn(),
      neq: jest.fn(),
      gte: jest.fn(),
      lte: jest.fn(),
      cmp: jest.fn(),
      diff: jest.fn(),
      parse: jest.fn(),
      clean: jest.fn()
    };

    // Mock chalk
    mockChalk = {
      green: jest.fn((text) => `green:${text}`),
      red: jest.fn((text) => `red:${text}`),
      yellow: jest.fn((text) => `yellow:${text}`),
      blue: jest.fn((text) => `blue:${text}`),
      cyan: jest.fn((text) => `cyan:${text}`),
      magenta: jest.fn((text) => `magenta:${text}`),
      gray: jest.fn((text) => `gray:${text}`),
      bold: jest.fn().mockReturnThis(),
      italic: jest.fn().mockReturnThis(),
      underline: jest.fn().mockReturnThis()
    };

    // Set up module mocks
    require('fs-extra').mockImplementation(() => mockFs);
    require('path').mockImplementation(() => mockPath);
    require('crypto').mockImplementation(() => mockCrypto);
    require('semver').mockImplementation(() => mockSemver);
    require('chalk').mockImplementation(() => mockChalk);
  });

  describe('Validation Utils', () => {
    describe('isValidTemplateId', () => {
      test('should validate valid template IDs', () => {
        const validIds = [
          '@xagi/react-template',
          'my-template',
          '@org/template-name',
          'template_v1.0.0'
        ];

        validIds.forEach(id => {
          expect(validationUtils.isValidTemplateId(id)).toBe(true);
        });
      });

      test('should reject invalid template IDs', () => {
        const invalidIds = [
          '',
          'invalid template',
          'template@1.0.0',
          'template/v1',
          '@invalid/template with spaces'
        ];

        invalidIds.forEach(id => {
          expect(validationUtils.isValidTemplateId(id)).toBe(false);
        });
      });
    });

    describe('isValidVersion', () => {
      test('should validate semantic versions', () => {
        mockSemver.valid.mockReturnValue('1.0.0');

        expect(validationUtils.isValidVersion('1.0.0')).toBe(true);
        expect(mockSemver.valid).toHaveBeenCalledWith('1.0.0');
      });

      test('should reject invalid versions', () => {
        mockSemver.valid.mockReturnValue(null);

        expect(validationUtils.isValidVersion('invalid-version')).toBe(false);
      });
    });

    describe('isValidUrl', () => {
      test('should validate valid URLs', () => {
        const validUrls = [
          'https://github.com/user/repo',
          'http://example.com',
          'https://registry.npmjs.org',
          'git@github.com:user/repo.git'
        ];

        validUrls.forEach(url => {
          expect(validationUtils.isValidUrl(url)).toBe(true);
        });
      });

      test('should reject invalid URLs', () => {
        const invalidUrls = [
          '',
          'not-a-url',
          'ftp://invalid-protocol',
          'https://',
          'javascript:alert(1)'
        ];

        invalidUrls.forEach(url => {
          expect(validationUtils.isValidUrl(url)).toBe(false);
        });
      });
    });

    describe('isValidProjectName', () => {
      test('should validate valid project names', () => {
        const validNames = [
          'my-project',
          'project123',
          'MyProject',
          'test_project'
        ];

        validNames.forEach(name => {
          expect(validationUtils.isValidProjectName(name)).toBe(true);
        });
      });

      test('should reject invalid project names', () => {
        const invalidNames = [
          '',
          '123project',
          'project with spaces',
          'project@name',
          'project/name',
          'project\\name',
          '.project',
          'project.',
          'con',
          'PRN',
          'AUX',
          'nul'
        ];

        invalidNames.forEach(name => {
          expect(validationUtils.isValidProjectName(name)).toBe(false);
        });
      });
    });

    describe('validateTemplateConfig', () => {
      test('should validate complete template configuration', () => {
        const config = {
          variables: {
            projectName: { type: 'string', required: true },
            port: { type: 'number', required: false }
          },
          dependencies: { react: '^18.0.0' },
          scripts: { start: 'node index.js' }
        };

        const result = validationUtils.validateTemplateConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      test('should detect missing required variables', () => {
        const config = {
          variables: {
            projectName: { type: 'string', required: true }
          }
        };

        const userConfig = {};

        const result = validationUtils.validateTemplateConfig(config, userConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('projectName');
      });

      test('should validate variable types', () => {
        const config = {
          variables: {
            port: { type: 'number', required: true }
          }
        };

        const userConfig = { port: 'not-a-number' };

        const result = validationUtils.validateTemplateConfig(config, userConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors[0].field).toBe('port');
      });
    });
  });

  describe('Environment Utils', () => {
    describe('getNodeVersion', () => {
      test('should return Node.js version', () => {
        process.version = 'v18.17.0';

        const version = environmentUtils.getNodeVersion();

        expect(version).toBe('18.17.0');
      });

      test('should handle missing version', () => {
        delete process.version;

        const version = environmentUtils.getNodeVersion();

        expect(version).toBe('0.0.0');
      });
    });

    describe('getNpmVersion', () => {
      test('should return npm version from environment', () => {
        process.env.npm_config_user_agent = 'npm/9.0.0 node/18.17.0';

        const version = environmentUtils.getNpmVersion();

        expect(version).toBe('9.0.0');
      });

      test('should handle missing npm version', () => {
        delete process.env.npm_config_user_agent;

        const version = environmentUtils.getNpmVersion();

        expect(version).toBe('0.0.0');
      });
    });

    describe('isGitAvailable', () => {
      test('should return true when git is available', () => {
        mockFs.existsSync.mockReturnValue(true);

        const available = environmentUtils.isGitAvailable();

        expect(available).toBe(true);
      });

      test('should return false when git is not available', () => {
        mockFs.existsSync.mockReturnValue(false);

        const available = environmentUtils.isGitAvailable();

        expect(available).toBe(false);
      });
    });

    describe('getSystemInfo', () => {
      test('should return comprehensive system information', () => {
        process.platform = 'darwin';
        process.arch = 'x64';
        process.version = 'v18.17.0';

        const info = environmentUtils.getSystemInfo();

        expect(info).toEqual(expect.objectContaining({
          platform: 'darwin',
          arch: 'x64',
          nodeVersion: '18.17.0',
          totalMemory: expect.any(Number),
          freeMemory: expect.any(Number),
          cpus: expect.any(Array)
        }));
      });
    });

    describe('checkEnvironment', () => {
      test('should check environment requirements', () => {
        mockSemver.satisfies.mockReturnValue(true);

        const requirements = {
          node: '>=18.0.0',
          npm: '>=8.0.0'
        };

        const result = environmentUtils.checkEnvironment(requirements);

        expect(result.passed).toBe(true);
        expect(result.node.satisfied).toBe(true);
        expect(result.npm.satisfied).toBe(true);
      });

      test('should detect environment issues', () => {
        mockSemver.satisfies.mockReturnValue(false);

        const requirements = {
          node: '>=20.0.0',
          npm: '>=10.0.0'
        };

        const result = environmentUtils.checkEnvironment(requirements);

        expect(result.passed).toBe(false);
        expect(result.node.satisfied).toBe(false);
        expect(result.npm.satisfied).toBe(false);
      });
    });
  });

  describe('Config Utils', () => {
    describe('loadConfig', () => {
      test('should load configuration from file', () => {
        const configData = { test: 'value' };
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readJSONSync.mockReturnValue(configData);

        const config = configUtils.loadConfig('/path/to/config.json');

        expect(config).toEqual(configData);
        expect(mockFs.readJSONSync).toHaveBeenCalledWith('/path/to/config.json');
      });

      test('should return default config when file doesn\'t exist', () => {
        mockFs.existsSync.mockReturnValue(false);

        const config = configUtils.loadConfig('/path/to/config.json');

        expect(config).toEqual({});
      });

      test('should handle config file read errors', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readJSONSync.mockImplementation(() => {
          throw new Error('Read error');
        });

        const config = configUtils.loadConfig('/path/to/config.json');

        expect(config).toEqual({});
      });
    });

    describe('saveConfig', () => {
      test('should save configuration to file', () => {
        const config = { test: 'value' };

        const result = configUtils.saveConfig('/path/to/config.json', config);

        expect(result).toBe(true);
        expect(mockFs.writeJSONSync).toHaveBeenCalledWith('/path/to/config.json', config, expect.any(Object));
      });

      test('should handle config file write errors', () => {
        mockFs.writeJSONSync.mockImplementation(() => {
          throw new Error('Write error');
        });

        const config = { test: 'value' };

        const result = configUtils.saveConfig('/path/to/config.json', config);

        expect(result).toBe(false);
      });
    });

    describe('mergeConfigs', () => {
      test('should merge configurations deeply', () => {
        const base = {
          test: 'value',
          nested: {
            a: 1,
            b: 2
          }
        };

        const override = {
          nested: {
            b: 3,
            c: 4
          },
          newField: 'new'
        };

        const merged = configUtils.mergeConfigs(base, override);

        expect(merged).toEqual({
          test: 'value',
          nested: {
            a: 1,
            b: 3,
            c: 4
          },
          newField: 'new'
        });
      });

      test('should handle empty configurations', () => {
        const merged = configUtils.mergeConfigs({}, {});

        expect(merged).toEqual({});
      });
    });

    describe('validateConfig', () => {
      test('should validate configuration against schema', () => {
        const schema = {
          type: 'object',
          properties: {
            test: { type: 'string' }
          },
          required: ['test']
        };

        const config = { test: 'value' };

        const result = configUtils.validateConfig(config, schema);

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      test('should detect configuration validation errors', () => {
        const schema = {
          type: 'object',
          properties: {
            test: { type: 'string' }
          },
          required: ['test']
        };

        const config = { wrong: 'value' };

        const result = configUtils.validateConfig(config, schema);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
      });
    });
  });

  describe('Security Scanner', () => {
    describe('scanFile', () => {
      test('should scan file for security issues', () => {
        const filePath = '/path/to/file.js';
        const content = 'const apiKey = "hardcoded-key";';

        mockFs.readFileSync.mockReturnValue(content);

        const result = securityScanner.scanFile(filePath);

        expect(result).toEqual(expect.objectContaining({
          filePath,
          issues: expect.any(Array)
        }));

        expect(result.issues.some(issue => issue.type === 'HARDCODED_SECRET')).toBe(true);
      });

      test('should handle file read errors', () => {
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('Read error');
        });

        const result = securityScanner.scanFile('/path/to/file.js');

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Read error');
      });
    });

    describe('scanDirectory', () => {
      test('should scan directory recursively', () => {
        mockFs.readdirSync.mockReturnValue(['file1.js', 'file2.js', 'subdir']);
        mockFs.statSync.mockImplementation((path) => ({
          isDirectory: () => path.endsWith('subdir')
        }));

        const result = securityScanner.scanDirectory('/path/to/dir');

        expect(result.scannedFiles).toBeGreaterThan(0);
        expect(result.issues).toEqual(expect.any(Array));
      });

      test('should handle directory access errors', () => {
        mockFs.readdirSync.mockImplementation(() => {
          throw new Error('Access denied');
        });

        const result = securityScanner.scanDirectory('/path/to/dir');

        expect(result.errors).toHaveLength(1);
      });
    });

    describe('validateDependency', () => {
      test('should validate secure dependency', () => {
        const dependency = 'react@^18.0.0';

        const result = securityScanner.validateDependency(dependency);

        expect(result.isValid).toBe(true);
        expect(result.issues).toEqual([]);
      });

      test('should detect vulnerable dependencies', () => {
        const dependency = 'deprecated-package@1.0.0';

        const result = securityScanner.validateDependency(dependency);

        expect(result.isValid).toBe(false);
        expect(result.issues).toHaveLength(1);
      });
    });

    describe('checkFilePermissions', () => {
      test('should check file permissions', () => {
        mockFs.statSync.mockReturnValue({
          mode: 0o644,
          isFile: () => true
        });

        const result = securityScanner.checkFilePermissions('/path/to/file.js');

        expect(result).toEqual(expect.objectContaining({
          filePath: '/path/to/file.js',
          permissions: expect.any(String),
          secure: expect.any(Boolean)
        }));
      });
    });
  });

  describe('Integrity Verifier', () => {
    describe('calculateHash', () => {
      test('should calculate file hash', () => {
        const filePath = '/path/to/file.js';
        const content = 'file content';

        mockFs.readFileSync.mockReturnValue(content);

        const hash = integrityVerifier.calculateHash(filePath);

        expect(hash).toBe('mock-hash');
        expect(mockFs.readFileSync).toHaveBeenCalledWith(filePath);
      });

      test('should handle file read errors', () => {
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('Read error');
        });

        const hash = integrityVerifier.calculateHash('/path/to/file.js');

        expect(hash).toBe('');
      });
    });

    describe('verifyChecksum', () => {
      test('should verify file checksum', () => {
        const filePath = '/path/to/file.js';
        const expectedHash = 'mock-hash';

        mockFs.readFileSync.mockReturnValue('file content');

        const result = integrityVerifier.verifyChecksum(filePath, expectedHash);

        expect(result).toBe(true);
      });

      test('should detect checksum mismatch', () => {
        const filePath = '/path/to/file.js';
        const expectedHash = 'different-hash';

        mockFs.readFileSync.mockReturnValue('file content');

        const result = integrityVerifier.verifyChecksum(filePath, expectedHash);

        expect(result).toBe(false);
      });
    });

    describe('verifyDirectoryIntegrity', () => {
      test('should verify directory integrity', () => {
        const manifest = {
          'file1.js': 'hash1',
          'file2.js': 'hash2'
        };

        mockFs.readdirSync.mockReturnValue(['file1.js', 'file2.js']);
        mockFs.readFileSync.mockImplementation((path) => {
          if (path.includes('file1.js')) return 'content1';
          if (path.includes('file2.js')) return 'content2';
          return '';
        });

        mockCrypto.createHash.mockImplementation(() => ({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockImplementation((algo) => {
            if (algo === 'sha256') return 'hash1';
            if (algo === 'sha256') return 'hash2';
            return 'mock-hash';
          })
        }));

        const result = integrityVerifier.verifyDirectoryIntegrity('/path/to/dir', manifest);

        expect(result).toEqual(expect.objectContaining({
          verified: expect.any(Boolean),
          files: expect.any(Array)
        }));
      });
    });

    describe('generateManifest', () => {
      test('should generate integrity manifest', () => {
        mockFs.readdirSync.mockReturnValue(['file1.js', 'file2.js']);
        mockFs.statSync.mockReturnValue({ isFile: () => true, size: 1024 });

        mockCrypto.createHash.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue('mock-hash')
        });

        const manifest = integrityVerifier.generateManifest('/path/to/dir');

        expect(manifest).toEqual(expect.objectContaining({
          'file1.js': 'mock-hash',
          'file2.js': 'mock-hash'
        }));
      });

      test('should handle directory scan errors', () => {
        mockFs.readdirSync.mockImplementation(() => {
          throw new Error('Scan error');
        });

        const manifest = integrityVerifier.generateManifest('/path/to/dir');

        expect(manifest).toEqual({});
      });
    });
  });

  describe('Utility Function Integration', () => {
    test('should work together for template validation', () => {
      const templateConfig = {
        variables: {
          projectName: { type: 'string', required: true }
        }
      };

      const userConfig = { projectName: 'test-project' };

      const validation = validationUtils.validateTemplateConfig(templateConfig, userConfig);
      const security = securityScanner.scanDirectory('/template/path');
      const integrity = integrityVerifier.generateManifest('/template/path');

      expect(validation.isValid).toBe(true);
      expect(security.scannedFiles).toBeGreaterThanOrEqual(0);
      expect(integrity).toEqual(expect.any(Object));
    });

    test('should handle complex configuration scenarios', () => {
      const baseConfig = configUtils.loadConfig('/base/config.json');
      const overrideConfig = { test: 'value' };
      const merged = configUtils.mergeConfigs(baseConfig, overrideConfig);

      expect(merged).toEqual(expect.objectContaining({
        test: 'value'
      }));
    });

    test('should provide comprehensive environment information', () => {
      const systemInfo = environmentUtils.getSystemInfo();
      const envCheck = environmentUtils.checkEnvironment({
        node: '>=18.0.0',
        npm: '>=8.0.0'
      });

      expect(systemInfo).toEqual(expect.objectContaining({
        nodeVersion: expect.any(String),
        platform: expect.any(String)
      }));

      expect(envCheck).toEqual(expect.objectContaining({
        passed: expect.any(Boolean),
        node: expect.any(Object)
      }));
    });
  });
});