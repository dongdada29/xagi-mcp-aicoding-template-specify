/**
 * Git Manager Integration Tests
 * Tests for git-based template operations with real git operations
 */

const { GitManager, GitError, AuthenticationError, RepositoryNotFoundError } = require('../../src/core/git-manager');
const fs = require('fs-extra');
const path = require('path');

describe('GitManager Integration Tests', () => {
  let gitManager;
  const testRepos = {
    valid: 'https://github.com/octocat/Hello-World.git',
    invalid: 'https://github.com/nonexistent/repo.git'
  };

  beforeEach(() => {
    gitManager = new GitManager({
      debug: false,
      timeout: 30000
    });
  });

  describe('Repository Validation', () => {
    test('should validate valid git URLs', async() => {
      const { validateGitUrl } = require('../../src/utils/validation');

      const validUrls = [
        'https://github.com/user/repo.git',
        'git@github.com:user/repo.git',
        'https://gitlab.com/user/repo.git',
        'https://bitbucket.org/user/repo.git'
      ];

      for (const url of validUrls) {
        const result = validateGitUrl(url);
        expect(result.isValid).toBe(true);
      }
    });

    test('should reject invalid git URLs', async() => {
      const { validateGitUrl } = require('../../src/utils/validation');

      const invalidUrls = [
        'not-a-url',
        'ftp://github.com/user/repo.git',
        'http://github.com/user/repo.git',
        '',
        'https://github.com/' // missing user/repo
      ];

      for (const url of invalidUrls) {
        const result = validateGitUrl(url);
        expect(result.isValid).toBe(false);
      }
    });
  });

  describe('getRepositoryInfo', () => {
    test('should extract repository name from URL', () => {
      const urls = [
        { input: 'https://github.com/user/repo.git', expected: 'repo' },
        { input: 'git@github.com:user/repo.git', expected: 'repo' },
        { input: 'https://gitlab.com/user/my-repo.git', expected: 'my-repo' }
      ];

      urls.forEach(({ input, expected }) => {
        const result = gitManager.extractRepoName(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Security Checks', () => {
    test('should detect unsafe paths for cleanup', () => {
      const unsafePaths = [
        '/usr/bin',
        '/etc',
        '/var/log',
        '/tmp',
        '/root',
        '/Users/test',
        'C:\\Windows',
        process.cwd()
      ];

      const safePaths = [
        '/tmp/test-repo',
        '/tmp/git-clone-123',
        '/tmp/project-template'
      ];

      unsafePaths.forEach(path => {
        expect(gitManager.isUnsafePath(path)).toBe(true);
      });

      safePaths.forEach(path => {
        expect(gitManager.isUnsafePath(path)).toBe(false);
      });
    });
  });

  describe('Configuration', () => {
    test('should configure HTTPS authentication', () => {
      gitManager.configureAuthentication({
        token: 'test-token',
        method: 'https'
      });

      expect(gitManager.options.authToken).toBe('test-token');
      expect(gitManager.options.authMethod).toBe('https');
    });

    test('should configure SSH authentication', () => {
      gitManager.configureAuthentication({
        sshKeyPath: '/path/to/key'
      });

      expect(gitManager.options.sshKeyPath).toBe('/path/to/key');
      expect(gitManager.options.authMethod).toBe('ssh');
    });

    test('should set timeout', () => {
      gitManager.setTimeout(60000);
      expect(gitManager.options.timeout).toBe(60000);
    });

    test('should enable debug mode', () => {
      gitManager.setDebugMode(true);
      expect(gitManager.options.debug).toBe(true);
    });
  });

  describe('Error Classes', () => {
    test('GitError should have proper structure', () => {
      const error = new GitError('Test message', 'test-op', 'test-repo');

      expect(error.name).toBe('GitError');
      expect(error.message).toBe('Test message');
      expect(error.operation).toBe('test-op');
      expect(error.repository).toBe('test-repo');
      expect(error.timestamp).toBeDefined();
    });

    test('AuthenticationError should extend GitError', () => {
      const error = new AuthenticationError('Auth failed', 'test-repo');

      expect(error).toBeInstanceOf(GitError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.operation).toBe('authentication');
    });

    test('RepositoryNotFoundError should extend GitError', () => {
      const error = new RepositoryNotFoundError('Not found', 'test-repo');

      expect(error).toBeInstanceOf(GitError);
      expect(error.name).toBe('RepositoryNotFoundError');
      expect(error.operation).toBe('repository_not_found');
    });
  });

  describe('File Operations', () => {
    test('should handle file system operations', async() => {
      const tempDir = '/tmp/test-git-manager-' + Date.now();

      try {
        // Create test directory
        await fs.ensureDir(tempDir);
        expect(await fs.pathExists(tempDir)).toBe(true);

        // Test cleanup
        await gitManager.cleanupRepository(tempDir);
        expect(await fs.pathExists(tempDir)).toBe(false);
      } catch (error) {
        // Clean up on error
        if (await fs.pathExists(tempDir)) {
          await fs.remove(tempDir);
        }
        throw error;
      }
    });

    test('should handle cleanup of non-existent directory', async() => {
      const nonExistentDir = '/tmp/non-existent-' + Date.now();

      // Should not throw error
      await expect(gitManager.cleanupRepository(nonExistentDir)).resolves.not.toThrow();
    });
  });

  describe('Basic Git Operations (Mock)', () => {
    beforeEach(() => {
      // Mock simple-git for basic operations
      const mockGit = {
        clone: jest.fn().mockResolvedValue(),
        fetch: jest.fn().mockResolvedValue(),
        checkout: jest.fn().mockResolvedValue(),
        pull: jest.fn().mockResolvedValue(),
        branch: jest.fn().mockResolvedValue({
          current: 'main',
          all: ['main', 'develop']
        }),
        tags: jest.fn().mockResolvedValue({
          all: ['v1.0.0', 'v1.1.0']
        }),
        log: jest.fn().mockResolvedValue({
          latest: {
            hash: 'abc123',
            date: '2024-01-01',
            message: 'Initial commit',
            author_name: 'Test Author'
          }
        }),
        getRemotes: jest.fn().mockResolvedValue([
          { name: 'origin', refs: { fetch: 'https://github.com/test/repo.git' } }
        ]),
        listRemote: jest.fn().mockResolvedValue('abc123\trefs/heads/main')
      };

      // Replace simple-git constructor
      const simpleGit = require('simple-git');
      simpleGit.mockImplementation(() => mockGit);
    });

    test('should create git instance with authentication', () => {
      gitManager.configureAuthentication({
        token: 'test-token',
        method: 'https'
      });

      const git = gitManager.createGitInstance('/tmp/test');
      expect(git).toBeDefined();
    });

    test('should handle logger operations', () => {
      gitManager.setDebugMode(true);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      gitManager.logger.info('Test info');
      gitManager.logger.warn('Test warning');
      gitManager.logger.error('Test error');
      gitManager.logger.debug('Test debug');

      expect(consoleSpy).toHaveBeenCalledTimes(3); // info, warn, debug
      expect(errorSpy).toHaveBeenCalledTimes(1); // error

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});

// Skip tests that require network access unless explicitly enabled
const runNetworkTests = process.env.RUN_NETWORK_TESTS === 'true';

describe.skipIf(!runNetworkTests)('GitManager Network Tests', () => {
  let gitManager;

  beforeEach(() => {
    gitManager = new GitManager({
      debug: true,
      timeout: 30000
    });
  });

  test('should validate real repository', async() => {
    const isValid = await gitManager.validateRepository('https://github.com/octocat/Hello-World.git');
    expect(isValid).toBe(true);
  }, 30000);

  test('should get branches from real repository', async() => {
    const branches = await gitManager.getBranches('https://github.com/octocat/Hello-World.git');
    expect(Array.isArray(branches)).toBe(true);
    expect(branches.length).toBeGreaterThan(0);
  }, 30000);

  test('should get tags from real repository', async() => {
    const tags = await gitManager.getTags('https://github.com/octocat/Hello-World.git');
    expect(Array.isArray(tags)).toBe(true);
  }, 30000);
});
