/**
 * Git Manager Service Tests
 * Tests for git-based template operations
 */

const { GitManager, GitError, AuthenticationError, RepositoryNotFoundError } = require('../../src/core/git-manager');
const fs = require('fs-extra');
const path = require('path');
const { simpleGit } = require('simple-git');

// Mock external dependencies
jest.mock('simple-git');
jest.mock('fs-extra');
jest.mock('ora');
jest.mock('tempy');
jest.mock('../../src/utils/validation');

describe('GitManager', () => {
  let gitManager;
  let mockOra;
  let mockTempy;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock ora
    mockOra = jest.fn().mockReturnValue({
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn(),
      fail: jest.fn(),
      text: ''
    });
    require('ora').mockImplementation(mockOra);

    // Setup mock tempy
    mockTempy = {
      directory: jest.fn().mockReturnValue('/tmp/test-repo')
    };
    require('tempy').mockReturnValue(mockTempy);

    // Setup mock fs
    fs.pathExists.mockResolvedValue(true);
    fs.remove.mockResolvedValue();

    // Setup mock simple-git
    const mockGit = {
      clone: jest.fn().mockResolvedValue(),
      fetch: jest.fn().mockResolvedValue(),
      checkout: jest.fn().mockResolvedValue(),
      pull: jest.fn().mockResolvedValue(),
      branch: jest.fn().mockResolvedValue({
        current: 'main',
        all: ['main', 'develop', 'feature/test']
      }),
      tags: jest.fn().mockResolvedValue({
        all: ['v1.0.0', 'v1.1.0', 'v2.0.0']
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
      listRemote: jest.fn().mockResolvedValue('abc123\trefs/heads/main\nabc124\trefs/heads/develop')
    };

    simpleGit.mockReturnValue(mockGit);

    // Setup validation mocks
    const validation = require('../../src/utils/validation');
    validation.validateGitUrl.mockReturnValue({ isValid: true });
    validation.validateFilePath.mockReturnValue({ isValid: true });

    // Create GitManager instance
    gitManager = new GitManager({
      debug: false,
      timeout: 5000
    });
  });

  describe('Constructor', () => {
    test('should create GitManager with default options', () => {
      const manager = new GitManager();
      expect(manager.options.timeout).toBe(300000);
      expect(manager.options.retries).toBe(3);
      expect(manager.options.authMethod).toBe('ssh');
    });

    test('should create GitManager with custom options', () => {
      const manager = new GitManager({
        timeout: 10000,
        retries: 5,
        debug: true
      });
      expect(manager.options.timeout).toBe(10000);
      expect(manager.options.retries).toBe(5);
      expect(manager.options.debug).toBe(true);
    });
  });

  describe('cloneRepository', () => {
    test('should clone repository successfully', async() => {
      const url = 'https://github.com/test/repo.git';
      const result = await gitManager.cloneRepository(url);

      expect(result).toBe('/tmp/test-repo');
      expect(simpleGit().clone).toHaveBeenCalledWith(
        url,
        '/tmp/test-repo',
        expect.arrayContaining(['--depth', '1', '--filter', 'tree:0'])
      );
      expect(mockOra().succeed).toHaveBeenCalled();
    });

    test('should clone with custom options', async() => {
      const url = 'https://github.com/test/repo.git';
      const options = {
        branch: 'develop',
        depth: 5,
        singleBranch: true
      };

      await gitManager.cloneRepository(url, options);

      expect(simpleGit().clone).toHaveBeenCalledWith(
        url,
        '/tmp/test-repo',
        expect.arrayContaining(['--branch', 'develop', '--depth', '5', '--single-branch'])
      );
    });

    test('should handle authentication error', async() => {
      const url = 'https://github.com/test/repo.git';
      const error = new Error('Authentication failed');
      simpleGit().clone.mockRejectedValue(error);

      await expect(gitManager.cloneRepository(url)).rejects.toThrow(AuthenticationError);
      expect(mockOra().fail).toHaveBeenCalled();
    });

    test('should handle repository not found error', async() => {
      const url = 'https://github.com/test/repo.git';
      const error = new Error('Repository not found');
      simpleGit().clone.mockRejectedValue(error);

      await expect(gitManager.cloneRepository(url)).rejects.toThrow(RepositoryNotFoundError);
      expect(mockOra().fail).toHaveBeenCalled();
    });

    test('should validate URL before cloning', async() => {
      const url = 'invalid-url';
      const validation = require('../../src/utils/validation');
      validation.validateGitUrl.mockReturnValue({ isValid: false, errors: ['Invalid URL'] });

      await expect(gitManager.cloneRepository(url)).rejects.toThrow(GitError);
    });
  });

  describe('checkoutBranch', () => {
    test('should checkout branch successfully', async() => {
      const repoPath = '/tmp/test-repo';
      const branch = 'develop';

      await gitManager.checkoutBranch(repoPath, branch);

      expect(simpleGit(repoPath).fetch).toHaveBeenCalled();
      expect(simpleGit(repoPath).checkout).toHaveBeenCalledWith(branch);
      expect(simpleGit(repoPath).pull).toHaveBeenCalled();
      expect(mockOra().succeed).toHaveBeenCalled();
    });

    test('should handle branch not found error', async() => {
      const repoPath = '/tmp/test-repo';
      const branch = 'non-existent';

      // Mock branch listing without the target branch
      simpleGit(repoPath).branch.mockResolvedValue({
        current: 'main',
        all: ['main', 'develop']
      });

      await expect(gitManager.checkoutBranch(repoPath, branch)).rejects.toThrow('BranchNotFoundError');
      expect(mockOra().fail).toHaveBeenCalled();
    });

    test('should validate inputs', async() => {
      const validation = require('../../src/utils/validation');
      validation.validateFilePath.mockReturnValue({ isValid: false, errors: ['Invalid path'] });

      await expect(gitManager.checkoutBranch('/invalid/path', 'main')).rejects.toThrow(GitError);
    });

    test('should handle repository path not existing', async() => {
      fs.pathExists.mockResolvedValue(false);

      await expect(gitManager.checkoutBranch('/non/existent', 'main')).rejects.toThrow(GitError);
    });
  });

  describe('checkoutTag', () => {
    test('should checkout tag successfully', async() => {
      const repoPath = '/tmp/test-repo';
      const tag = 'v1.0.0';

      await gitManager.checkoutTag(repoPath, tag);

      expect(simpleGit(repoPath).fetch).toHaveBeenCalledWith('--tags');
      expect(simpleGit(repoPath).checkout).toHaveBeenCalledWith([tag]);
      expect(mockOra().succeed).toHaveBeenCalled();
    });

    test('should handle tag not found error', async() => {
      const repoPath = '/tmp/test-repo';
      const tag = 'v999.0.0';

      // Mock tag listing without the target tag
      simpleGit(repoPath).tags.mockResolvedValue({
        all: ['v1.0.0', 'v2.0.0']
      });

      await expect(gitManager.checkoutTag(repoPath, tag)).rejects.toThrow('TagNotFoundError');
      expect(mockOra().fail).toHaveBeenCalled();
    });
  });

  describe('getRepositoryInfo', () => {
    test('should get repository info successfully', async() => {
      const url = 'https://github.com/test/repo.git';
      const info = await gitManager.getRepositoryInfo(url);

      expect(info.url).toBe(url);
      expect(info.name).toBe('repo');
      expect(info.defaultBranch).toBe('main');
      expect(info.branches).toEqual(['main', 'develop', 'feature/test']);
      expect(info.tags).toEqual(['v1.0.0', 'v1.1.0', 'v2.0.0']);
      expect(info.latestCommit).toBeDefined();
      expect(mockOra().succeed).toHaveBeenCalled();
    });

    test('should cleanup temporary directory', async() => {
      const url = 'https://github.com/test/repo.git';
      await gitManager.getRepositoryInfo(url);

      expect(fs.remove).toHaveBeenCalledWith('/tmp/test-repo');
    });

    test('should handle cleanup errors gracefully', async() => {
      const url = 'https://github.com/test/repo.git';
      fs.remove.mockRejectedValue(new Error('Cleanup failed'));

      // Should still succeed even if cleanup fails
      const info = await gitManager.getRepositoryInfo(url);
      expect(info.url).toBe(url);
    });
  });

  describe('validateRepository', () => {
    test('should validate accessible repository', async() => {
      const url = 'https://github.com/test/repo.git';
      const isValid = await gitManager.validateRepository(url);

      expect(isValid).toBe(true);
      expect(simpleGit().listRemote).toHaveBeenCalledWith(['--refs', url]);
      expect(mockOra().succeed).toHaveBeenCalled();
    });

    test('should handle invalid repository', async() => {
      const url = 'https://github.com/nonexistent/repo.git';
      simpleGit().listRemote.mockResolvedValue('');

      await expect(gitManager.validateRepository(url)).rejects.toThrow(GitError);
      expect(mockOra().fail).toHaveBeenCalled();
    });
  });

  describe('cleanupRepository', () => {
    test('should cleanup repository successfully', async() => {
      const repoPath = '/tmp/test-repo';
      await gitManager.cleanupRepository(repoPath);

      expect(fs.remove).toHaveBeenCalledWith(repoPath);
    });

    test('should handle non-existent repository', async() => {
      fs.pathExists.mockResolvedValue(false);
      const repoPath = '/tmp/non-existent';

      await gitManager.cleanupRepository(repoPath);

      expect(fs.remove).not.toHaveBeenCalled();
    });

    test('should reject unsafe paths', async() => {
      const unsafePath = '/usr/bin';
      const validation = require('../../src/utils/validation');
      validation.validateFilePath.mockReturnValue({ isValid: true }); // Pass validation
      validation.validateFilePath.mockReturnValueOnce({ isValid: false }); // Fail security check

      await expect(gitManager.cleanupRepository(unsafePath)).rejects.toThrow(GitError);
    });
  });

  describe('getBranches', () => {
    test('should get branches successfully', async() => {
      const url = 'https://github.com/test/repo.git';
      simpleGit().listRemote.mockResolvedValue('abc123\trefs/heads/main\nabc124\trefs/heads/develop');

      const branches = await gitManager.getBranches(url);

      expect(branches).toEqual(['main', 'develop']);
      expect(mockOra().succeed).toHaveBeenCalled();
    });

    test('should handle repository with no branches', async() => {
      const url = 'https://github.com/test/repo.git';
      simpleGit().listRemote.mockResolvedValue('');

      await expect(gitManager.getBranches(url)).rejects.toThrow('No branches found');
    });
  });

  describe('getTags', () => {
    test('should get tags successfully', async() => {
      const url = 'https://github.com/test/repo.git';
      simpleGit().listRemote.mockResolvedValue('abc123\trefs/tags/v1.0.0\nabc124\trefs/tags/v2.0.0');

      const tags = await gitManager.getTags(url);

      expect(tags).toEqual(['v1.0.0', 'v2.0.0']);
      expect(mockOra().succeed).toHaveBeenCalled();
    });

    test('should return empty array for repository with no tags', async() => {
      const url = 'https://github.com/test/repo.git';
      simpleGit().listRemote.mockResolvedValue('');

      const tags = await gitManager.getTags(url);

      expect(tags).toEqual([]);
      expect(mockOra().succeed).toHaveBeenCalledWith('No tags found');
    });
  });

  describe('Authentication', () => {
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

    test('should set git environment variables for authentication', () => {
      const manager = new GitManager({
        authToken: 'test-token',
        authMethod: 'https'
      });

      const git = manager.createGitInstance();
      expect(git.env).toHaveBeenCalledWith('GIT_ASKPASS', 'echo');
      expect(git.env).toHaveBeenCalledWith('GIT_TERMINAL_PROMPT', '0');
      expect(git.env).toHaveBeenCalledWith('GIT_USERNAME', 'token');
      expect(git.env).toHaveBeenCalledWith('GIT_PASSWORD', 'test-token');
    });
  });

  describe('Utility Methods', () => {
    test('should extract repository name from HTTPS URL', () => {
      const name = gitManager.extractRepoName('https://github.com/test/repo.git');
      expect(name).toBe('repo');
    });

    test('should extract repository name from SSH URL', () => {
      const name = gitManager.extractRepoName('git@github.com:test/repo.git');
      expect(name).toBe('repo');
    });

    test('should detect unsafe paths for cleanup', () => {
      expect(gitManager.isUnsafePath('/usr/bin')).toBe(true);
      expect(gitManager.isUnsafePath('/etc')).toBe(true);
      expect(gitManager.isUnsafePath('/tmp/safe-repo')).toBe(false);
    });

    test('should set timeout', () => {
      gitManager.setTimeout(10000);
      expect(gitManager.options.timeout).toBe(10000);
    });

    test('should set debug mode', () => {
      gitManager.setDebugMode(true);
      expect(gitManager.options.debug).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should wrap all errors in GitError', async() => {
      const url = 'https://github.com/test/repo.git';
      simpleGit().clone.mockRejectedValue(new Error('Network error'));

      const error = await gitManager.cloneRepository(url).catch(e => e);

      expect(error).toBeInstanceOf(GitError);
      expect(error.operation).toBe('clone');
      expect(error.repository).toBe(url);
      expect(error.cause).toBeDefined();
    });

    test('should provide detailed error information', async() => {
      const url = 'https://github.com/test/repo.git';
      simpleGit().clone.mockRejectedValue(new Error('Network error'));

      try {
        await gitManager.cloneRepository(url);
      } catch (error) {
        expect(error.name).toBe('GitError');
        expect(error.timestamp).toBeDefined();
        expect(error.message).toContain('Network error');
      }
    });
  });
});

describe('Git Error Classes', () => {
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
