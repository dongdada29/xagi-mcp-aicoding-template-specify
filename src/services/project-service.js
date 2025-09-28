/**
 * ProjectService
 * Handles project creation and management operations
 */

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const execa = require('execa');
const chalk = require('chalk');
const ora = require('ora');
const { promisify } = require('util');

const ProjectInstance = require('../models/project');
const { ProjectConfiguration } = require('../models/config');
const TemplatePackage = require('../models/template');
const TemplateManager = require('../core/template-manager');
const NpmService = require('./npm-service');
const GitService = require('./git-service');
const {
  validateProjectName,
  validateFilePath,
  validateConfig,
  validateRegistryUrl
} = require('../utils/validation');

// Promisify glob
const globAsync = promisify(glob);

/**
 * Custom error class for project service errors
 */
class ProjectServiceError extends Error {
  constructor(message, code = null, details = null) {
    super(message);
    this.name = 'ProjectServiceError';
    this.code = code;
    this.details = details;
    this.isProjectServiceError = true;
  }
}

/**
 * Progress tracking for project operations
 */
class ProgressTracker {
  constructor() {
    this.steps = [];
    this.currentStep = 0;
    this.startTime = null;
    this.spinner = null;
    this.callbacks = {
      onStepStart: null,
      onStepComplete: null,
      onProgress: null,
      onError: null,
      onComplete: null
    };
  }

  /**
   * Add a step to the progress tracker
   * @param {string} description - Step description
   * @param {Function} fn - Step function
   */
  addStep(description, fn) {
    this.steps.push({ description, fn, completed: false, error: null });
    return this;
  }

  /**
   * Set progress callback
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    }
    return this;
  }

  /**
   * Execute all steps with progress tracking
   * @param {Object} context - Context to pass to step functions
   * @returns {Promise<Object>} Execution result
   */
  async execute(context = {}) {
    this.startTime = Date.now();
    this.currentStep = 0;

    try {
      for (let i = 0; i < this.steps.length; i++) {
        this.currentStep = i;
        const step = this.steps[i];

        if (this.callbacks.onStepStart) {
          this.callbacks.onStepStart(step, i, this.steps.length);
        }

        try {
          const result = await step.fn(context);
          step.completed = true;
          step.result = result;

          if (this.callbacks.onStepComplete) {
            this.callbacks.onStepComplete(step, i, this.steps.length);
          }

          if (this.callbacks.onProgress) {
            const progress = ((i + 1) / this.steps.length) * 100;
            this.callbacks.onProgress(progress, step, i, this.steps.length);
          }
        } catch (error) {
          step.error = error;
          if (this.callbacks.onError) {
            this.callbacks.onError(error, step, i, this.steps.length);
          }
          throw error;
        }
      }

      const duration = Date.now() - this.startTime;
      const result = {
        success: true,
        duration,
        steps: this.steps,
        context
      };

      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(result);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - this.startTime;
      const result = {
        success: false,
        duration,
        error,
        steps: this.steps,
        context
      };

      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(result);
      }

      throw error;
    }
  }
}

/**
 * ProjectService class for managing project lifecycle
 */
class ProjectService {
  /**
   * Create a new ProjectService instance
   * @param {Object} options - Service options
   * @param {string} options.projectsDir - Base directory for projects
   * @param {string} options.templatesDir - Base directory for templates
   * @param {Object} options.registry - Registry configuration
   * @param {boolean} options.verbose - Enable verbose logging
   */
  constructor(options = {}) {
    this.projectsDir = options.projectsDir || process.cwd();
    this.templatesDir = options.templatesDir || path.join(__dirname, '../templates');
    this.registry = options.registry || {
      url: 'https://registry.npmjs.org',
      authToken: null
    };
    this.verbose = options.verbose || false;

    // Ensure directories exist
    fs.ensureDirSync(this.projectsDir);
    fs.ensureDirSync(this.templatesDir);

    // Initialize template cache
    this.templateCache = new Map();

    // Supported template types
    this.supportedTemplateTypes = ['react-next', 'node-api', 'vue-app'];

    // Service integrations
    this.templateManager = options.templateManager || null;
    this.npmService = options.npmService || null;
    this.gitService = options.gitService || null;

    // Initialize services if not provided
    this.initializeServices();
  }

  /**
   * Initialize services if not provided
   * @private
   */
  initializeServices() {
    // Initialize TemplateManager if not provided
    if (!this.templateManager) {
      this.templateManager = new TemplateManager({
        cacheDir: path.join(this.projectsDir, '.template-cache'),
        enableCache: true,
        verbose: this.verbose
      });
    }

    // Initialize NpmService if not provided
    if (!this.npmService) {
      this.npmService = new NpmService({
        registry: this.registry.url,
        authToken: this.registry.authToken,
        verbose: this.verbose
      });
    }

    // Initialize GitService if not provided
    if (!this.gitService) {
      this.gitService = new GitService({
        verbose: this.verbose
      });
    }
  }

  /**
   * Log verbose messages if verbose mode is enabled
   * @param {string} message - Message to log
   * @param {string} level - Log level
   */
  log(message, level = 'info') {
    if (!this.verbose) {return;}

    const timestamp = new Date().toISOString();
    const prefix = chalk.gray(`[${timestamp}]`);

    switch (level) {
    case 'error':
      console.error(prefix, chalk.red('ERROR:'), message);
      break;
    case 'warn':
      console.warn(prefix, chalk.yellow('WARN:'), message);
      break;
    case 'success':
      console.log(prefix, chalk.green('SUCCESS:'), message);
      break;
    default:
      console.log(prefix, chalk.blue('INFO:'), message);
    }
  }

