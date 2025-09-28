/**
 * Git Manager Service
 * Handles git-based template operations including cloning, branch/tag checkout,
 * repository validation, and authentication support. Features comprehensive error handling,
 * progress indicators, and security checks for git operations.
 *
 * @author XAGI Team
 * @version 1.0.0
 */

const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { validateGitUrl, validateFilePath } = require('../utils/validation');
// const chalk = require('chalk'); // Disabled for Jest compatibility
const ora = require('ora');
const tempy = require('tempy');

/**
 * Custom error classes for Git operations
 */
class GitError extends Error {
  constructor(message, operation, repository, cause) {
    super(message);
    this.name = 'GitError';
    this.operation = operation;
    this.repository = repository;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }
}

class AuthenticationError extends GitError {
  constructor(message, repository) {
    super(message, 'authentication', repository);
    this.name = 'AuthenticationError';
  }
}

class RepositoryNotFoundError extends GitError {
  constructor(message, repository) {
    super(message, 'repository_not_found', repository);
    this.name = 'RepositoryNotFoundError';
  }
}

class BranchNotFoundError extends GitError {
  constructor(message, repository, branch) {
    super(message, 'branch_not_found', repository);
    this.name = 'BranchNotFoundError';
    this.branch = branch;
  }
}

class TagNotFoundError extends GitError {
  constructor(message, repository, tag) {
    super(message, 'tag_not_found', repository);
    this.name = 'TagNotFoundError';
    this.tag = tag;
  }
}

/**
 * Git Manager Service Class
 */
class GitManager {
  constructor(options = {}) {
    this.options = {
      tempDir: options.tempDir || tempy.directory(),
      timeout: options.timeout || 300000, // 5 minutes default timeout
      retries: options.retries || 3,
      authMethod: options.authMethod || 'ssh', // 'ssh' or 'https'
      sshKeyPath: options.sshKeyPath,
      authToken: options.authToken,
      debug: options.debug || false,
      ...options
    };

    this.logger = this.createLogger();
  }

  /**
   * Create a logger instance
   * @private
   */
  createLogger() {
    return {
      info: (message) => {
        if (this.options.debug) {
          console.log('[GitManager]', message);
        }
      },
      warn: (message) => {
        if (this.options.debug) {
          console.log('[GitManager] WARN:', message);
        }
      },
      error: (message) => {
        console.error('[GitManager] ERROR:', message);
      },
      debug: (message) => {
        if (this.options.debug) {
          console.log('[GitManager] DEBUG:', message);
        }
      }
    };
  }

  /**
   * Create a configured git instance
   * @private
   */
  createGitInstance(repoPath = null) {
    const git = simpleGit(repoPath || this.options.tempDir);

    // Configure git environment
    if (this.options.authToken) {
      // Configure HTTP authentication
      git.env('GIT_ASKPASS', 'echo');
      git.env('GIT_TERMINAL_PROMPT', '0');

      if (this.options.authMethod === 'https') {
        git.env('GIT_USERNAME', 'token');
        git.env('GIT_PASSWORD', this.options.authToken);
      }
    }

    if (this.options.sshKeyPath && this.options.authMethod === 'ssh') {
      git.env('GIT_SSH_COMMAND', `ssh -i "${this.options.sshKeyPath}" -o StrictHostKeyChecking=no`);
    }

    return git;
  }

  /**
   * Clone a git repository
   * @param {string} url - Repository URL to clone
   * @param {Object} options - Cloning options
   * @returns {Promise<string>} Path to cloned repository
   */
  async cloneRepository(url, options = {}) {
    const spinner = ora(`Cloning repository from ${url}`).start();

    try {
      // Validate input
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'clone', url);
      }

      const cloneOptions = {
        ...options,
        targetDir: options.targetDir || tempy.directory(),
        branch: options.branch,
        depth: options.depth || 1, // Shallow clone by default
        filter: options.filter || 'tree:0', // Sparse checkout for faster cloning
        ...this.options
      };

      this.logger.info(`Cloning repository: ${url}`);
      this.logger.debug('Clone options:', cloneOptions);

      const git = this.createGitInstance();

      // Prepare clone arguments
      const cloneArgs = [];

      if (cloneOptions.branch) {
        cloneArgs.push('--branch', cloneOptions.branch);
      }

      if (cloneOptions.depth) {
        cloneArgs.push('--depth', cloneOptions.depth.toString());
      }

      if (cloneOptions.filter) {
        cloneArgs.push('--filter', cloneOptions.filter);
      }

      // Add single branch option if specified
      if (cloneOptions.singleBranch) {
        cloneArgs.push('--single-branch');
      }

