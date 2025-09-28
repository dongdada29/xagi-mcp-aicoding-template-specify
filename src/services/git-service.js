/**
 * Git Service
 *
 * High-level service for git repository operations related to template management.
 * Builds on GitManager to provide template-specific functionality including template
 * extraction, validation, downloading, and information retrieval.
 *
 * @author XAGI Team
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs-extra');
const { GitManager, RepositoryNotFoundError } = require('../core/git-manager');
const { validateGitUrl, validateFilePath } = require('../utils/validation');
const { validateTemplatePackage } = require('../utils/templateValidator');
// const chalk = require('chalk'); // Disabled for Jest compatibility
const ora = require('ora');
const glob = require('glob');
const yaml = require('yaml');

/**
 * Custom error classes for GitService operations
 */
class GitTemplateError extends Error {
  constructor(message, operation, repository, cause) {
    super(message);
    this.name = 'GitTemplateError';
    this.operation = operation;
    this.repository = repository;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }
}

class TemplateExtractionError extends GitTemplateError {
  constructor(message, repository, templatePath, cause) {
    super(message, 'template_extraction', repository, cause);
    this.name = 'TemplateExtractionError';
    this.templatePath = templatePath;
  }
}

class TemplateValidationError extends GitTemplateError {
  constructor(message, repository, validationErrors, cause) {
    super(message, 'template_validation', repository, cause);
    this.name = 'TemplateValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Git Service Class
 */
class GitService {
  constructor(options = {}) {
    this.gitManager = new GitManager(options.gitManager || {});
    this.options = {
      tempDir: options.tempDir || path.join(process.cwd(), 'temp', 'git-templates'),
      cacheDir: options.cacheDir || path.join(process.cwd(), 'cache', 'git-templates'),
      maxCacheAge: options.maxCacheAge || 24 * 60 * 60 * 1000, // 24 hours
      enableCache: options.enableCache !== false,
      templateValidation: options.templateValidation !== false,
      maxRepositorySize: options.maxRepositorySize || 100 * 1024 * 1024, // 100MB
      ...options
    };

    // Ensure directories exist
    fs.ensureDirSync(this.options.tempDir);
    if (this.options.enableCache) {
      fs.ensureDirSync(this.options.cacheDir);
    }

    this.cache = new Map();
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
          console.log('[GitService]', message);
        }
      },
      warn: (message) => {
        if (this.options.debug) {
          console.log('[GitService] WARN:', message);
        }
      },
      error: (message) => {
        console.error('[GitService] ERROR:', message);
      },
      debug: (message) => {
        if (this.options.debug) {
          console.log('[GitService] DEBUG:', message);
        }
      }
    };
  }

  /**
   * Get template from git repository
   * @param {string} url - Git repository URL
   * @param {Object} options - Template options
   * @returns {Promise<Object>} Template information and files
   */
  async getTemplateFromRepo(url, options = {}) {
    const spinner = ora(`Getting template from ${url}`).start();

    try {
      // Validate inputs
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitTemplateError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'get_template', url);
      }

      this.logger.info(`Getting template from repository: ${url}`);
      this.logger.debug('Template options:', options);

      // Check cache first
      const cacheKey = this.getCacheKey(url, options);
      if (this.options.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          spinner.succeed('Template retrieved from cache');
          this.logger.info('Template retrieved from cache');
          return cached;
        }
      }

      // Clone repository
      spinner.text = 'Cloning repository...';
      const repoPath = await this.gitManager.cloneRepository(url, {
        branch: options.branch,
        tag: options.tag,
        depth: options.depth || 1,
        ...options.gitOptions
      });

      try {
        // Extract template information
        spinner.text = 'Extracting template information...';
        const templateInfo = await this.extractTemplateInfo(repoPath, url, options);

        // Validate template
        if (this.options.templateValidation) {
          spinner.text = 'Validating template...';
          const validationResult = await this.validateGitTemplate(repoPath, templateInfo);
          if (!validationResult.isValid) {
            throw new TemplateValidationError(
              `Template validation failed: ${validationResult.errors.join(', ')}`,
              url,
              validationResult.errors
            );
          }
        }

        // Extract template files
        spinner.text = 'Extracting template files...';
        const templateFiles = await this.extractTemplateFiles(repoPath, options.templatePath || '.');

        // Prepare result
        const result = {
          template: templateInfo,
          files: templateFiles,
          repository: {
            url,
            path: repoPath,
            branch: options.branch,
            tag: options.tag,
            commit: templateInfo.commit
          },
          extractedAt: new Date().toISOString()
        };

        // Cache result
        if (this.options.enableCache) {
          this.setCache(cacheKey, result);
        }

        spinner.succeed('Template retrieved successfully');
        this.logger.info('Template retrieved successfully:', { name: templateInfo.name, version: templateInfo.version });

        return result;

      } finally {
        // Clean up repository
        if (!options.keepRepo) {
          await this.gitManager.cleanupRepository(repoPath);
        }
      }

    } catch (error) {
      spinner.fail(`Failed to get template: ${error.message}`);

      if (error instanceof GitTemplateError) {
        throw error;
      }

      const gitError = new GitTemplateError(
        `Failed to get template from repository: ${error.message}`,
        'get_template',
        url,
        error
      );
      throw gitError;
    }
  }

  /**
   * Validate git-based template
   * @param {string} url - Git repository URL
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateGitTemplate(url, options = {}) {
    const spinner = ora(`Validating git template: ${url}`).start();

    try {
      // Validate inputs
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitTemplateError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'validate_template', url);
      }

      this.logger.info(`Validating git template: ${url}`);

      // Check if repository is accessible
      spinner.text = 'Checking repository accessibility...';
      const isAccessible = await this.gitManager.validateRepository(url);
      if (!isAccessible) {
        throw new RepositoryNotFoundError(`Repository is not accessible: ${url}`, url);
      }

      // Get repository information
      spinner.text = 'Getting repository information...';
      const repoInfo = await this.gitManager.getRepositoryInfo(url);

      // Clone repository for detailed validation
      spinner.text = 'Cloning repository for validation...';
      const repoPath = await this.gitManager.cloneRepository(url, {
        branch: options.branch,
        tag: options.tag,
        depth: 1
      });

      try {
        // Extract template information
        const templateInfo = await this.extractTemplateInfo(repoPath, url, options);

        // Validate template structure
        const structureErrors = this.validateTemplateStructure(repoPath, templateInfo);
        const securityErrors = await this.validateTemplateSecurity(repoPath);

        // Combine all validation results
        const allErrors = [...structureErrors, ...securityErrors];
        const warnings = [];

        // Check for best practices
        const bestPracticeWarnings = this.checkTemplateBestPractices(repoPath, templateInfo);
        warnings.push(...bestPracticeWarnings);

        const result = {
          isValid: allErrors.length === 0,
          errors: allErrors,
          warnings,
          template: templateInfo,
          repository: repoInfo,
          validatedAt: new Date().toISOString()
        };

        if (result.isValid) {
          spinner.succeed('Template validation passed');
        } else {
          spinner.fail('Template validation failed');
        }

        this.logger.info('Template validation completed:', { isValid: result.isValid, errorCount: allErrors.length });

        return result;

      } finally {
        // Clean up repository
        await this.gitManager.cleanupRepository(repoPath);
      }

    } catch (error) {
      spinner.fail(`Template validation failed: ${error.message}`);

      if (error instanceof GitTemplateError) {
        throw error;
      }

      const gitError = new GitTemplateError(
        `Failed to validate git template: ${error.message}`,
        'validate_template',
        url,
        error
      );
      throw gitError;
    }
  }

  /**
   * Download template from git repository
   * @param {string} url - Git repository URL
   * @param {Object} options - Download options
   * @returns {Promise<string>} Path to downloaded template
   */
  async downloadGitTemplate(url, options = {}) {
    const spinner = ora(`Downloading template from ${url}`).start();

    try {
      // Validate inputs
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitTemplateError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'download_template', url);
      }

      if (!options.targetDir) {
        throw new GitTemplateError('Target directory is required', 'download_template', url);
      }

      const pathValidation = validateFilePath(options.targetDir);
      if (!pathValidation.isValid) {
        throw new GitTemplateError(`Invalid target directory: ${pathValidation.errors.join(', ')}`, 'download_template', url);
      }

      this.logger.info(`Downloading template from ${url} to ${options.targetDir}`);

      // Check cache first
      const cacheKey = this.getCacheKey(url, options);
      if (this.options.enableCache && options.useCache !== false) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          spinner.text = 'Copying from cache...';
          await this.copyTemplateFromCache(cached, options.targetDir, options);
          spinner.succeed(`Template downloaded from cache to ${options.targetDir}`);
          return options.targetDir;
        }
      }

      // Clone repository
      spinner.text = 'Cloning repository...';
      const repoPath = await this.gitManager.cloneRepository(url, {
        branch: options.branch,
        tag: options.tag,
        depth: options.depth || 1,
        targetDir: options.targetDir,
        ...options.gitOptions
      });

      try {
        // Extract template information
        spinner.text = 'Processing template...';
        const templateInfo = await this.extractTemplateInfo(repoPath, url, options);

        // Validate template
        if (this.options.templateValidation) {
          spinner.text = 'Validating template...';
          const validationResult = await this.validateGitTemplate(repoPath, templateInfo);
          if (!validationResult.isValid) {
            throw new TemplateValidationError(
              `Template validation failed: ${validationResult.errors.join(', ')}`,
              url,
              validationResult.errors
            );
          }
        }

        // Extract template files to target location
        spinner.text = 'Extracting template files...';
        const templatePath = options.templatePath || '.';
        await this.extractTemplateFiles(repoPath, templatePath, options.targetDir);

        // Clean up git repository if not keeping it
        if (options.cleanupGit !== false) {
          spinner.text = 'Cleaning up git repository...';
          await this.gitManager.cleanupRepository(path.join(options.targetDir, '.git'));
        }

        // Cache result
        if (this.options.enableCache) {
          const result = {
            template: templateInfo,
            repository: {
              url,
              path: repoPath,
              branch: options.branch,
              tag: options.tag,
              commit: templateInfo.commit
            },
            extractedAt: new Date().toISOString()
          };
          this.setCache(cacheKey, result);
        }

        spinner.succeed(`Template downloaded to ${options.targetDir}`);
        this.logger.info('Template downloaded successfully:', { targetDir: options.targetDir, name: templateInfo.name });

        return options.targetDir;

      } catch (error) {
        // Clean up on failure
        if (fs.existsSync(options.targetDir)) {
          await fs.remove(options.targetDir);
        }
        throw error;
      }

    } catch (error) {
      spinner.fail(`Failed to download template: ${error.message}`);

      if (error instanceof GitTemplateError) {
        throw error;
      }

      const gitError = new GitTemplateError(
        `Failed to download git template: ${error.message}`,
        'download_template',
        url,
        error
      );
      throw gitError;
    }
  }

  /**
   * Get git template information
   * @param {string} url - Git repository URL
   * @param {Object} options - Information options
   * @returns {Promise<Object>} Template information
   */
  async getGitTemplateInfo(url, options = {}) {
    const spinner = ora(`Getting template info for ${url}`).start();

    try {
      // Validate inputs
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitTemplateError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'get_template_info', url);
      }

      this.logger.info(`Getting template information for: ${url}`);

      // Check cache first
      const cacheKey = this.getCacheKey(url, options);
      if (this.options.enableCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached && cached.template) {
          spinner.succeed('Template information retrieved from cache');
          return cached.template;
        }
      }

      // Get repository information
      spinner.text = 'Getting repository information...';
      const repoInfo = await this.gitManager.getRepositoryInfo(url);

      // Clone repository for detailed information
      spinner.text = 'Cloning repository to get detailed information...';
      const repoPath = await this.gitManager.cloneRepository(url, {
        branch: options.branch,
        tag: options.tag,
        depth: 1
      });

      try {
        // Extract template information
        const templateInfo = await this.extractTemplateInfo(repoPath, url, options);

        // Enhance with repository information
        templateInfo.repository = {
          ...repoInfo,
          branches: await this.gitManager.getBranches(url),
          tags: await this.gitManager.getTags(url)
        };

        // Cache result
        if (this.options.enableCache) {
          this.setCache(cacheKey, { template: templateInfo });
        }

        spinner.succeed('Template information retrieved successfully');
        this.logger.info('Template information retrieved:', { name: templateInfo.name, version: templateInfo.version });

        return templateInfo;

      } finally {
        // Clean up repository
        await this.gitManager.cleanupRepository(repoPath);
      }

    } catch (error) {
      spinner.fail(`Failed to get template information: ${error.message}`);

      if (error instanceof GitTemplateError) {
        throw error;
      }

      const gitError = new GitTemplateError(
        `Failed to get git template information: ${error.message}`,
        'get_template_info',
        url,
        error
      );
      throw gitError;
    }
  }

  /**
   * List templates in git repository
   * @param {string} url - Git repository URL
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} List of templates
   */
  async listGitTemplates(url, options = {}) {
    const spinner = ora(`Listing templates in ${url}`).start();

    try {
      // Validate inputs
      const urlValidation = validateGitUrl(url);
      if (!urlValidation.isValid) {
        throw new GitTemplateError(`Invalid repository URL: ${urlValidation.errors.join(', ')}`, 'list_templates', url);
      }

      this.logger.info(`Listing templates in repository: ${url}`);

      // Clone repository
      spinner.text = 'Cloning repository to list templates...';
      const repoPath = await this.gitManager.cloneRepository(url, {
        branch: options.branch,
        tag: options.tag,
        depth: 1
      });

      try {
        // Discover templates in repository
        spinner.text = 'Discovering templates...';
        const templates = await this.discoverTemplates(repoPath);

        spinner.succeed(`Found ${templates.length} templates`);
        this.logger.info('Templates listed successfully:', { count: templates.length });

        return templates;

      } finally {
        // Clean up repository
        await this.gitManager.cleanupRepository(repoPath);
      }

    } catch (error) {
      spinner.fail(`Failed to list templates: ${error.message}`);

      if (error instanceof GitTemplateError) {
        throw error;
      }

      const gitError = new GitTemplateError(
        `Failed to list git templates: ${error.message}`,
        'list_templates',
        url,
        error
      );
      throw gitError;
    }
  }

  /**
   * Extract template files from repository
   * @param {string} repoPath - Path to repository
   * @param {string} templatePath - Path to template within repository
   * @param {string} targetDir - Target directory (optional)
   * @returns {Promise<Object>} Extracted files information
   */
  async extractTemplateFiles(repoPath, templatePath = '.', targetDir = null) {
    const sourcePath = path.join(repoPath, templatePath);

    // Validate source path exists
    if (!await fs.pathExists(sourcePath)) {
      throw new TemplateExtractionError(
        `Template path does not exist: ${templatePath}`,
        repoPath,
        templatePath
      );
    }

    this.logger.info(`Extracting template files from: ${sourcePath}`);

    const result = {
      files: [],
      directories: [],
      totalSize: 0,
      extractedAt: new Date().toISOString()
    };

    try {
      // Get all files in the template directory
      const files = await this.getAllFiles(sourcePath);

      for (const file of files) {
        const relativePath = path.relative(sourcePath, file);
        const targetPath = targetDir ? path.join(targetDir, relativePath) : file;

        // Create directory if needed
        const targetDirPath = path.dirname(targetPath);
        if (!await fs.pathExists(targetDirPath)) {
          await fs.ensureDir(targetDirPath);
          if (!targetDir) {
            result.directories.push(path.dirname(relativePath));
          }
        }

        // Copy file
        await fs.copy(file, targetPath);

        // Get file stats
        const stats = await fs.stat(file);
        result.files.push({
          path: relativePath,
          size: stats.size,
          isExecutable: (stats.mode & parseInt('111', 8)) !== 0,
          lastModified: stats.mtime.toISOString()
        });
        result.totalSize += stats.size;
      }

      // Check repository size
      if (result.totalSize > this.options.maxRepositorySize) {
        this.logger.warn(`Template size (${result.totalSize} bytes) exceeds recommended size (${this.options.maxRepositorySize} bytes)`);
      }

      this.logger.info('Template files extracted successfully:', { fileCount: result.files.length, totalSize: result.totalSize });

      return result;

    } catch (error) {
      throw new TemplateExtractionError(
        `Failed to extract template files: ${error.message}`,
        repoPath,
        templatePath,
        error
      );
    }
  }

  /**
   * Extract template information from repository
   * @private
   */
  async extractTemplateInfo(repoPath, url, options = {}) {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const templateConfigPath = path.join(repoPath, 'template.config.json');
    const templateYamlPath = path.join(repoPath, 'template.yaml');

    let templateInfo = {
      name: this.extractRepoName(url),
      version: '1.0.0',
      description: '',
      type: 'generic',
      author: '',
      repository: url,
      commit: await this.getCurrentCommit(repoPath),
      branch: options.branch,
      tag: options.tag,
      extractedAt: new Date().toISOString()
    };

    // Try to read package.json
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageData = await fs.readJson(packageJsonPath);
        templateInfo = {
          ...templateInfo,
          name: packageData.name || templateInfo.name,
          version: packageData.version || templateInfo.version,
          description: packageData.description || templateInfo.description,
          type: packageData.type || templateInfo.type,
          author: packageData.author || templateInfo.author,
          keywords: packageData.keywords || [],
          dependencies: packageData.dependencies || {},
          devDependencies: packageData.devDependencies || {},
          main: packageData.main,
          scripts: packageData.scripts || {}
        };
      } catch (error) {
        this.logger.warn(`Failed to read package.json: ${error.message}`);
      }
    }

    // Try to read template configuration
    if (await fs.pathExists(templateConfigPath)) {
      try {
        const configData = await fs.readJson(templateConfigPath);
        templateInfo = {
          ...templateInfo,
          ...configData,
          configSource: 'template.config.json'
        };
      } catch (error) {
        this.logger.warn(`Failed to read template.config.json: ${error.message}`);
      }
    }

    // Try to read YAML configuration
    if (await fs.pathExists(templateYamlPath)) {
      try {
        const yamlContent = await fs.readFile(templateYamlPath, 'utf8');
        const configData = yaml.parse(yamlContent);
        templateInfo = {
          ...templateInfo,
          ...configData,
          configSource: 'template.yaml'
        };
      } catch (error) {
        this.logger.warn(`Failed to read template.yaml: ${error.message}`);
      }
    }

    return templateInfo;
  }

  /**
   * Validate template structure
   * @private
   */
  validateTemplateStructure(repoPath, templateInfo) {
    const errors = [];

    // Check for essential files
    const essentialFiles = ['package.json'];
    for (const file of essentialFiles) {
      const filePath = path.join(repoPath, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing essential file: ${file}`);
      }
    }

    // Validate template type
    const validTypes = ['react-next', 'node-api', 'vue-app', 'generic'];
    if (!validTypes.includes(templateInfo.type)) {
      errors.push(`Invalid template type: ${templateInfo.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Check for template configuration
    const configFiles = ['template.config.json', 'template.yaml'];
    const hasConfig = configFiles.some(file => fs.existsSync(path.join(repoPath, file)));
    if (!hasConfig) {
      errors.push('No template configuration file found (template.config.json or template.yaml)');
    }

    return errors;
  }

  /**
   * Validate template security
   * @private
   */
  async validateTemplateSecurity(repoPath) {
    const errors = [];

    try {
      // Use template validator for security checks
      const validation = await validateTemplatePackage(repoPath);
      if (!validation.isValid) {
        errors.push(...validation.errors);
      }
    } catch (error) {
      this.logger.warn(`Security validation failed: ${error.message}`);
      errors.push('Security validation could not be completed');
    }

    // Check for suspicious files
    const suspiciousPatterns = [
      '**/*.exe',
      '**/*.dll',
      '**/*.so',
      '**/*.dylib',
      '**/node_modules/**'
    ];

    for (const pattern of suspiciousPatterns) {
      const files = glob.sync(path.join(repoPath, pattern));
      if (files.length > 0) {
        errors.push(`Suspicious files found: ${pattern} (${files.length} files)`);
      }
    }

    return errors;
  }

  /**
   * Check template best practices
   * @private
   */
  checkTemplateBestPractices(repoPath, templateInfo) {
    const warnings = [];

    // Check for README
    const readmeFiles = ['README.md', 'README.rst', 'README.txt'];
    const hasReadme = readmeFiles.some(file => fs.existsSync(path.join(repoPath, file)));
    if (!hasReadme) {
      warnings.push('No README file found');
    }

    // Check for .gitignore
    if (!fs.existsSync(path.join(repoPath, '.gitignore'))) {
      warnings.push('No .gitignore file found');
    }

    // Check for license
    const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
    const hasLicense = licenseFiles.some(file => fs.existsSync(path.join(repoPath, file)));
    if (!hasLicense) {
      warnings.push('No license file found');
    }

    // Check template naming convention
    if (!templateInfo.name.startsWith('@xagi/ai-template-')) {
      warnings.push('Template name should follow @xagi/ai-template-{type} convention');
    }

    return warnings;
  }

  /**
   * Discover templates in repository
   * @private
   */
  async discoverTemplates(repoPath) {
    const templates = [];

    // Look for template directories
    const templateDirs = await this.findTemplateDirectories(repoPath);

    for (const dir of templateDirs) {
      try {
        const templateInfo = await this.extractTemplateInfo(path.join(repoPath, dir), dir);
        templates.push({
          ...templateInfo,
          path: dir,
          relativePath: dir
        });
      } catch (error) {
        this.logger.warn(`Failed to extract template info for ${dir}: ${error.message}`);
      }
    }

    // If no template directories found, treat root as template
    if (templates.length === 0) {
      try {
        const templateInfo = await this.extractTemplateInfo(repoPath, '.');
        templates.push({
          ...templateInfo,
          path: '.',
          relativePath: '.'
        });
      } catch (error) {
        this.logger.warn(`Failed to extract template info for root: ${error.message}`);
      }
    }

    return templates;
  }

  /**
   * Find template directories in repository
   * @private
   */
  async findTemplateDirectories(repoPath) {
    const templateDirs = [];

    // Look for directories with package.json
    const packageJsonFiles = glob.sync(path.join(repoPath, '**/package.json'));

    for (const packageFile of packageJsonFiles) {
      const dir = path.dirname(path.relative(repoPath, packageFile));

      // Skip node_modules and other excluded directories
      const excludedDirs = ['node_modules', '.git', 'dist', 'build'];
      if (!excludedDirs.some(excluded => dir.includes(excluded))) {
        templateDirs.push(dir);
      }
    }

    return templateDirs;
  }

  /**
   * Get all files in directory recursively
   * @private
   */
  async getAllFiles(dir) {
    const files = [];
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        // Skip .git directory and other system directories
        if (!item.name.startsWith('.') || item.name === '.gitignore') {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        }
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Get current commit hash
   * @private
   */
  async getCurrentCommit(repoPath) {
    try {
      const git = this.gitManager.createGitInstance(repoPath);
      const log = await git.log(['--max-count', '1']);
      return log.latest ? log.latest.hash : null;
    } catch (error) {
      this.logger.warn(`Failed to get current commit: ${error.message}`);
      return null;
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
   * Generate cache key
   * @private
   */
  getCacheKey(url, options = {}) {
    const keyComponents = [url];
    if (options.branch) {
      keyComponents.push(`branch:${options.branch}`);
    }
    if (options.tag) {
      keyComponents.push(`tag:${options.tag}`);
    }
    if (options.templatePath) {
      keyComponents.push(`path:${options.templatePath}`);
    }
    return keyComponents.join('|');
  }

  /**
   * Get from cache
   * @private
   */
  getFromCache(key) {
    if (!this.options.enableCache) {
      return null;
    }

    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const age = Date.now() - cached.cachedAt;
    if (age > this.options.maxCacheAge) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug(`Cache hit for: ${key}`);
    return cached.data;
  }

  /**
   * Set cache
   * @private
   */
  setCache(key, data) {
    if (!this.options.enableCache) {
      return;
    }

    this.cache.set(key, {
      data,
      cachedAt: Date.now()
    });

    this.logger.debug(`Cached: ${key}`);
  }

  /**
   * Copy template from cache
   * @private
   */
  async copyTemplateFromCache(cached, targetDir, options) {
    // This would implement copying cached template to target directory
    // For now, we'll just clone again since caching is simplified
    return this.downloadGitTemplate(cached.repository.url, {
      ...options,
      targetDir,
      useCache: false
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const stats = {
      entries: this.cache.size,
      maxSize: this.options.maxCacheAge,
      memoryUsage: process.memoryUsage()
    };

    let totalAge = 0;
    let oldest = 0;
    let newest = Date.now();

    for (const [, entry] of this.cache.entries()) {
      const age = Date.now() - entry.cachedAt;
      totalAge += age;
      oldest = Math.max(oldest, age);
      newest = Math.min(newest, age);
    }

    if (stats.entries > 0) {
      stats.averageAge = totalAge / stats.entries;
      stats.oldestEntry = oldest;
      stats.newestEntry = newest;
    }

    return stats;
  }

  /**
   * Configure authentication
   * @param {Object} authConfig - Authentication configuration
   */
  configureAuthentication(authConfig) {
    this.gitManager.configureAuthentication(authConfig);
    this.logger.info('GitService authentication configured');
  }

  /**
   * Set timeout for operations
   * @param {number} timeout - Timeout in milliseconds
   */
  setTimeout(timeout) {
    this.options.timeout = timeout;
    this.gitManager.setTimeout(timeout);
    this.logger.info(`GitService timeout set to ${timeout}ms`);
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Debug mode enabled
   */
  setDebugMode(enabled) {
    this.options.debug = enabled;
    this.gitManager.setDebugMode(enabled);
    this.logger.info(`GitService debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = {
  GitService,
  GitTemplateError,
  TemplateExtractionError,
  TemplateValidationError
};