  /**
   * Create a new project from configuration
   * @param {ProjectConfiguration|Object} config - Project configuration
   * @returns {Promise<ProjectInstance>} Created project instance
   */
  async createProject(config) {
    try {
      // Normalize configuration
      const projectConfig = config instanceof ProjectConfiguration
        ? config
        : new ProjectConfiguration(config);

      this.log(`Creating project: ${projectConfig.projectName}`);

      // Validate configuration
      const configValidation = projectConfig.validate();
      if (!configValidation.isValid) {
        throw new ProjectServiceError(
          'Invalid project configuration',
          'INVALID_CONFIG',
          { errors: configValidation.errors }
        );
      }

      // Get template package
      const template = await this.getTemplatePackage(projectConfig.templateId, projectConfig.version);
      if (!template) {
        throw new ProjectServiceError(
          `Template not found: ${projectConfig.templateId}@${projectConfig.version}`,
          'TEMPLATE_NOT_FOUND'
        );
      }

      // Validate template compatibility
      if (!template.isCompatible('1.0.0')) {
        throw new ProjectServiceError(
          `Template ${template.id}@${template.version} is not compatible with CLI version 1.0.0`,
          'INCOMPATIBLE_TEMPLATE'
        );
      }

      // Create project instance
      const project = new ProjectInstance({
        projectName: projectConfig.projectName,
        projectPath: projectConfig.projectPath,
        templateId: template.id,
        templateVersion: template.version,
        configuration: {
          ...projectConfig.configValues,
          ...projectConfig.overrides
        }
      });

      // Set up progress tracking
      const progress = new ProgressTracker()
        .addStep('Validating project configuration', async(ctx) => {
          this.log('Validating project configuration');
          const validation = await this.validateProject(project);
          if (!validation.isValid) {
            throw new ProjectServiceError(
              'Project validation failed',
              'VALIDATION_FAILED',
              { errors: validation.errors }
            );
          }
          return validation;
        })
        .addStep('Creating project directory', async(ctx) => {
          this.log(`Creating project directory: ${project.projectPath}`);
          await fs.ensureDir(project.projectPath);

          // Check directory permissions
          await this.checkDirectoryPermissions(project.projectPath);

          return { path: project.projectPath };
        })
        .addStep('Generating project files', async(ctx) => {
          this.log('Generating project files');
          const generatedFiles = await this.generateProjectFiles(template, projectConfig);

          // Update project with generated files
          generatedFiles.forEach(file => {
            project.addFile({
              path: file.path,
              name: path.basename(file.path),
              size: file.size || 0,
              type: file.type || 'text',
              createdAt: new Date()
            });
          });

          return generatedFiles;
        })
        .addStep('Processing template variables', async(ctx) => {
          this.log('Processing template variables');
          await this.processTemplateVariables(template, projectConfig);
          return { processed: true };
        })
        .addStep('Installing dependencies', async(ctx) => {
          this.log('Installing dependencies');
          await this.installDependencies(project.projectPath, template);
          return { installed: true };
        })
        .addStep('Finalizing project', async(ctx) => {
          this.log('Finalizing project');
          project.updateStatus('created');

          // Calculate actual project size
          const actualSize = await project.calculateActualSize();
          project.size = actualSize;

          return { finalized: true, size: actualSize };
        });

      // Add progress callbacks for CLI feedback
      progress
        .on('stepStart', (step, index, total) => {
          this.log(`Step ${index + 1}/${total}: ${step.description}`);
        })
        .on('stepComplete', (step, index, total) => {
          this.log(`✓ Completed: ${step.description}`);
        })
        .on('error', (error, step, index, total) => {
          this.log(`✗ Failed: ${step.description} - ${error.message}`, 'error');
        });

      // Execute project creation with progress tracking
      await progress.execute({ project, template, config: projectConfig });

      this.log(`Project created successfully: ${project.projectName}`, 'success');
      return project;

    } catch (error) {
      this.log(`Failed to create project: ${error.message}`, 'error');

      // Cleanup on failure
      if (error.isProjectServiceError && error.code !== 'VALIDATION_FAILED') {
        await this.cleanupFailedProject(config.projectPath);
      }

      throw error;
    }
  }

