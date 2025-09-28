/**
 * GitManager Unit Tests
 * Tests Git management functionality
 */

const GitManager = require('../../src/core/git-manager');
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('simple-git');
jest.mock('../../src/core/logger');

describe('GitManager', () => {
  let gitManager;
  let mockLogger;
  let mockSimpleGit;
  let testDir;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    testDir = '/test/project';
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock simple-git
    mockSimpleGit = {
      init: jest.fn(),
      add: jest.fn(),
      commit: jest.fn(),
      branch: jest.fn(),
      checkout: jest.fn(),
      status: jest.fn(),
      log: jest.fn(),
      remote: jest.fn(),
      push: jest.fn(),
      pull: jest.fn(),
      clone: jest.fn(),
      raw: jest.fn(),
      tags: jest.fn(),
      clean: jest.fn(),
      reset: jest.fn(),
      stash: jest.fn(),
      stashList: jest.fn(),
      stashPop: jest.fn(),
      diff: jest.fn(),
      show: jest.fn()
    };

    simpleGit.mockReturnValue(mockSimpleGit);

    // Mock fs operations
    fs.existsSync.mockReturnValue(true);
    fs.ensureDirSync.mockReturnValue();
    fs.writeFile.mockResolvedValue();
    fs.readFile.mockResolvedValue('git config content');

    // Create GitManager instance
    gitManager = new GitManager({
      logger: mockLogger,
      defaultBranch: 'main'
    });
  });

  describe('Constructor', () => {
    test('should create GitManager with default options', () => {
      const manager = new GitManager();

      expect(manager).toBeInstanceOf(GitManager);
      expect(manager.defaultBranch).toBe('main');
      expect(manager.logger).toBeDefined();
    });

    test('should create GitManager with custom options', () => {
      const options = {
        logger: mockLogger,
        defaultBranch: 'master',
        autoCommit: false,
        autoPush: false
      };

      const manager = new GitManager(options);

      expect(manager.logger).toBe(mockLogger);
      expect(manager.defaultBranch).toBe('master');
      expect(manager.autoCommit).toBe(false);
      expect(manager.autoPush).toBe(false);
    });
  });

  describe('initRepository', () => {
    test('should initialize Git repository successfully', async () => {
      mockSimpleGit.init.mockResolvedValue();

      const result = await gitManager.initRepository(testDir);

      expect(result.success).toBe(true);
      expect(simpleGit).toHaveBeenCalledWith(testDir);
      expect(mockSimpleGit.init).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Git repository initialized', expect.any(Object));
    });

    test('should handle initialization errors', async () => {
      mockSimpleGit.init.mockRejectedValue(new Error('Git init failed'));

      const result = await gitManager.initRepository(testDir);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Git init failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize Git repository', expect.any(Object));
    });

    test('should create .gitignore file when specified', async () => {
      const gitignoreContent = 'node_modules/\n.env\n';

      const result = await gitManager.initRepository(testDir, {
        gitignore: gitignoreContent
      });

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(testDir, '.gitignore'), gitignoreContent);
    });
  });

  describe('addRemote', () => {
    test('should add remote repository successfully', async () => {
      mockSimpleGit.remote.mockReturnValue({
        add: jest.fn().mockResolvedValue()
      });

      const result = await gitManager.addRemote(testDir, 'origin', 'https://github.com/test/repo.git');

      expect(result.success).toBe(true);
      expect(mockSimpleGit.remote().add).toHaveBeenCalledWith('origin', 'https://github.com/test/repo.git');
    });

    test('should handle invalid remote URL', async () => {
      const result = await gitManager.addRemote(testDir, 'origin', 'invalid-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid remote URL');
    });

    test('should handle remote addition errors', async () => {
      mockSimpleGit.remote.mockReturnValue({
        add: jest.fn().mockRejectedValue(new Error('Remote add failed'))
      });

      const result = await gitManager.addRemote(testDir, 'origin', 'https://github.com/test/repo.git');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Remote add failed');
    });
  });

  describe('commit', () => {
    test('should commit changes successfully', async () => {
      mockSimpleGit.add.mockResolvedValue();
      mockSimpleGit.commit.mockResolvedValue('commit hash');

      const result = await gitManager.commit(testDir, 'Initial commit', {
        files: ['*.js'],
        allowEmpty: true
      });

      expect(result.success).toBe(true);
      expect(mockSimpleGit.add).toHaveBeenCalledWith('*.js');
      expect(mockSimpleGit.commit).toHaveBeenCalledWith('Initial commit', expect.any(Object));
    });

    test('should handle commit with specific files', async () => {
      const files = ['src/index.js', 'package.json'];

      const result = await gitManager.commit(testDir, 'Add main files', { files });

      expect(result.success).toBe(true);
      expect(mockSimpleGit.add).toHaveBeenCalledWith(files);
    });

    test('should handle commit errors', async () => {
      mockSimpleGit.add.mockRejectedValue(new Error('Add failed'));

      const result = await gitManager.commit(testDir, 'Test commit');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Add failed');
    });

    test('should handle no changes to commit', async () => {
      mockSimpleGit.add.mockResolvedValue();
      mockSimpleGit.commit.mockResolvedValue(null);

      const result = await gitManager.commit(testDir, 'Test commit');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No changes to commit');
    });
  });

  describe('createBranch', () => {
    test('should create new branch successfully', async () => {
      mockSimpleGit.branch.mockReturnValue({
        local: jest.fn().mockResolvedValue([])
      });
      mockSimpleGit.checkout.mockReturnValue({
        branch: jest.fn().mockResolvedValue()
      });

      const result = await gitManager.createBranch(testDir, 'feature/test-feature');

      expect(result.success).toBe(true);
      expect(mockSimpleGit.checkout().branch).toHaveBeenCalledWith('feature/test-feature');
    });

    test('should handle branch creation from existing branch', async () => {
      mockSimpleGit.branch.mockReturnValue({
        local: jest.fn().mockResolvedValue(['main'])
      });
      mockSimpleGit.checkout.mockReturnValue({
        branch: jest.fn().mockResolvedValue()
      });

      const result = await gitManager.createBranch(testDir, 'feature/test-feature', 'main');

      expect(result.success).toBe(true);
      expect(mockSimpleGit.checkout().branch).toHaveBeenCalledWith('feature/test-feature');
    });

    test('should handle branch creation errors', async () => {
      mockSimpleGit.branch.mockReturnValue({
        local: jest.fn().mockRejectedValue(new Error('Branch error'))
      });

      const result = await gitManager.createBranch(testDir, 'feature/test-feature');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Branch error');
    });
  });

  describe('getStatus', () => {
    test('should get repository status successfully', async () => {
      const mockStatus = {
        current: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        staged: ['package.json'],
        modified: ['src/index.js'],
        not_added: ['new-file.txt'],
        deleted: ['old-file.js'],
        renamed: [],
        conflicted: []
      };

      mockSimpleGit.status.mockResolvedValue(mockStatus);

      const result = await gitManager.getStatus(testDir);

      expect(result.success).toBe(true);
      expect(result.status).toEqual(mockStatus);
      expect(mockSimpleGit.status).toHaveBeenCalled();
    });

    test('should handle status errors', async () => {
      mockSimpleGit.status.mockRejectedValue(new Error('Status command failed'));

      const result = await gitManager.getStatus(testDir);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Status command failed');
    });
  });

  describe('getLog', () => {
    test('should get commit history successfully', async () => {
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            date: '2023-01-01T00:00:00Z',
            message: 'Initial commit',
            author_name: 'Test Author',
            author_email: 'test@example.com'
          },
          {
            hash: 'def456',
            date: '2023-01-02T00:00:00Z',
            message: 'Add feature',
            author_name: 'Test Author',
            author_email: 'test@example.com'
          }
        ],
        total: 2
      };

      mockSimpleGit.log.mockResolvedValue(mockLog);

      const result = await gitManager.getLog(testDir, { limit: 10 });

      expect(result.success).toBe(true);
      expect(result.commits).toEqual(mockLog.all);
      expect(result.total).toBe(2);
    });

    test('should handle log with specific range', async () => {
      const result = await gitManager.getLog(testDir, { from: 'abc123', to: 'def456' });

      expect(result.success).toBe(true);
      expect(mockSimpleGit.log).toHaveBeenCalledWith(expect.objectContaining({
        from: 'abc123',
        to: 'def456'
      }));
    });

    test('should handle log errors', async () => {
      mockSimpleGit.log.mockRejectedValue(new Error('Log command failed'));

      const result = await gitManager.getLog(testDir);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Log command failed');
    });
  });

  describe('push', () => {
    test('should push changes successfully', async () => {
      mockSimpleGit.push.mockResolvedValue();

      const result = await gitManager.push(testDir, 'origin', 'main');

      expect(result.success).toBe(true);
      expect(mockSimpleGit.push).toHaveBeenCalledWith('origin', 'main');
    });

    test('should handle push with force option', async () => {
      const result = await gitManager.push(testDir, 'origin', 'main', { force: true });

      expect(result.success).toBe(true);
      expect(mockSimpleGit.push).toHaveBeenCalledWith('origin', 'main', { '--force': true });
    });

    test('should handle push errors', async () => {
      mockSimpleGit.push.mockRejectedValue(new Error('Push failed'));

      const result = await gitManager.push(testDir, 'origin', 'main');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Push failed');
    });
  });

  describe('pull', () => {
    test('should pull changes successfully', async () => {
      mockSimpleGit.pull.mockResolvedValue();

      const result = await gitManager.pull(testDir, 'origin', 'main');

      expect(result.success).toBe(true);
      expect(mockSimpleGit.pull).toHaveBeenCalledWith('origin', 'main');
    });

    test('should handle pull with rebase option', async () => {
      const result = await gitManager.pull(testDir, 'origin', 'main', { rebase: true });

      expect(result.success).toBe(true);
      expect(mockSimpleGit.pull).toHaveBeenCalledWith('origin', 'main', { '--rebase': true });
    });

    test('should handle pull errors', async () => {
      mockSimpleGit.pull.mockRejectedValue(new Error('Pull failed'));

      const result = await gitManager.pull(testDir, 'origin', 'main');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pull failed');
    });
  });

  describe('clone', () => {
    test('should clone repository successfully', async () => {
      mockSimpleGit.clone.mockResolvedValue();

      const result = await gitManager.clone('https://github.com/test/repo.git', testDir);

      expect(result.success).toBe(true);
      expect(mockSimpleGit.clone).toHaveBeenCalledWith('https://github.com/test/repo.git', testDir);
    });

    test('should handle clone with specific branch', async () => {
      const result = await gitManager.clone('https://github.com/test/repo.git', testDir, { branch: 'develop' });

      expect(result.success).toBe(true);
      expect(mockSimpleGit.clone).toHaveBeenCalledWith('https://github.com/test/repo.git', testDir, { '--branch': 'develop' });
    });

    test('should handle clone with depth option', async () => {
      const result = await gitManager.clone('https://github.com/test/repo.git', testDir, { depth: 1 });

      expect(result.success).toBe(true);
      expect(mockSimpleGit.clone).toHaveBeenCalledWith('https://github.com/test/repo.git', testDir, { '--depth': '1' });
    });

    test('should handle clone errors', async () => {
      mockSimpleGit.clone.mockRejectedValue(new Error('Clone failed'));

      const result = await gitManager.clone('https://github.com/test/repo.git', testDir);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clone failed');
    });
  });

  describe('isRepository', () => {
    test('should return true for Git repository', () => {
      fs.existsSync.mockReturnValue(true);

      const result = gitManager.isRepository(testDir);

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(path.join(testDir, '.git'));
    });

    test('should return false for non-Git directory', () => {
      fs.existsSync.mockReturnValue(false);

      const result = gitManager.isRepository(testDir);

      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    test('should get current branch successfully', async () => {
      mockSimpleGit.branch.mockReturnValue({
        current: 'feature/test-feature'
      });

      const result = await gitManager.getCurrentBranch(testDir);

      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature/test-feature');
    });

    test('should handle branch check errors', async () => {
      mockSimpleGit.branch.mockRejectedValue(new Error('Branch check failed'));

      const result = await gitManager.getCurrentBranch(testDir);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Branch check failed');
    });
  });

  describe('getRemotes', () => {
    test('should get remotes successfully', async () => {
      const mockRemotes = {
        all: [
          {
            name: 'origin',
            refs: {
              fetch: 'https://github.com/test/repo.git',
              push: 'https://github.com/test/repo.git'
            }
          }
        ]
      };

      mockSimpleGit.remote.mockReturnValue({
        getRemoteShow: jest.fn().mockResolvedValue(mockRemotes)
      });

      const result = await gitManager.getRemotes(testDir);

      expect(result.success).toBe(true);
      expect(result.remotes).toEqual(mockRemotes.all);
    });
  });

  describe('Utility Methods', () => {
    test('should validate Git URL format', () => {
      expect(gitManager._isValidGitUrl('https://github.com/test/repo.git')).toBe(true);
      expect(gitManager._isValidGitUrl('git@github.com:test/repo.git')).toBe(true);
      expect(gitManager._isValidGitUrl('invalid-url')).toBe(false);
    });

    test('should validate branch name', () => {
      expect(gitManager._isValidBranchName('feature/test-feature')).toBe(true);
      expect(gitManager._isValidBranchName('main')).toBe(true);
      expect(gitManager._isValidBranchName('invalid/branch/name')).toBe(false);
      expect(gitManager._isValidBranchName('')).toBe(false);
    });

    test('should format commit message', () => {
      const formatted = gitManager._formatCommitMessage('Test message', { scope: 'feat' });

      expect(formatted).toContain('feat');
      expect(formatted).toContain('Test message');
    });
  });
});