      spinner.text = `Cloning ${url} to ${cloneOptions.targetDir}`;

      // Perform the clone
      await git.clone(url, cloneOptions.targetDir, cloneArgs);

      spinner.succeed(`Repository cloned successfully to ${cloneOptions.targetDir}`);

      this.logger.info(`Repository cloned to: ${cloneOptions.targetDir}`);

      return cloneOptions.targetDir;

    } catch (error) {
      spinner.fail(`Failed to clone repository: ${error.message}`);

      let gitError;
      if (error.message.includes('Authentication failed') || error.message.includes('Permission denied')) {
        gitError = new AuthenticationError(`Authentication failed for repository: ${url}`, url);
      } else if (error.message.includes('not found') || error.message.includes('does not exist')) {
        gitError = new RepositoryNotFoundError(`Repository not found: ${url}`, url);
      } else {
        gitError = new GitError(`Failed to clone repository: ${error.message}`, 'clone', url, error);
      }

      gitError.cause = error;
      throw gitError;
    }
  }

  /**
   * Checkout a specific branch
   * @param {string} repoPath - Path to repository
   * @param {string} branch - Branch name to checkout
   * @returns {Promise<void>}
   */
  async checkoutBranch(repoPath, branch) {
    const spinner = ora(`Checking out branch: ${branch}`).start();

    try {
      // Validate inputs
      const pathValidation = validateFilePath(repoPath);
      if (!pathValidation.isValid) {
        throw new GitError(`Invalid repository path: ${pathValidation.errors.join(', ')}`, 'checkout_branch', repoPath);
      }

      if (!branch || typeof branch !== 'string') {
        throw new GitError('Branch name is required and must be a string', 'checkout_branch', repoPath);
      }

      // Check if repository exists
      if (!await fs.pathExists(repoPath)) {
        throw new GitError(`Repository path does not exist: ${repoPath}`, 'checkout_branch', repoPath);
      }

      this.logger.info(`Checking out branch: ${branch} in ${repoPath}`);

      const git = this.createGitInstance(repoPath);

      // First, fetch latest changes
      spinner.text = 'Fetching latest changes...';
      await git.fetch();

      // Check if branch exists
      const branches = await git.branch();
      const branchExists = branches.all.some(b => b.includes(branch));

      if (!branchExists) {
        throw new BranchNotFoundError(`Branch '${branch}' not found`, repoPath, branch);
      }

      // Checkout the branch
      spinner.text = `Switching to branch: ${branch}`;
      await git.checkout(branch);

      // Pull latest changes for the branch
      spinner.text = `Pulling latest changes for branch: ${branch}`;
      await git.pull();

      spinner.succeed(`Successfully checked out branch: ${branch}`);

      this.logger.info(`Branch '${branch}' checked out successfully`);

    } catch (error) {
      spinner.fail(`Failed to checkout branch: ${error.message}`);

      if (error instanceof BranchNotFoundError) {
        throw error;
      }

      const gitError = new GitError(
        `Failed to checkout branch '${branch}': ${error.message}`,
        'checkout_branch',
        repoPath,
        error
      );
      throw gitError;
    }
  }

  /**
   * Checkout a specific tag
   * @param {string} repoPath - Path to repository
   * @param {string} tag - Tag name to checkout
   * @returns {Promise<void>}
   */
  async checkoutTag(repoPath, tag) {
    const spinner = ora(`Checking out tag: ${tag}`).start();

    try {
      // Validate inputs
      const pathValidation = validateFilePath(repoPath);
      if (!pathValidation.isValid) {
        throw new GitError(`Invalid repository path: ${pathValidation.errors.join(', ')}`, 'checkout_tag', repoPath);
      }

      if (!tag || typeof tag !== 'string') {
        throw new GitError('Tag name is required and must be a string', 'checkout_tag', repoPath);
      }

      // Check if repository exists
      if (!await fs.pathExists(repoPath)) {
        throw new GitError(`Repository path does not exist: ${repoPath}`, 'checkout_tag', repoPath);
      }

      this.logger.info(`Checking out tag: ${tag} in ${repoPath}`);

      const git = this.createGitInstance(repoPath);

      // Fetch all tags
      spinner.text = 'Fetching tags...';
      await git.fetch('--tags');

      // Check if tag exists
      const tags = await git.tags();
      const tagExists = tags.all.includes(tag);

      if (!tagExists) {
        throw new TagNotFoundError(`Tag '${tag}' not found`, repoPath, tag);
      }

      // Checkout the tag
      spinner.text = `Checking out tag: ${tag}`;
      await git.checkout([tag]);

      spinner.succeed(`Successfully checked out tag: ${tag}`);

      this.logger.info(`Tag '${tag}' checked out successfully`);

    } catch (error) {
      spinner.fail(`Failed to checkout tag: ${error.message}`);

      if (error instanceof TagNotFoundError) {
        throw error;
      }

      const gitError = new GitError(
        `Failed to checkout tag '${tag}': ${error.message}`,
        'checkout_tag',
        repoPath,
        error
      );
      throw gitError;
    }
  }

  /**
   * Get repository information
   * @param {string} url - Repository URL
   * @returns {Promise<Object>} Repository information
   */
  async getRepositoryInfo(url) {
    const spinner = ora(`Getting repository information for ${url}`).start();

    try {
      // Validate input
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'get_info', url);
      }

      this.logger.info(`Getting repository info for: ${url}`);

      // Create temporary directory for repository
      const tempDir = tempy.directory();

      try {
        // Clone with minimal depth to get basic info
        const git = this.createGitInstance();

        spinner.text = 'Cloning repository to get information...';
        await git.clone(url, tempDir, ['--depth', '1', '--filter', 'tree:0']);

        const repoGit = this.createGitInstance(tempDir);

        // Get basic repository info
        const [remotes, branches, tags, log] = await Promise.all([
          repoGit.getRemotes(true),
          repoGit.branch(),
          repoGit.tags(),
          repoGit.log(['--max-count', '1'])
        ]);

        const repoInfo = {
          url: url,
          name: this.extractRepoName(url),
          defaultBranch: branches.current,
          branches: branches.all,
          tags: tags.all,
          latestCommit: log.latest ? {
            hash: log.latest.hash,
            date: log.latest.date,
            message: log.latest.message,
            author: log.latest.author_name
          } : null,
          remote: remotes[0] || null,
          lastChecked: new Date().toISOString()
        };

        spinner.succeed('Repository information retrieved successfully');

        this.logger.info('Repository info retrieved:', { name: repoInfo.name, defaultBranch: repoInfo.defaultBranch });

        return repoInfo;

      } finally {
        // Clean up temporary directory
        await this.cleanupRepository(tempDir);
      }

    } catch (error) {
      spinner.fail(`Failed to get repository information: ${error.message}`);

      const gitError = new GitError(
        `Failed to get repository info: ${error.message}`,
        'get_info',
        url,
        error
      );
      throw gitError;
    }
  }

  /**
   * Validate repository accessibility
   * @param {string} url - Repository URL to validate
   * @returns {Promise<boolean>} True if repository is accessible
   */
  async validateRepository(url) {
    const spinner = ora(`Validating repository: ${url}`).start();

    try {
      // Validate input
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'validate', url);
      }

      this.logger.info(`Validating repository: ${url}`);

      const git = this.createGitInstance();

      // Try to list remote branches (lightweight validation)
      spinner.text = 'Checking repository accessibility...';
      const result = await git.listRemote(['--refs', url]);

      if (result && result.trim().length > 0) {
        spinner.succeed('Repository is accessible');
        this.logger.info('Repository validation successful');
        return true;
      }
      throw new GitError('Repository returned empty response', 'validate', url);


    } catch (error) {
      spinner.fail(`Repository validation failed: ${error.message}`);

      let gitError;
      if (error.message.includes('Authentication failed') || error.message.includes('Permission denied')) {
        gitError = new AuthenticationError(`Authentication failed for repository: ${url}`, url);
      } else if (error.message.includes('not found') || error.message.includes('does not exist')) {
        gitError = new RepositoryNotFoundError(`Repository not found: ${url}`, url);
      } else {
        gitError = new GitError(`Repository validation failed: ${error.message}`, 'validate', url, error);
      }

      gitError.cause = error;
      throw gitError;
    }
  }

  /**
   * Clean up temporary repository
   * @param {string} repoPath - Path to repository to clean up
   * @returns {Promise<void>}
   */
  async cleanupRepository(repoPath) {
    try {
      if (!repoPath) {
        this.logger.warn('No repository path provided for cleanup');
        return;
      }

      // Validate path is within safe directories
      const pathValidation = validateFilePath(repoPath);
      if (!pathValidation.isValid) {
        throw new GitError(`Invalid repository path for cleanup: ${pathValidation.errors.join(', ')}`, 'cleanup', repoPath);
      }

      // Security check: ensure we're not deleting system directories
      if (this.isUnsafePath(repoPath)) {
        throw new GitError(`Unsafe path for cleanup: ${repoPath}`, 'cleanup', repoPath);
      }

      this.logger.info(`Cleaning up repository: ${repoPath}`);

      if (await fs.pathExists(repoPath)) {
        await fs.remove(repoPath);
        this.logger.info(`Repository cleaned up: ${repoPath}`);
      }

    } catch (error) {
      const gitError = new GitError(
        `Failed to cleanup repository: ${error.message}`,
        'cleanup',
        repoPath,
        error
      );

      this.logger.error(`Cleanup failed: ${error.message}`);
      throw gitError;
    }
  }

  /**
   * Get available branches for a repository
   * @param {string} url - Repository URL
   * @returns {Promise<Array>} List of branch names
   */
  async getBranches(url) {
    const spinner = ora(`Getting branches for ${url}`).start();

    try {
      // Validate input
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'get_branches', url);
      }

      this.logger.info(`Getting branches for: ${url}`);

      const git = this.createGitInstance();

      // List remote branches
      spinner.text = 'Fetching remote branches...';
      const result = await git.listRemote(['--heads', url]);

      if (!result || result.trim().length === 0) {
        throw new GitError('No branches found', 'get_branches', url);
      }

      // Parse branch names from output
      const branches = result
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split('\t');
          return parts[1] ? parts[1].replace('refs/heads/', '') : null;
        })
        .filter(branch => branch);

      spinner.succeed(`Found ${branches.length} branches`);

      this.logger.info(`Retrieved ${branches.length} branches`);

      return branches;

    } catch (error) {
      spinner.fail(`Failed to get branches: ${error.message}`);

      const gitError = new GitError(
        `Failed to get branches: ${error.message}`,
        'get_branches',
        url,
        error
      );
      throw gitError;
    }
  }

  /**
   * Get available tags for a repository
   * @param {string} url - Repository URL
   * @returns {Promise<Array>} List of tag names
   */
  async getTags(url) {
    const spinner = ora(`Getting tags for ${url}`).start();

    try {
      // Validate input
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'get_tags', url);
      }

      this.logger.info(`Getting tags for: ${url}`);

      const git = this.createGitInstance();

      // List remote tags
      spinner.text = 'Fetching remote tags...';
      const result = await git.listRemote(['--tags', url]);

      if (!result || result.trim().length === 0) {
        // Return empty array instead of error - some repos may not have tags
        spinner.succeed('No tags found');
        this.logger.info('No tags found');
        return [];
      }

      // Parse tag names from output
      const tags = result
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split('\t');
          return parts[1] ? parts[1].replace('refs/tags/', '') : null;
        })
        .filter(tag => tag);

      spinner.succeed(`Found ${tags.length} tags`);

      this.logger.info(`Retrieved ${tags.length} tags`);

      return tags;

    } catch (error) {
      spinner.fail(`Failed to get tags: ${error.message}`);

      const gitError = new GitError(
        `Failed to get tags: ${error.message}`,
        'get_tags',
        url,
        error
      );
      throw gitError;
    }
  }

  /**
   * Extract repository name from URL
   * @private
   */
  extractRepoName(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const name = pathname.split('/').pop().replace('.git', '');
      return name || 'unknown';
    } catch {
      // Fallback for non-standard URLs
      const parts = url.split('/');
      const name = parts[parts.length - 1].replace('.git', '');
      return name || 'unknown';
    }
  }

  /**
   * Check if path is unsafe for cleanup
   * @private
   */
  isUnsafePath(repoPath) {
    if (!repoPath) {return true;}

    const normalizedPath = path.normalize(repoPath);

    // Check for system directories
    const unsafePatterns = [
      /^\/(usr|bin|sbin|etc|var|tmp|dev|proc|sys|root|home)/,
      /^\/Users\/[^\/]+$/,
      /^C:\\(Windows|Program Files|Program Files \(x86\)|System32)/,
      /^~\/$/,
      process.cwd()
    ];

    return unsafePatterns.some(pattern => pattern.test(normalizedPath));
  }

  /**
   * Configure authentication for git operations
   * @param {Object} authConfig - Authentication configuration
   */
  configureAuthentication(authConfig) {
    if (authConfig.token) {
      this.options.authToken = authConfig.token;
      this.options.authMethod = authConfig.method || 'https';
    }

    if (authConfig.sshKeyPath) {
      this.options.sshKeyPath = authConfig.sshKeyPath;
      this.options.authMethod = 'ssh';
    }

    this.logger.info('Authentication configured successfully');
  }

  /**
   * Set timeout for git operations
   * @param {number} timeout - Timeout in milliseconds
   */
  setTimeout(timeout) {
    this.options.timeout = timeout;
    this.logger.info(`Git timeout set to ${timeout}ms`);
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Debug mode enabled
   */
  setDebugMode(enabled) {
    this.options.debug = enabled;
    this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = {
  GitManager,
  GitError,
  AuthenticationError,
  RepositoryNotFoundError,
  BranchNotFoundError,
  TagNotFoundError
};