  /**
   * Generate project files from template
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {Promise<Array>} Generated files
   */
  async generateProjectFiles(template, config) {
    try {
      this.log(`Generating files for template: ${template.id} (${template.type})`);

      // Get template files
      const templateFiles = await this.getTemplateFiles(template);
      const generatedFiles = [];
      const failedFiles = [];

      // Use TemplateManager if available for enhanced file generation
      if (this.templateManager) {
        try {
          this.log('Using TemplateManager for enhanced file generation');
          const result = await this.templateManager.generateProjectFiles(template, config, {
            projectPath: config.projectPath,
            overwrite: false,
            verbose: this.verbose
          });

          if (result && result.success) {
            this.log(`Generated ${result.files?.length || 0} files via TemplateManager`);
            return result.files || [];
          }
        } catch (error) {
          this.log(`TemplateManager file generation failed: ${error.message}`, 'warn');
        }
      }

      // Fallback to individual file generation
      this.log('Using fallback file generation');
      for (const templateFile of templateFiles) {
        try {
          const generatedFile = await this.generateFile(templateFile, template, config);
          generatedFiles.push(generatedFile);
        } catch (error) {
          failedFiles.push({
            path: templateFile.path,
            error: error.message
          });
          this.log(`Failed to generate file ${templateFile.path}: ${error.message}`, 'warn');
          // Continue with other files even if one fails
        }
      }

      // Log failed files summary
      if (failedFiles.length > 0) {
        this.log(`Failed to generate ${failedFiles.length} files`, 'warn');
        failedFiles.forEach(({ path, error }) => {
          this.log(`  - ${path}: ${error}`, 'warn');
        });
      }

      // Perform post-generation validation
      await this.validateGeneratedFiles(config.projectPath, templateFiles, generatedFiles);

      this.log(`Successfully generated ${generatedFiles.length} files`);
      return generatedFiles;

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to generate project files: ${error.message}`,
        'FILE_GENERATION_FAILED',
        { templateId: template.id, error: error.message }
      );
    }
  }

  /**
   * Validate generated files against expected template files
   * @param {string} projectPath - Project path
   * @param {Array} expectedFiles - Expected template files
   * @param {Array} generatedFiles - Generated files
   * @returns {Promise<void>}
   * @private
   */
  async validateGeneratedFiles(projectPath, expectedFiles, generatedFiles) {
    try {
      const generatedPaths = new Set(generatedFiles.map(f => f.path));
      const expectedPaths = new Set(expectedFiles.map(f => f.path));

      // Check for missing files
      const missingFiles = Array.from(expectedPaths).filter(path => !generatedPaths.has(path));
      if (missingFiles.length > 0) {
        this.log(`Missing ${missingFiles.length} expected files: ${missingFiles.join(', ')}`, 'warn');
      }

      // Check for extra files
      const extraFiles = Array.from(generatedPaths).filter(path => !expectedPaths.has(path));
      if (extraFiles.length > 0) {
        this.log(`Generated ${extraFiles.length} extra files: ${extraFiles.join(', ')}`, 'info');
      }

      // Validate file existence on disk
      const existingFiles = [];
      for (const file of generatedFiles) {
        const fullPath = path.join(projectPath, file.path);
        if (await fs.pathExists(fullPath)) {
          const stats = await fs.stat(fullPath);
          existingFiles.push({
            ...file,
            size: stats.size,
            permissions: stats.mode,
            exists: true
          });
        } else {
          this.log(`File does not exist on disk: ${file.path}`, 'warn');
        }
      }

      this.log(`Validated ${existingFiles.length} files exist on disk`);

    } catch (error) {
      this.log(`File validation failed: ${error.message}`, 'warn');
    }
  }

  /**
   * Process template variables in generated files
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {Promise<void>}
   */
  async processTemplateVariables(template, config) {
    try {
      this.log(`Processing template variables for: ${template.id}`);

      // Get all generated files
      const files = await this.getProjectFiles(config.projectPath);
      const variableMap = this.buildVariableMap(template, config);

      for (const file of files) {
        try {
          await this.processFileVariables(file, variableMap);
        } catch (error) {
          this.log(`Failed to process variables in file ${file}: ${error.message}`, 'warn');
        }
      }

      this.log(`Processed variables in ${files.length} files`);

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to process template variables: ${error.message}`,
        'VARIABLE_PROCESSING_FAILED',
        { templateId: template.id, error: error.message }
      );
    }
  }

  /**
   * Validate project structure and configuration
   * @param {ProjectInstance|string} project - Project instance or path
   * @returns {Promise<Object>} Validation result
   */
  async validateProject(project) {
    try {
      const projectPath = typeof project === 'string' ? project : project.projectPath;
      this.log(`Validating project: ${projectPath}`);

      const errors = [];
      const warnings = [];

      // Check if project directory exists
      if (!await fs.pathExists(projectPath)) {
        errors.push('Project directory does not exist');
        return { isValid: false, errors, warnings };
      }

      // Check required files
      const requiredFiles = ['package.json'];
      for (const file of requiredFiles) {
        const filePath = path.join(projectPath, file);
        if (!await fs.pathExists(filePath)) {
          errors.push(`Required file missing: ${file}`);
        }
      }

      // Check package.json structure
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        try {
          const packageJson = await fs.readJson(packageJsonPath);

          if (!packageJson.name) {
            warnings.push('package.json is missing name field');
          }

          if (!packageJson.version) {
            warnings.push('package.json is missing version field');
          }
        } catch (error) {
          errors.push(`Invalid package.json: ${error.message}`);
        }
      }

      // Check file permissions
      try {
        await this.checkDirectoryPermissions(projectPath);
      } catch (error) {
        errors.push(`Permission error: ${error.message}`);
      }

      // Check for common security issues
      await this.checkSecurityIssues(projectPath, errors, warnings);

      this.log(`Project validation completed: ${errors.length} errors, ${warnings.length} warnings`);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to validate project: ${error.message}`,
        'VALIDATION_ERROR',
        { error: error.message }
      );
    }
  }

  /**
   * Get project information
   * @param {string} projectPath - Project path
   * @returns {Promise<Object>} Project information
   */
  async getProjectInfo(projectPath) {
    try {
      this.log(`Getting project info for: ${projectPath}`);

      if (!await fs.pathExists(projectPath)) {
        throw new ProjectServiceError(
          `Project directory does not exist: ${projectPath}`,
          'PROJECT_NOT_FOUND'
        );
      }

      const info = {
        path: projectPath,
        exists: true,
        files: [],
        directories: [],
        packageJson: null,
        size: 0,
        lastModified: null,
        created: null
      };

      // Get basic file system info
      const stats = await fs.stat(projectPath);
      info.size = await this.getDirectorySize(projectPath);
      info.lastModified = stats.mtime;
      info.created = stats.birthtime;

      // Get package.json if it exists
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        info.packageJson = await fs.readJson(packageJsonPath);
      }

      // Get file and directory listing
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(projectPath, entry.name);
        const entryStats = await fs.stat(fullPath);

        if (entry.isDirectory()) {
          info.directories.push({
            name: entry.name,
            path: fullPath,
            size: await this.getDirectorySize(fullPath),
            lastModified: entryStats.mtime
          });
        } else {
          info.files.push({
            name: entry.name,
            path: fullPath,
            size: entryStats.size,
            lastModified: entryStats.mtime,
            type: path.extname(entry.name).slice(1)
          });
        }
      }

      // Try to find project metadata file
      const metadataPath = path.join(projectPath, '.xagi-project.json');
      if (await fs.pathExists(metadataPath)) {
        try {
          info.metadata = await fs.readJson(metadataPath);
        } catch (error) {
          this.log(`Failed to read project metadata: ${error.message}`, 'warn');
        }
      }

      this.log(`Retrieved project info: ${info.files.length} files, ${info.directories.length} directories`);
      return info;

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to get project info: ${error.message}`,
        'INFO_RETRIEVAL_FAILED',
        { projectPath, error: error.message }
      );
    }
  }

  /**
   * Update existing project
   * @param {string} projectPath - Project path
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Update result
   */
  async updateProject(projectPath, updates) {
    try {
      this.log(`Updating project: ${projectPath}`);

      if (!await fs.pathExists(projectPath)) {
        throw new ProjectServiceError(
          `Project directory does not exist: ${projectPath}`,
          'PROJECT_NOT_FOUND'
        );
      }

      const results = {
        updated: false,
        changes: [],
        warnings: []
      };

      // Update package.json if specified
      if (updates.packageJson) {
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
          const currentPackageJson = await fs.readJson(packageJsonPath);
          const updatedPackageJson = { ...currentPackageJson, ...updates.packageJson };
          await fs.writeJson(packageJsonPath, updatedPackageJson, { spaces: 2 });
          results.changes.push('Updated package.json');
        } else {
          results.warnings.push('package.json not found, skipping update');
        }
      }

      // Update dependencies if specified
      if (updates.dependencies) {
        try {
          await this.updateDependencies(projectPath, updates.dependencies);
          results.changes.push('Updated dependencies');
        } catch (error) {
          results.warnings.push(`Failed to update dependencies: ${error.message}`);
        }
      }

      // Update files if specified
      if (updates.files) {
        for (const [filePath, content] of Object.entries(updates.files)) {
          const fullPath = path.join(projectPath, filePath);
          try {
            await fs.ensureDir(path.dirname(fullPath));
            await fs.writeFile(fullPath, content);
            results.changes.push(`Updated file: ${filePath}`);
          } catch (error) {
            results.warnings.push(`Failed to update file ${filePath}: ${error.message}`);
          }
        }
      }

      // Update project metadata
      const metadataPath = path.join(projectPath, '.xagi-project.json');
      let metadata = {};
      if (await fs.pathExists(metadataPath)) {
        metadata = await fs.readJson(metadataPath);
      }

      metadata.lastUpdated = new Date().toISOString();
      metadata.updates = metadata.updates || [];
      metadata.updates.push({
        timestamp: new Date().toISOString(),
        changes: results.changes,
        updates: Object.keys(updates)
      });

      await fs.writeJson(metadataPath, metadata, { spaces: 2 });

      results.updated = results.changes.length > 0;
      this.log(`Project update completed: ${results.changes.length} changes, ${results.warnings.length} warnings`);

      return results;

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to update project: ${error.message}`,
        'PROJECT_UPDATE_FAILED',
        { projectPath, updates, error: error.message }
      );
    }
  }

  /**
   * Delete project
   * @param {string} projectPath - Project path
   * @param {Object} options - Deletion options
   * @returns {Promise<boolean>} Deletion result
   */
  async deleteProject(projectPath, options = {}) {
    try {
      this.log(`Deleting project: ${projectPath}`);

      if (!await fs.pathExists(projectPath)) {
        throw new ProjectServiceError(
          `Project directory does not exist: ${projectPath}`,
          'PROJECT_NOT_FOUND'
        );
      }

      const { force = false, backup = true } = options;

      // Create backup if requested
      if (backup) {
        try {
          await this.backupProject(projectPath);
          this.log('Project backup created');
        } catch (error) {
          if (!force) {
            throw new ProjectServiceError(
              `Failed to create backup: ${error.message}`,
              'BACKUP_FAILED'
            );
          }
          this.log(`Backup failed, continuing with deletion: ${error.message}`, 'warn');
        }
      }

      // Confirm deletion if not forced
      if (!force) {
        // In a real CLI, this would prompt the user
        // For now, we'll proceed with deletion
      }

      // Delete project directory
      await fs.remove(projectPath);

      this.log(`Project deleted successfully: ${projectPath}`, 'success');
      return true;

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to delete project: ${error.message}`,
        'PROJECT_DELETION_FAILED',
        { projectPath, options, error: error.message }
      );
    }
  }

  /**
   * Get template package from registry or cache
   * @param {string} templateId - Template ID
   * @param {string} version - Template version
   * @returns {Promise<TemplatePackage|null>} Template package
   */
  async getTemplatePackage(templateId, version = 'latest') {
    try {
      const cacheKey = `${templateId}@${version}`;

      // Check cache first
      if (this.templateCache.has(cacheKey)) {
        this.log(`Using cached template: ${cacheKey}`);
        return this.templateCache.get(cacheKey);
      }

      // Use TemplateManager if available
      if (this.templateManager) {
        try {
          this.log(`Fetching template using TemplateManager: ${cacheKey}`);
          const template = await this.templateManager.getTemplate(templateId, {
            forceRefresh: false
          });

          if (template) {
            // Cache the template
            this.templateCache.set(cacheKey, template);
            this.log(`Template fetched and cached: ${cacheKey}`);
            return template;
          }
        } catch (error) {
          this.log(`TemplateManager fetch failed, falling back to NpmService: ${error.message}`, 'warn');
        }
      }

      // Use NpmService for npm-based templates
      if (templateId.startsWith('@xagi/') && this.npmService) {
        try {
          this.log(`Fetching npm template: ${cacheKey}`);
          const npmInfo = await this.npmService.getPackageInfo(templateId, version);

          if (npmInfo) {
            const templateData = {
              id: templateId,
              name: npmInfo.name || templateId,
              version: npmInfo.version || version,
              description: npmInfo.description || `Template: ${templateId}`,
              type: this.getTemplateTypeFromId(templateId),
              author: npmInfo.author || 'XAGI Team',
              keywords: npmInfo.keywords || ['template', 'ai', 'generator'],
              dependencies: npmInfo.dependencies || {},
              devDependencies: npmInfo.devDependencies || {},
              configSchema: this.getTemplateConfigSchema(templateId),
              supportedVersions: npmInfo.engines || ['^1.0.0'],
              createdAt: npmInfo.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              downloadCount: npmInfo.downloadCount || 0
            };

            const template = new TemplatePackage(templateData);
            this.templateCache.set(cacheKey, template);
            this.log(`Npm template fetched and cached: ${cacheKey}`);
            return template;
          }
        } catch (error) {
          this.log(`NpmService fetch failed: ${error.message}`, 'warn');
        }
      }

      // Use GitService for git-based templates
      if ((templateId.includes('github.com') || templateId.includes('gitlab.com')) && this.gitService) {
        try {
          this.log(`Fetching git template: ${cacheKey}`);
          const gitInfo = await this.gitService.getGitTemplateInfo(templateId, {
            branch: version === 'latest' ? undefined : version
          });

          if (gitInfo) {
            const templateData = {
              id: templateId,
              name: gitInfo.name || templateId,
              version: gitInfo.version || version,
              description: gitInfo.description || `Git template: ${templateId}`,
              type: this.getTemplateTypeFromId(templateId),
              author: gitInfo.author || 'Unknown',
              keywords: gitInfo.keywords || ['template', 'git'],
              dependencies: gitInfo.dependencies || {},
              devDependencies: gitInfo.devDependencies || {},
              configSchema: this.getTemplateConfigSchema(templateId),
              supportedVersions: ['^1.0.0'],
              createdAt: gitInfo.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              downloadCount: 0
            };

            const template = new TemplatePackage(templateData);
            this.templateCache.set(cacheKey, template);
            this.log(`Git template fetched and cached: ${cacheKey}`);
            return template;
          }
        } catch (error) {
          this.log(`GitService fetch failed: ${error.message}`, 'warn');
        }
      }

      // Fallback to simulated template if all services fail
      this.log(`Using fallback template simulation: ${cacheKey}`, 'warn');
      const templateData = {
        id: templateId,
        name: templateId.replace('@xagi/ai-template-', ''),
        version: version,
        description: `Template: ${templateId}`,
        type: this.getTemplateTypeFromId(templateId),
        author: 'XAGI Team',
        keywords: ['template', 'ai', 'generator'],
        dependencies: {},
        devDependencies: {},
        configSchema: this.getTemplateConfigSchema(templateId),
        supportedVersions: ['^1.0.0'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        downloadCount: 0
      };

      const template = new TemplatePackage(templateData);
      this.templateCache.set(cacheKey, template);
      return template;

    } catch (error) {
      this.log(`Failed to get template package: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Get template files for processing
   * @param {TemplatePackage} template - Template package
   * @returns {Promise<Array>} Template files
   */
  async getTemplateFiles(template) {
    try {
      this.log(`Getting template files for: ${template.id} (${template.type})`);

      // Try to get template files using TemplateManager first
      if (this.templateManager) {
        try {
          this.log(`Fetching template files using TemplateManager`);
          const templateFiles = await this.templateManager.getTemplateFiles(template.id, {
            version: template.version,
            includeHidden: false
          });

          if (templateFiles && templateFiles.length > 0) {
            this.log(`Retrieved ${templateFiles.length} files from TemplateManager`);
            return templateFiles;
          }
        } catch (error) {
          this.log(`TemplateManager failed to get files: ${error.message}`, 'warn');
        }
      }

      // Try to get template files using GitService for git-based templates
      if (template.id.includes('github.com') || template.id.includes('gitlab.com')) {
        if (this.gitService) {
          try {
            this.log(`Fetching git template files`);
            const gitFiles = await this.gitService.getRepositoryFiles(template.id, {
              branch: template.version === 'latest' ? undefined : template.version,
              includeHidden: false
            });

            if (gitFiles && gitFiles.length > 0) {
              this.log(`Retrieved ${gitFiles.length} files from GitService`);
              return gitFiles.map(file => ({
                path: file.path,
                type: this.getFileType(file.path),
                template: true,
                size: file.size,
                permissions: file.permissions,
                lastModified: file.lastModified
              }));
            }
          } catch (error) {
            this.log(`GitService failed to get files: ${error.message}`, 'warn');
          }
        }
      }

      // Fallback to template-specific file structure
      this.log(`Using fallback file structure for template type: ${template.type}`);
      return this.getFallbackTemplateFiles(template);

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to get template files: ${error.message}`,
        'TEMPLATE_FILES_ERROR',
        { templateId: template.id, error: error.message }
      );
    }
  }

  /**
   * Get fallback template files based on template type
   * @param {TemplatePackage} template - Template package
   * @returns {Array<Object>} Template files
   * @private
   */
  getFallbackTemplateFiles(template) {
    const baseFiles = [
      { path: 'package.json', type: 'json', template: true },
      { path: 'README.md', type: 'markdown', template: true },
      { path: '.gitignore', type: 'text', template: true },
      { path: 'LICENSE', type: 'text', template: true }
    ];

    // Add template-specific files
    switch (template.type) {
      case 'react-next':
        return [
          ...baseFiles,
          { path: 'pages/index.js', type: 'javascript', template: true },
          { path: 'pages/_app.js', type: 'javascript', template: true },
          { path: 'components/App.js', type: 'javascript', template: true },
          { path: 'styles/globals.css', type: 'css', template: true },
          { path: 'next.config.js', type: 'javascript', template: true },
          { path: 'public/favicon.ico', type: 'binary', template: true },
          { path: 'public/vercel.svg', type: 'binary', template: true }
        ];
      case 'node-api':
        return [
          ...baseFiles,
          { path: 'server.js', type: 'javascript', template: true },
          { path: 'routes/index.js', type: 'javascript', template: true },
          { path: 'routes/users.js', type: 'javascript', template: true },
          { path: 'middleware/logger.js', type: 'javascript', template: true },
          { path: 'middleware/auth.js', type: 'javascript', template: true },
          { path: 'controllers/userController.js', type: 'javascript', template: true },
          { path: 'models/userModel.js', type: 'javascript', template: true },
          { path: 'config/database.js', type: 'javascript', template: true },
          { path: 'tests/user.test.js', type: 'javascript', template: true }
        ];
      case 'vue-app':
        return [
          ...baseFiles,
          { path: 'src/App.vue', type: 'vue', template: true },
          { path: 'src/main.js', type: 'javascript', template: true },
          { path: 'src/components/HelloWorld.vue', type: 'vue', template: true },
          { path: 'src/components/TheHeader.vue', type: 'vue', template: true },
          { path: 'src/assets/logo.png', type: 'binary', template: true },
          { path: 'src/router/index.js', type: 'javascript', template: true },
          { path: 'src/store/index.js', type: 'javascript', template: true },
          { path: 'vue.config.js', type: 'javascript', template: true },
          { path: 'public/index.html', type: 'html', template: true }
        ];
      default:
        return baseFiles;
    }
  }

  /**
   * Get file type from file path
   * @param {string} filePath - File path
   * @returns {string} File type
   * @private
   */
  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.vue': 'vue',
      '.json': 'json',
      '.md': 'markdown',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.html': 'html',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.txt': 'text',
      '.sh': 'shell',
      '.bat': 'batch',
      '.ps1': 'powershell',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'header',
      '.hpp': 'header',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.dart': 'dart',
      '.png': 'binary',
      '.jpg': 'binary',
      '.jpeg': 'binary',
      '.gif': 'binary',
      '.svg': 'binary',
      '.ico': 'binary',
      '.pdf': 'binary',
      '.zip': 'binary',
      '.tar': 'binary',
      '.gz': 'binary',
      '.bz2': 'binary'
    };

    return typeMap[ext] || 'text';
  }

  /**
   * Generate a single file from template
   * @param {Object} templateFile - Template file info
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {Promise<Object>} Generated file info
   */
  async generateFile(templateFile, template, config) {
    try {
      const targetPath = path.join(config.projectPath, templateFile.path);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(targetPath));

      let content = '';

      // Generate content based on file type
      switch (templateFile.type) {
      case 'json':
        content = this.generateJsonContent(templateFile, template, config);
        break;
      case 'markdown':
        content = this.generateMarkdownContent(templateFile, template, config);
        break;
      case 'javascript':
        content = this.generateJavaScriptContent(templateFile, template, config);
        break;
      case 'css':
        content = this.generateCssContent(templateFile, template, config);
        break;
      case 'vue':
        content = this.generateVueContent(templateFile, template, config);
        break;
      default:
        content = this.generateTextContent(templateFile, template, config);
      }

      // Write file
      await fs.writeFile(targetPath, content);

      return {
        path: templateFile.path,
        size: Buffer.byteLength(content, 'utf8'),
        type: templateFile.type,
        content: content
      };

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to generate file ${templateFile.path}: ${error.message}`,
        'FILE_GENERATION_ERROR',
        { templateFile, error: error.message }
      );
    }
  }

  /**
   * Build variable map for template processing
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {Object} Variable map
   */
  buildVariableMap(template, config) {
    const variables = {
      // Project variables
      PROJECT_NAME: config.projectName,
      PROJECT_NAME_CAMEL: this.toCamelCase(config.projectName),
      PROJECT_NAME_PASCAL: this.toPascalCase(config.projectName),
      PROJECT_NAME_KEBAB: this.toKebabCase(config.projectName),
      PROJECT_NAME_SNAKE: this.toSnakeCase(config.projectName),
      PROJECT_NAME_UPPER: config.projectName.toUpperCase(),

      // Template variables
      TEMPLATE_ID: template.id,
      TEMPLATE_NAME: template.name,
      TEMPLATE_TYPE: template.type,
      TEMPLATE_VERSION: template.version,

      // Configuration variables
      ...config.configValues,
      ...config.overrides,

      // System variables
      CURRENT_YEAR: new Date().getFullYear(),
      CURRENT_DATE: new Date().toISOString().split('T')[0],
      CURRENT_TIMESTAMP: new Date().toISOString(),

      // Author variables
      AUTHOR_NAME: config.configValues.author || 'Unknown Author',
      AUTHOR_EMAIL: config.configValues.email || ''
    };

    return variables;
  }

  /**
   * Process variables in a file
   * @param {string} filePath - File path
   * @param {Object} variableMap - Variable map
   * @returns {Promise<void>}
   */
  async processFileVariables(filePath, variableMap) {
    try {
      let content = await fs.readFile(filePath, 'utf8');

      // Replace variables in format {{VARIABLE_NAME}}
      for (const [key, value] of Object.entries(variableMap)) {
        const pattern = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(pattern, String(value));
      }

      // Replace variables in format <%= variableName %>
      for (const [key, value] of Object.entries(variableMap)) {
        const pattern = new RegExp(`<%=\\s*${key}\\s*%>`, 'g');
        content = content.replace(pattern, String(value));
      }

      await fs.writeFile(filePath, content);

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to process variables in file ${filePath}: ${error.message}`,
        'VARIABLE_PROCESSING_ERROR',
        { filePath, error: error.message }
      );
    }
  }

  /**
   * Install dependencies for project
   * @param {string} projectPath - Project path
   * @param {TemplatePackage} template - Template package
   * @returns {Promise<void>}
   */
  async installDependencies(projectPath, template) {
    try {
      const allDependencies = {
        ...template.dependencies,
        ...template.devDependencies
      };

      if (Object.keys(allDependencies).length === 0) {
        this.log('No dependencies to install');
        return;
      }

      this.log(`Installing ${Object.keys(allDependencies).length} dependencies for ${template.type}`);

      // Use NpmService if available for enhanced dependency management
      if (this.npmService) {
        try {
          this.log('Using NpmService for enhanced dependency installation');
          await this.npmService.installDependencies(projectPath, {
            dependencies: template.dependencies,
            devDependencies: template.devDependencies,
            templateType: template.type,
            verbose: this.verbose
          });
          this.log('Dependencies installed successfully via NpmService');
          return;
        } catch (error) {
          this.log(`NpmService failed, falling back to npm: ${error.message}`, 'warn');
        }
      }

      // Fallback to npm install
      this.log('Using npm install for dependency installation');
      await this.performNpmInstall(projectPath, allDependencies);

      this.log('Dependencies installed successfully');

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to install dependencies: ${error.message}`,
        'DEPENDENCY_INSTALL_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Perform npm install with enhanced error handling
   * @param {string} projectPath - Project path
   * @param {Object} dependencies - Dependencies to install
   * @returns {Promise<void>}
   * @private
   */
  async performNpmInstall(projectPath, dependencies) {
    try {
      // Check if npm is available
      await execa('npm', ['--version'], { stdio: 'pipe' });

      // Install dependencies
      const installArgs = ['install', '--no-audit'];

      // Install all dependencies at once
      const dependencyArgs = Object.entries(dependencies)
        .map(([pkg, version]) => `${pkg}@${version}`);

      if (dependencyArgs.length > 0) {
        await execa('npm', [...installArgs, ...dependencyArgs], {
          cwd: projectPath,
          stdio: this.verbose ? 'inherit' : 'pipe'
        });
      }

      // Run npm audit fix if available
      try {
        await execa('npm', ['audit', 'fix'], {
          cwd: projectPath,
          stdio: 'pipe'
        });
        this.log('Security audit completed');
      } catch (auditError) {
        this.log(`Security audit failed: ${auditError.message}`, 'warn');
      }

    } catch (error) {
      throw new ProjectServiceError(
        `npm install failed: ${error.message}`,
        'NPM_INSTALL_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Update dependencies for project
   * @param {string} projectPath - Project path
   * @param {Object} dependencies - Dependencies to update
   * @returns {Promise<void>}
   */
  async updateDependencies(projectPath, dependencies) {
    try {
      const dependencyArgs = Object.entries(dependencies)
        .map(([pkg, version]) => `${pkg}@${version}`);

      if (dependencyArgs.length === 0) {
        return;
      }

      this.log(`Updating ${dependencyArgs.length} dependencies`);

      await execa('npm', ['install', ...dependencyArgs], {
        cwd: projectPath,
        stdio: this.verbose ? 'inherit' : 'pipe'
      });

      this.log('Dependencies updated successfully');

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to update dependencies: ${error.message}`,
        'DEPENDENCY_UPDATE_FAILED',
        { dependencies, error: error.message }
      );
    }
  }

  /**
   * Check directory permissions
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   */
  async checkDirectoryPermissions(dirPath) {
    try {
      // Try to create a test file
      const testFile = path.join(dirPath, '.permission-test');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);

      this.log('Directory permissions check passed');

    } catch (error) {
      throw new ProjectServiceError(
        `Insufficient permissions for directory: ${error.message}`,
        'PERMISSION_ERROR',
        { dirPath, error: error.message }
      );
    }
  }

  /**
   * Get project files
   * @param {string} projectPath - Project path
   * @returns {Promise<Array>} List of files
   */
  async getProjectFiles(projectPath) {
    try {
      const pattern = path.join(projectPath, '**/*');
      const files = await globAsync(pattern, {
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/coverage/**']
      });

      return files.map(file => path.relative(projectPath, file));

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to get project files: ${error.message}`,
        'FILE_LIST_ERROR',
        { projectPath, error: error.message }
      );
    }
  }

  /**
   * Get directory size
   * @param {string} dirPath - Directory path
   * @returns {Promise<number>} Directory size in bytes
   */
  async getDirectorySize(dirPath) {
    try {
      const files = await globAsync(path.join(dirPath, '**/*'), { nodir: true });
      let totalSize = 0;

      for (const file of files) {
        const stats = await fs.stat(file);
        totalSize += stats.size;
      }

      return totalSize;

    } catch (error) {
      this.log(`Failed to calculate directory size: ${error.message}`, 'warn');
      return 0;
    }
  }

  /**
   * Check for security issues in project
   * @param {string} projectPath - Project path
   * @param {Array} errors - Errors array to append to
   * @param {Array} warnings - Warnings array to append to
   * @returns {Promise<void>}
   */
  async checkSecurityIssues(projectPath, errors, warnings) {
    try {
      // Check for hardcoded secrets
      const secretPatterns = [
        /password\s*=\s*["'].*?["']/i,
        /api_key\s*=\s*["'].*?["']/i,
        /secret\s*=\s*["'].*?["']/i,
        /token\s*=\s*["'].*?["']/i
      ];

      const files = await this.getProjectFiles(projectPath);

      for (const file of files) {
        if (file.includes('node_modules') || file.includes('.git')) {continue;}

        try {
          const content = await fs.readFile(path.join(projectPath, file), 'utf8');

          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              warnings.push(`Potential hardcoded secret found in ${file}`);
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

    } catch (error) {
      this.log(`Security check failed: ${error.message}`, 'warn');
    }
  }

  /**
   * Backup project before deletion
   * @param {string} projectPath - Project path
   * @returns {Promise<string>} Backup path
   */
  async backupProject(projectPath) {
    try {
      const backupDir = path.join(path.dirname(projectPath), '.backups');
      await fs.ensureDir(backupDir);

      const projectName = path.basename(projectPath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${projectName}-backup-${timestamp}`;
      const backupPath = path.join(backupDir, backupName);

      await fs.copy(projectPath, backupPath);

      this.log(`Project backup created: ${backupPath}`);
      return backupPath;

    } catch (error) {
      throw new ProjectServiceError(
        `Failed to backup project: ${error.message}`,
        'BACKUP_ERROR',
        { projectPath, error: error.message }
      );
    }
  }

  /**
   * Cleanup failed project creation
   * @param {string} projectPath - Project path
   * @returns {Promise<void>}
   */
  async cleanupFailedProject(projectPath) {
    try {
      if (await fs.pathExists(projectPath)) {
        await fs.remove(projectPath);
        this.log(`Cleaned up failed project: ${projectPath}`);
      }
    } catch (error) {
      this.log(`Failed to cleanup project: ${error.message}`, 'warn');
    }
  }

  /**
   * Get template type from template ID
   * @param {string} templateId - Template ID
   * @returns {string} Template type
   */
  getTemplateTypeFromId(templateId) {
    const match = templateId.match(/^@xagi\/ai-template-(.+)$/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Get template config schema
   * @param {string} templateId - Template ID
   * @returns {Object} Config schema
   */
  getTemplateConfigSchema(templateId) {
    const templateType = this.getTemplateTypeFromId(templateId);

    // Basic schema that can be extended based on template type
    const baseSchema = {
      type: 'object',
      properties: {
        author: {
          type: 'string',
          description: 'Project author name'
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'Author email address'
        },
        description: {
          type: 'string',
          description: 'Project description'
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+$',
          description: 'Project version'
        }
      },
      required: ['author']
    };

    // Add template-specific properties
    if (templateType === 'react-next') {
      baseSchema.properties.useTypescript = {
        type: 'boolean',
        default: false,
        description: 'Use TypeScript'
      };
      baseSchema.properties.useTailwind = {
        type: 'boolean',
        default: false,
        description: 'Use Tailwind CSS'
      };
    } else if (templateType === 'node-api') {
      baseSchema.properties.port = {
        type: 'integer',
        minimum: 1,
        maximum: 65535,
        default: 3000,
        description: 'Server port'
      };
      baseSchema.properties.database = {
        type: 'string',
        enum: ['none', 'mongodb', 'postgresql', 'mysql'],
        default: 'none',
        description: 'Database type'
      };
    } else if (templateType === 'vue-app') {
      baseSchema.properties.useVuex = {
        type: 'boolean',
        default: false,
        description: 'Use Vuex for state management'
      };
      baseSchema.properties.useVueRouter = {
        type: 'boolean',
        default: true,
        description: 'Use Vue Router'
      };
    }

    return baseSchema;
  }

  /**
   * Generate JSON content
   * @param {Object} templateFile - Template file info
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {string} Generated content
   */
  generateJsonContent(templateFile, template, config) {
    if (templateFile.path === 'package.json') {
      const packageJson = {
        name: config.projectName,
        version: '1.0.0',
        description: config.configValues.description || `${config.projectName} project`,
        main: 'src/index.js',
        scripts: {
          start: 'node src/index.js',
          dev: 'nodemon src/index.js',
          test: 'jest',
          build: 'echo "No build step required"'
        },
        keywords: [template.type, 'generated', 'xagi'],
        author: config.configValues.author || 'Unknown Author',
        license: 'MIT',
        dependencies: template.dependencies,
        devDependencies: template.devDependencies
      };

      return JSON.stringify(packageJson, null, 2);
    }

    return '{}';
  }

  /**
   * Generate markdown content
   * @param {Object} templateFile - Template file info
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {string} Generated content
   */
  generateMarkdownContent(templateFile, template, config) {
    if (templateFile.path === 'README.md') {
      return `# ${config.projectName}

${config.configValues.description || `${config.projectName} project generated from ${template.name}`}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## License

MIT

---

Generated with [XAGI AI Project Template](${template.id}@${template.version})
`;
    }

    return '';
  }

  /**
   * Generate JavaScript content
   * @param {Object} templateFile - Template file info
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {string} Generated content
   */
  generateJavaScriptContent(templateFile, template, config) {
    if (templateFile.path === 'src/index.js') {
      return `/**
 * ${config.projectName}
 * Entry point for the application
 */

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ${config.projectName}',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(\`${config.projectName} server running on port \${port}\`);
});

module.exports = app;
`;
    }

    return '';
  }

  /**
   * Generate CSS content
   * @param {Object} templateFile - Template file info
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {string} Generated content
   */
  generateCssContent(templateFile, template, config) {
    return `/* ${config.projectName} - Generated Styles */

/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f5f5f5;
}

/* Layout */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Components */
.header {
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 1rem 0;
}

.footer {
  background-color: #333;
  color: #fff;
  text-align: center;
  padding: 2rem 0;
  margin-top: 2rem;
}

/* Utilities */
.text-center {
  text-align: center;
}

.mt-1 { margin-top: 1rem; }
.mt-2 { margin-top: 2rem; }
.mb-1 { margin-bottom: 1rem; }
.mb-2 { margin-bottom: 2rem; }
`;
  }

  /**
   * Generate Vue content
   * @param {Object} templateFile - Template file info
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {string} Generated content
   */
  generateVueContent(templateFile, template, config) {
    if (templateFile.path === 'src/App.vue') {
      return String.raw`<template>
  <div id="app">
    <div class="container">
      <header class="header">
        <h1>{{ projectName }}</h1>
        <p>{{ description }}</p>
      </header>

      <main class="main">
        <HelloWorld msg="Welcome to Your Vue.js App"/>
      </main>

      <footer class="footer">
        <p>Generated with XAGI AI Template</p>
      </footer>
    </div>
  </div>
</template>

<script>
import HelloWorld from './components/HelloWorld.vue'

export default {
  name: 'App',
  components: {
    HelloWorld
  },
  data() {
    return {
      projectName: '${config.projectName}',
      description: '${config.configValues.description || 'Generated project'}'
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.main {
  padding: 2rem 0;
}

.footer {
  margin-top: 4rem;
  padding: 2rem 0;
  background-color: #f8f9fa;
  text-align: center;
  color: #6c757d;
}
</style>
`;
    }

    return '';
  }

  /**
   * Generate text content
   * @param {Object} templateFile - Template file info
   * @param {TemplatePackage} template - Template package
   * @param {ProjectConfiguration} config - Project configuration
   * @returns {string} Generated content
   */
  generateTextContent(templateFile, template, config) {
    if (templateFile.path === '.gitignore') {
      return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Grunt intermediate storage
.grunt

# Bower dependency directory
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
jspm_packages/

# TypeScript v1 declaration files
typings/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test

# parcel-bundler cache
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# XAGI specific
.xagi-project.json
.backups/
`;
    }

    return '';
  }

  /**
   * Convert string to camelCase
   * @param {string} str - Input string
   * @returns {string} camelCase string
   */
  toCamelCase(str) {
    return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
  }

  /**
   * Convert string to PascalCase
   * @param {string} str - Input string
   * @returns {string} PascalCase string
   */
  toPascalCase(str) {
    const camelCase = this.toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }

  /**
   * Convert string to kebab-case
   * @param {string} str - Input string
   * @returns {string} kebab-case string
   */
  toKebabCase(str) {
    return str.replace(/[\s_]+/g, '-').toLowerCase();
  }

  /**
   * Convert string to snake_case
   * @param {string} str - Input string
   * @returns {string} snake_case string
   */
  toSnakeCase(str) {
    return str.replace(/[\s-]+/g, '_').toLowerCase();
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    try {
      const services = {
        templateManager: null,
        npmService: null,
        gitService: null,
        filesystem: null,
        npm: null
      };

      // Check TemplateManager
      if (this.templateManager) {
        try {
          services.templateManager = await this.checkTemplateManagerHealth();
        } catch (error) {
          services.templateManager = { error: error.message };
        }
      }

      // Check NpmService
      if (this.npmService) {
        try {
          services.npmService = await this.checkNpmServiceHealth();
        } catch (error) {
          services.npmService = { error: error.message };
        }
      }

      // Check GitService
      if (this.gitService) {
        try {
          services.gitService = await this.checkGitServiceHealth();
        } catch (error) {
          services.gitService = { error: error.message };
        }
      }

      // Check filesystem access
      try {
        await fs.ensureDir(this.projectsDir);
        await fs.ensureDir(this.templatesDir);
        services.filesystem = { status: 'healthy', accessible: true };
      } catch (error) {
        services.filesystem = { status: 'error', error: error.message };
      }

      // Check npm availability
      try {
        const npmVersion = await execa('npm', ['--version'], { stdio: 'pipe' });
        services.npm = { status: 'healthy', version: npmVersion.stdout.trim() };
      } catch (error) {
        services.npm = { status: 'error', error: error.message };
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Check TemplateManager health
   * @returns {Promise<Object>} Health status
   * @private
   */
  async checkTemplateManagerHealth() {
    try {
      // Test template listing
      const templates = await this.templateManager.listTemplates();
      return {
        status: 'healthy',
        templateCount: templates.length,
        cacheEnabled: this.templateManager.enableCache,
        cacheDir: this.templateManager.cacheDir
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Check NpmService health
   * @returns {Promise<Object>} Health status
   * @private
   */
  async checkNpmServiceHealth() {
    try {
      // Test npm registry connectivity
      const testPackage = await this.npmService.getPackageInfo('npm', 'latest');
      return {
        status: 'healthy',
        registry: this.npmService._registryUrl,
        authenticated: !!this.npmService._authToken,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Check GitService health
   * @returns {Promise<Object>} Health status
   * @private
   */
  async checkGitServiceHealth() {
    try {
      // Test git availability
      const gitVersion = await execa('git', ['--version'], { stdio: 'pipe' });
      return {
        status: 'healthy',
        gitVersion: gitVersion.stdout.trim(),
        available: true
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Get template compatibility matrix
   * @returns {Object} Compatibility matrix
   */
  getTemplateCompatibility() {
    return {
      supportedTemplateTypes: this.supportedTemplateTypes,
      supportedFileTypes: [
        'javascript', 'typescript', 'jsx', 'tsx', 'vue', 'json',
        'markdown', 'css', 'scss', 'html', 'xml', 'yaml', 'text',
        'binary', 'shell', 'python', 'java', 'go', 'rust'
      ],
      dependencyManagers: ['npm', 'yarn', 'pnpm'],
      gitProviders: ['github.com', 'gitlab.com', 'bitbucket.org'],
      npmRegistries: [
        'registry.npmjs.org',
        'private registries via .npmrc'
      ]
    };
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      templateCacheSize: this.templateCache.size,
      supportedTemplateTypes: this.supportedTemplateTypes,
      projectsDir: this.projectsDir,
      templatesDir: this.templatesDir,
      registry: this.registry,
      verbose: this.verbose,
      services: {
        templateManager: !!this.templateManager,
        npmService: !!this.npmService,
        gitService: !!this.gitService
      }
    };
  }
}

module.exports = {
  ProjectService,
  ProjectServiceError,
  ProgressTracker
};
