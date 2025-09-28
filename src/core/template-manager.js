/**
 * TemplateManager Service
 *
 * Central service that coordinates all template operations across multiple registries.
 * Provides unified interface for template discovery, validation, download, and installation.
 * Supports both npm-based and git-based templates with comprehensive caching and error handling.
 */

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const simpleGit = require('simple-git');
const axios = require('axios');
const glob = require('glob');
const tempy = require('tempy');
const ora = require('ora');

const TemplatePackage = require('../models/template');
const TemplateRegistry = require('../models/registry');
const CacheStore = require('../models/cache');
const CacheManager = require('./cache-manager');
const TemplateValidator = require('./template-validator');
const RegistryManager = require('./registry-manager');
const NpmService = require('../services/npm-service');
const { validateFilePath, validateGitUrl } = require('../utils/validation');
const Logger = require('./logger');
const { ServiceError, ValidationError, FileSystemError } = require('./error-handler');

const execAsync = promisify(exec);

/**
 * TemplateManager Service Class
 *
 * Manages template operations across multiple registries with caching,
 * validation, and installation capabilities.
 */
class TemplateManager {
  /**
   * Create a new TemplateManager instance
   * @param {Object} options - Configuration options
   * @param {Array<TemplateRegistry>} options.registries - Array of template registries
   * @param {string} options.cacheDir - Directory for template caching
   * @param {number} options.cacheTTL - Cache time-to-live in milliseconds
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.enableCache - Whether to enable caching
   * @param {CacheManager} options.cacheManager - External CacheManager instance
   */
  constructor(options = {}) {
    /**
     * Array of template registries
     * @type {Array<TemplateRegistry>}
     */
    this.registries = options.registries || [];

    /**
     * Cache directory for templates
     * @type {string}
     */
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.template-cache');

    /**
     * Cache time-to-live in milliseconds
     * @type {number}
     */
    this.cacheTTL = options.cacheTTL || 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Logger instance
     * @type {Object}
     */
    this.logger = options.logger || this.createDefaultLogger();

    /**
     * Whether caching is enabled
     * @type {boolean}
     */
    this.enableCache = options.enableCache !== false;

    /**
     * CacheManager instance for enhanced caching operations
     * @type {CacheManager}
     */
    this.cacheManager = options.cacheManager || null;

    /**
     * TemplateValidator instance for comprehensive template validation
     * @type {TemplateValidator}
     */
    this.templateValidator = new TemplateValidator({
      logger: this.logger,
      cacheManager: this.cacheManager
    });

    /**
     * RegistryManager instance for private registry management
     * @type {RegistryManager}
     */
    this.registryManager = new RegistryManager({
      configDir: options.configDir,
      logger: this.logger,
      enableEncryption: options.enableEncryption !== false
    });

    /**
     * Cache store instances (legacy, for backward compatibility)
     * @type {Map<string, CacheStore>}
     */
    this.cacheStore = new Map();

    /**
     * Template package instances
     * @type {Map<string, TemplatePackage>}
     */
    this.templatePackages = new Map();

    /**
     * Operation statistics
     * @type {Object}
     */
    this.stats = {
      templatesListed: 0,
      templatesDownloaded: 0,
      templatesInstalled: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };

    // Initialize the template manager
    this.initialize();
  }

  /**
   * Initialize the template manager
   * @private
   */
  initialize() {
    // Initialize CacheManager if not provided
    if (this.enableCache && !this.cacheManager) {
      this.cacheManager = new CacheManager({
        cacheDir: this.cacheDir,
        ttl: this.cacheTTL,
        enableMetrics: true,
        persistent: true
      });
    }

    // Ensure cache directory exists
    if (this.enableCache) {
      this.ensureCacheDirectory();
    }

    // Initialize default registries if none provided
    if (this.registries.length === 0) {
      this.initializeDefaultRegistries();
    }

    this.logger.info('TemplateManager initialized', {
      registries: this.registries.length,
      cacheEnabled: this.enableCache,
      cacheDir: this.cacheDir,
      hasCacheManager: !!this.cacheManager
    });
  }

  /**
   * Create default logger
   * @private
   * @returns {Object} Logger instance
   */
  createDefaultLogger() {
    return Logger.create('TemplateManager', {
      enableConsole: true,
      enableFile: false,
      level: 'info'
    });
  }

  /**
   * Initialize default registries
   * @private
   */
  initializeDefaultRegistries() {
    const defaultRegistries = [
      new TemplateRegistry({
        id: 'npm-public',
        name: 'NPM Public Registry',
        url: 'https://registry.npmjs.org',
        type: 'public',
        authRequired: false,
        cachePolicy: 'default'
      }),
      new TemplateRegistry({
        id: 'github-templates',
        name: 'GitHub Templates',
        url: 'https://api.github.com',
        type: 'public',
        authRequired: false,
        cachePolicy: 'default'
      })
    ];

    this.registries = defaultRegistries;
  }

  /**
   * Ensure cache directory exists
   * @private
   */
  async ensureCacheDirectory() {
    try {
      await fs.ensureDir(this.cacheDir);
      this.logger.debug('Cache directory ensured', { path: this.cacheDir });
    } catch (error) {
      this.logger.error('Failed to create cache directory', { error: error.message });
      throw new Error(`Failed to create cache directory: ${error.message}`);
    }
  }

  /**
   * List available templates from all registries
   * @param {Object} options - Listing options
   * @param {string} options.type - Filter by template type
   * @param {string} options.registry - Filter by registry ID
   * @param {boolean} options.forceRefresh - Force refresh from registries
   * @param {number} options.limit - Limit number of results
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<Object>} List of templates with metadata
   */
  async listTemplates(options = {}) {
    const {
      type = null,
      registry = null,
      forceRefresh = false,
      limit = 50,
      offset = 0
    } = options;

    try {
      this.logger.info('Listing templates', { type, registry, forceRefresh, limit, offset });

      let allTemplates = [];
      const errors = [];

      // Get templates from each registry
      for (const registryInstance of this.registries) {
        if (registry && registryInstance.id !== registry) {
          continue;
        }

        try {
          const registryTemplates = await this.getTemplatesFromRegistry(registryInstance, {
            forceRefresh,
            type
          });

          allTemplates = allTemplates.concat(registryTemplates);
          this.logger.debug(`Retrieved ${registryTemplates.length} templates from ${registryInstance.name}`);
        } catch (error) {
          errors.push({
            registry: registryInstance.id,
            error: error.message
          });
          this.logger.error(`Failed to get templates from ${registryInstance.name}`, { error: error.message });
        }
      }

      // Apply filters
      let filteredTemplates = allTemplates;
      if (type) {
        filteredTemplates = filteredTemplates.filter(template => template.type === type);
      }

      // Apply pagination
      const total = filteredTemplates.length;
      const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);

      // Update statistics
      this.stats.templatesListed += paginatedTemplates.length;

      this.logger.info('Templates listed successfully', {
        total,
        returned: paginatedTemplates.length,
        filters: { type, registry },
        errors: errors.length
      });

      return {
        templates: paginatedTemplates,
        metadata: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
          filters: { type, registry },
          registries: this.registries.map(r => ({ id: r.id, name: r.name, type: r.type })),
          errors: errors.length > 0 ? errors : undefined
        }
      };
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to list templates', { error: error.message });
      throw new Error(`Failed to list templates: ${error.message}`);
    }
  }

  /**
   * Get templates from a specific registry
   * @private
   * @param {TemplateRegistry} registry - Registry instance
   * @param {Object} options - Options
   * @returns {Promise<Array>} Array of templates
   */
  async getTemplatesFromRegistry(registry, options = {}) {
    const { forceRefresh = false, type = null } = options;

    // Check cache first
    const cacheKey = `templates_${registry.id}_${type || 'all'}`;
    if (!forceRefresh && this.enableCache) {
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    this.stats.cacheMisses++;

    // Get templates from registry
    const templates = await registry.getTemplates({ forceRefresh });

    // Convert to TemplatePackage instances
    const templatePackages = templates.map(templateData => {
      const templatePackage = new TemplatePackage(templateData);
      this.templatePackages.set(templatePackage.id, templatePackage);
      return templatePackage;
    });

    // Cache the results
    if (this.enableCache) {
      await this.setCachedData(cacheKey, templatePackages);
    }

    return templatePackages;
  }

  /**
   * Get specific template by ID
   * @param {string} templateId - Template ID
   * @param {Object} options - Options
   * @param {boolean} options.forceRefresh - Force refresh from registry
   * @returns {Promise<TemplatePackage>} Template package instance
   */
  async getTemplate(templateId, options = {}) {
    const { forceRefresh = false } = options;

    if (!templateId) {
      throw new Error('Template ID is required');
    }

    try {
      this.logger.info('Getting template', { templateId, forceRefresh });

      // Check cache first
      if (!forceRefresh && this.templatePackages.has(templateId)) {
        const cachedTemplate = this.templatePackages.get(templateId);
        this.logger.debug('Template found in cache', { templateId });
        return cachedTemplate;
      }

      // Search in all registries
      for (const registry of this.registries) {
        try {
          const templates = await this.getTemplatesFromRegistry(registry, { forceRefresh });
          const template = templates.find(t => t.id === templateId);

          if (template) {
            this.templatePackages.set(templateId, template);
            this.logger.info('Template found', { templateId, registry: registry.id });
            return template;
          }
        } catch (error) {
          this.logger.warn(`Failed to search in registry ${registry.id}`, { error: error.message });
        }
      }

      throw new Error(`Template not found: ${templateId}`);
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to get template', { templateId, error: error.message });
      throw new Error(`Failed to get template ${templateId}: ${error.message}`);
    }
  }

  /**
   * Search templates by name or keywords
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} options.type - Filter by template type
   * @param {string} options.registry - Filter by registry ID
   * @param {boolean} options.forceRefresh - Force refresh from registries
   * @param {number} options.limit - Limit number of results
   * @returns {Promise<Array>} Array of matching templates
   */
  async searchTemplates(query, options = {}) {
    const {
      type = null,
      registry = null,
      forceRefresh = false,
      limit = 20
    } = options;

    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required and must be a string');
    }

    try {
      this.logger.info('Searching templates', { query, type, registry, forceRefresh, limit });

      // Get all templates (with filters)
      const allTemplates = await this.listTemplates({
        type,
        registry,
        forceRefresh,
        limit: 1000 // Get more for better search results
      });

      // Search in templates
      const searchQuery = query.toLowerCase();
      const results = allTemplates.templates.filter(template => {
        const nameMatch = template.name.toLowerCase().includes(searchQuery);
        const descriptionMatch = template.description.toLowerCase().includes(searchQuery);
        const keywordsMatch = template.keywords.some(keyword =>
          keyword.toLowerCase().includes(searchQuery)
        );
        const idMatch = template.id.toLowerCase().includes(searchQuery);

        return nameMatch || descriptionMatch || keywordsMatch || idMatch;
      });

      // Sort by relevance (name matches first, then description, then keywords)
      const sortedResults = results.sort((a, b) => {
        const aNameMatch = a.name.toLowerCase().includes(searchQuery);
        const bNameMatch = b.name.toLowerCase().includes(searchQuery);

        if (aNameMatch && !bNameMatch) {return -1;}
        if (!aNameMatch && bNameMatch) {return 1;}

        return 0;
      });

      const finalResults = sortedResults.slice(0, limit);

      this.logger.info('Template search completed', {
        query,
        results: finalResults.length,
        total: allTemplates.templates.length
      });

      return finalResults;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to search templates', { query, error: error.message });
      throw new Error(`Failed to search templates: ${error.message}`);
    }
  }

  /**
   * Download template package
   * @param {string} templateId - Template ID
   * @param {string} version - Template version
   * @param {Object} options - Download options
   * @param {boolean} options.forceDownload - Force re-download even if cached
   * @param {string} options.destination - Custom destination path
   * @returns {Promise<Object>} Download result with path and metadata
   */
  async downloadTemplate(templateId, version = 'latest', options = {}) {
    const { forceDownload = false, destination = null } = options;

    if (!templateId) {
      throw new Error('Template ID is required');
    }

    try {
      const spinner = ora(`Downloading template ${templateId}@${version}`).start();

      this.logger.info('Downloading template', { templateId, version, forceDownload });

      spinner.text = 'Getting template information...';
      // Get template information
      const template = await this.getTemplate(templateId);

      // Check cache first
      spinner.text = 'Checking cache...';
      const cacheKey = `${templateId}_${version}`;
      if (!forceDownload && this.enableCache) {
        const cachedPath = await this.getCachedTemplatePath(templateId, version);
        if (cachedPath) {
          this.stats.cacheHits++;
          this.logger.info('Template found in cache', { templateId, version, path: cachedPath });
          spinner.succeed('Template loaded from cache');
          return {
            success: true,
            path: cachedPath,
            template: template.toJSON(),
            cached: true,
            message: 'Template loaded from cache'
          };
        }
      }

      this.stats.cacheMisses++;

      // Download template
      spinner.text = 'Preparing download...';
      const downloadPath = destination || await this.getTemplateDownloadPath(templateId, version);

      if (templateId.startsWith('@xagi/')) {
        // NPM-based template
        spinner.text = 'Downloading NPM template...';
        await this.downloadNpmTemplate(templateId, version, downloadPath);
      } else if (templateId.includes('github.com') || templateId.includes('gitlab.com')) {
        // Git-based template
        spinner.text = 'Downloading Git template...';
        await this.downloadGitTemplate(templateId, version, downloadPath);
      } else {
        throw new Error(`Unsupported template type: ${templateId}`);
      }

      // Validate downloaded template
      spinner.text = 'Validating downloaded template...';
      await this.validateDownloadedTemplate(downloadPath, template);

      // Cache the template
      if (this.enableCache) {
        spinner.text = 'Caching template...';
        await this.cacheDownloadedTemplate(templateId, version, downloadPath);
      }

      this.stats.templatesDownloaded++;
      this.logger.info('Template downloaded successfully', {
        templateId,
        version,
        path: downloadPath
      });

      spinner.succeed(`Template downloaded successfully: ${templateId}@${version}`);

      return {
        success: true,
        path: downloadPath,
        template: template.toJSON(),
        cached: false,
        message: 'Template downloaded successfully'
      };
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to download template', {
        templateId,
        version,
        error: error.message
      });
      throw new Error(`Failed to download template ${templateId}: ${error.message}`);
    }
  }

  /**
   * Download NPM-based template
   * @private
   * @param {string} templateId - Template ID
   * @param {string} version - Template version
   * @param {string} downloadPath - Download path
   */
  async downloadNpmTemplate(templateId, version, downloadPath) {
    try {
      // Clean existing directory
      await fs.remove(downloadPath);
      await fs.ensureDir(downloadPath);

      // Check if this template should be downloaded from a private registry
      const registry = this.registryManager._registryCache.get(templateId.split('/')[0]);

      if (registry && registry.type === 'private') {
        // Use NpmService with private registry authentication
        await this.downloadFromPrivateRegistry(templateId, version, downloadPath, registry);
      } else {
        // Use standard npm pack for public registries
        const packCommand = `npm pack ${templateId}@${version}`;
        const { stdout } = await execAsync(packCommand, { cwd: downloadPath });

        // Extract the package filename from npm pack output
        const packageFile = stdout.trim();
        const packagePath = path.join(downloadPath, packageFile);

        // Extract the package
        await execAsync(`tar -xzf "${packageFile}"`, { cwd: downloadPath });

        // Remove the compressed file
        await fs.remove(packagePath);

        // The package is extracted in a subdirectory, move contents up
        const extractedDir = path.join(downloadPath, 'package');
        if (await fs.pathExists(extractedDir)) {
          const files = await fs.readdir(extractedDir);
          for (const file of files) {
            await fs.move(
              path.join(extractedDir, file),
              path.join(downloadPath, file)
            );
          }
          await fs.remove(extractedDir);
        }
      }

      this.logger.debug('NPM template downloaded', { templateId, version, path: downloadPath });
    } catch (error) {
      throw new Error(`Failed to download NPM template: ${error.message}`);
    }
  }

  /**
   * Download template from private registry
   * @private
   * @param {string} templateId - Template ID
   * @param {string} version - Template version
   * @param {string} downloadPath - Download path
   * @param {Object} registry - Registry configuration
   */
  async downloadFromPrivateRegistry(templateId, version, downloadPath, registry) {
    try {
      // Create NpmService instance with private registry configuration
      const npmService = new NpmService({
        registryUrl: registry.url,
        authToken: registry.authToken,
        timeout: 60000,
        enableCache: true,
        cacheDir: this.cacheDir
      });

      // Download package using NpmService
      const packageName = templateId.startsWith('@') ? templateId.split('/')[1] : templateId;
      const downloadResult = await npmService.downloadPackage(packageName, version, {
        destination: downloadPath
      });

      // Extract the downloaded package
      const packagePath = downloadResult.packagePath;
      await execAsync(`tar -xzf "${packagePath}"`, { cwd: downloadPath });

      // Remove the compressed file
      await fs.remove(packagePath);

      // The package is extracted in a subdirectory, move contents up
      const extractedDir = path.join(downloadPath, 'package');
      if (await fs.pathExists(extractedDir)) {
        const files = await fs.readdir(extractedDir);
        for (const file of files) {
          await fs.move(
            path.join(extractedDir, file),
            path.join(downloadPath, file)
          );
        }
        await fs.remove(extractedDir);
      }

      this.logger.debug('Private registry template downloaded', {
        templateId,
        version,
        registry: registry.id,
        path: downloadPath
      });
    } catch (error) {
      throw new Error(`Failed to download from private registry: ${error.message}`);
    }
  }

  /**
   * Download Git-based template
   * @private
   * @param {string} templateId - Template ID (Git URL)
   * @param {string} version - Git reference (branch, tag, commit)
   * @param {string} downloadPath - Download path
   */
  async downloadGitTemplate(templateId, version, downloadPath) {
    try {
      // Clean existing directory
      await fs.remove(downloadPath);

      // Validate Git URL
      const urlValidation = validateGitUrl(templateId);
      if (!urlValidation.isValid) {
        throw new Error(`Invalid Git URL: ${urlValidation.errors.join(', ')}`);
      }

      // Clone the repository
      const git = simpleGit();
      await git.clone(templateId, downloadPath);

      // Checkout specific version if provided
      if (version && version !== 'latest') {
        await git.cwd(downloadPath).checkout(version);
      }

      this.logger.debug('Git template downloaded', { templateId, version, path: downloadPath });
    } catch (error) {
      throw new Error(`Failed to download Git template: ${error.message}`);
    }
  }

  /**
   * Validate downloaded template
   * @private
   * @param {string} downloadPath - Download path
   * @param {TemplatePackage} template - Template package instance
   */
  async validateDownloadedTemplate(downloadPath, template) {
    try {
      // Use the comprehensive TemplateValidator for validation
      const validationOptions = {
        path: downloadPath,
        templateType: template.type,
        strictMode: true,
        enableSecurityValidation: true,
        enableDependencyValidation: true,
        enableStructureValidation: true
      };

      const validationResult = await this.templateValidator.validateTemplatePackage(template, validationOptions);

      if (!validationResult.isValid) {
        const errorMessages = validationResult.errors.map(e => e.message).join(', ');
        throw new Error(`Template validation failed: ${errorMessages}`);
      }

      this.logger.debug('Downloaded template validated', {
        templateId: template.id,
        path: downloadPath,
        validationDuration: validationResult.metadata.validationDuration,
        checksPerformed: validationResult.metadata.checksPerformed.length
      });
    } catch (error) {
      throw new Error(`Template validation failed: ${error.message}`);
    }
  }

  
  /**
   * Validate template structure and naming
   * @param {Object} templateData - Template data to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateTemplate(templateData, options = {}) {
    try {
      const spinner = ora(`Validating template ${templateData.id}`).start();

      this.logger.info('Validating template', {
        templateId: templateData.id,
        options: Object.keys(options)
      });

      spinner.text = 'Creating template package...';
      // Create template package instance
      const template = new TemplatePackage(templateData);

      spinner.text = 'Preparing validation options...';
      // Use the comprehensive TemplateValidator for validation
      const validationOptions = {
        path: templateData.path,
        templateType: template.type,
        strictMode: options.strictMode || false,
        enableSecurityValidation: options.enableSecurityValidation !== false,
        enableDependencyValidation: options.enableDependencyValidation !== false,
        enableStructureValidation: options.enableStructureValidation !== false,
        enableSchemaValidation: options.enableSchemaValidation !== false,
        enableVersionValidation: options.enableVersionValidation !== false
      };

      spinner.text = 'Running validation checks...';
      const validationResult = await this.templateValidator.validateTemplatePackage(template, validationOptions);

      if (!validationResult.isValid) {
        this.logger.warn('Template validation failed', {
          templateId: templateData.id,
          errors: validationResult.errors.length,
          warnings: validationResult.warnings.length
        });
        spinner.fail(`Template validation failed: ${templateData.id}`);
        return {
          isValid: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          template: template.toJSON(),
          metadata: validationResult.metadata
        };
      }

      this.logger.info('Template validation completed', {
        templateId: templateData.id,
        isValid: true,
        validationDuration: validationResult.metadata.validationDuration,
        checksPerformed: validationResult.metadata.checksPerformed.length
      });

      spinner.succeed(`Template validation completed: ${templateData.id}`);

      return {
        isValid: true,
        errors: [],
        warnings: validationResult.warnings,
        template: template.toJSON(),
        metadata: validationResult.metadata
      };
    } catch (error) {
      this.logger.error('Template validation error', {
        templateId: templateData.id,
        error: error.message
      });
      return {
        isValid: false,
        errors: [{ message: error.message, code: 'VALIDATION_ERROR' }],
        warnings: [],
        template: templateData
      };
    }
  }

  
  /**
   * Install template to create project
   * @param {string} templateId - Template ID
   * @param {Object} config - Installation configuration
   * @param {string} config.projectName - Project name
   * @param {string} config.targetDir - Target directory
   * @param {Object} config.variables - Template variables
   * @param {Object} options - Installation options
   * @returns {Promise<Object>} Installation result
   */
  async installTemplate(templateId, config, options = {}) {
    const {
      projectName,
      targetDir,
      variables = {},
      skipInstall = false,
      skipGit = false
    } = config;

    if (!templateId) {
      throw new Error('Template ID is required');
    }

    if (!projectName) {
      throw new Error('Project name is required');
    }

    try {
      const spinner = ora(`Installing template ${templateId} as ${projectName}`).start();

      this.logger.info('Installing template', {
        templateId,
        projectName,
        targetDir
      });

      spinner.text = 'Getting template information...';
      // Get template information
      const template = await this.getTemplate(templateId);

      // Validate configuration against template schema
      spinner.text = 'Validating configuration...';
      const configValidation = template.validateConfig(variables);
      if (!configValidation.isValid) {
        throw new Error(`Invalid configuration: ${configValidation.errors.join(', ')}`);
      }

      // Download template if not already cached
      spinner.text = 'Downloading template...';
      const downloadResult = await this.downloadTemplate(templateId, 'latest', {
        forceDownload: options.forceDownload
      });

      // Prepare target directory
      spinner.text = 'Preparing target directory...';
      const finalTargetDir = targetDir || path.join(process.cwd(), projectName);
      await this.prepareTargetDirectory(finalTargetDir, projectName);

      // Copy template files
      spinner.text = 'Copying template files...';
      await this.copyTemplateFiles(downloadResult.path, finalTargetDir);

      // Process template variables
      spinner.text = 'Processing template variables...';
      const templateVariables = Object.assign({ projectName }, variables);
      await this.processTemplateVariables(finalTargetDir, templateVariables);

      // Install dependencies
      if (!skipInstall) {
        spinner.text = 'Installing dependencies...';
        await this.installDependencies(finalTargetDir, template);
      }

      // Initialize git repository
      if (!skipGit) {
        spinner.text = 'Initializing git repository...';
        await this.initializeGitRepo(finalTargetDir, projectName);
      }

      // Generate project info
      spinner.text = 'Generating project information...';
      const projectInfo = await this.generateProjectInfo(finalTargetDir, template, projectName);

      this.stats.templatesInstalled++;
      this.logger.info('Template installed successfully', {
        templateId,
        projectName,
        path: finalTargetDir
      });

      spinner.succeed(`Template installed successfully: ${projectName}`);

      return {
        success: true,
        projectPath: finalTargetDir,
        projectName,
        template: template.toJSON(),
        projectInfo,
        message: 'Template installed successfully'
      };
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to install template', {
        templateId,
        projectName,
        error: error.message
      });
      throw new Error(`Failed to install template: ${error.message}`);
    }
  }

  /**
   * Prepare target directory
   * @private
   * @param {string} targetDir - Target directory
   * @param {string} projectName - Project name
   */
  async prepareTargetDirectory(targetDir, projectName) {
    // Validate target directory path
    const pathValidation = validateFilePath(targetDir);
    if (!pathValidation.isValid) {
      throw new Error(`Invalid target directory: ${pathValidation.errors.join(', ')}`);
    }

    // Check if directory exists
    if (await fs.pathExists(targetDir)) {
      throw new Error(`Target directory already exists: ${targetDir}`);
    }

    // Create directory
    await fs.ensureDir(targetDir);
    this.logger.debug('Target directory prepared', { path: targetDir });
  }

  /**
   * Copy template files
   * @private
   * @param {string} sourceDir - Source directory
   * @param {string} targetDir - Target directory
   */
  async copyTemplateFiles(sourceDir, targetDir) {
    try {
      // Copy all files except hidden files and cache files
      const files = await fs.readdir(sourceDir);

      for (const file of files) {
        if (file.startsWith('.') && file !== '.gitignore') {
          continue; // Skip hidden files except .gitignore
        }

        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        const stats = await fs.stat(sourcePath);

        if (stats.isDirectory()) {
          await fs.copy(sourcePath, targetPath);
        } else {
          await fs.copy(sourcePath, targetPath);
        }
      }

      this.logger.debug('Template files copied', {
        source: sourceDir,
        target: targetDir
      });
    } catch (error) {
      throw new Error(`Failed to copy template files: ${error.message}`);
    }
  }

  /**
   * Process template variables
   * @private
   * @param {string} targetDir - Target directory
   * @param {Object} variables - Template variables
   */
  async processTemplateVariables(targetDir, variables) {
    try {
      const files = await this.getTemplateFiles(targetDir);

      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        let processedContent = content;

        // Replace variables in content
        for (const [key, value] of Object.entries(variables)) {
          const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          processedContent = processedContent.replace(pattern, value);
        }

        // Write processed content back
        await fs.writeFile(filePath, processedContent, 'utf8');
      }

      this.logger.debug('Template variables processed', {
        targetDir,
        variables: Object.keys(variables)
      });
    } catch (error) {
      throw new Error(`Failed to process template variables: ${error.message}`);
    }
  }

  /**
   * Get template files for variable processing
   * @private
   * @param {string} targetDir - Target directory
   * @returns {Promise<Array>} Array of file paths
   */
  async getTemplateFiles(targetDir) {
    const processableFiles = [];

    const findFiles = async(dir) => {
      const files = await fs.readdir(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          // Skip node_modules and other build directories
          if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
            await findFiles(filePath);
          }
        } else {
          // Only process text files
          const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.html', '.css', '.scss', '.yml', '.yaml'];
          if (textExtensions.some(ext => file.endsWith(ext))) {
            processableFiles.push(path.relative(targetDir, filePath));
          }
        }
      }
    };

    await findFiles(targetDir);
    return processableFiles;
  }

  /**
   * Install dependencies
   * @private
   * @param {string} targetDir - Target directory
   * @param {TemplatePackage} template - Template package
   */
  async installDependencies(targetDir, template) {
    try {
      this.logger.info('Installing dependencies', { targetDir });

      // Install npm dependencies
      await execAsync('npm install', { cwd: targetDir });

      this.logger.debug('Dependencies installed', { targetDir });
    } catch (error) {
      this.logger.warn('Failed to install dependencies', {
        targetDir,
        error: error.message
      });
      // Don't throw error for dependency installation failure
    }
  }

  /**
   * Initialize git repository
   * @private
   * @param {string} targetDir - Target directory
   * @param {string} projectName - Project name
   */
  async initializeGitRepo(targetDir, projectName) {
    try {
      const git = simpleGit(targetDir);

      // Initialize repository
      await git.init();

      // Add all files
      await git.add('.');

      // Create initial commit
      await git.commit(`Initial commit from template: ${projectName}`);

      this.logger.debug('Git repository initialized', { targetDir });
    } catch (error) {
      this.logger.warn('Failed to initialize git repository', {
        targetDir,
        error: error.message
      });
      // Don't throw error for git initialization failure
    }
  }

  /**
   * Generate project information
   * @private
   * @param {string} targetDir - Target directory
   * @param {TemplatePackage} template - Template package
   * @param {string} projectName - Project name
   * @returns {Promise<Object>} Project information
   */
  async generateProjectInfo(targetDir, template, projectName) {
    try {
      // Read package.json
      const packageJsonPath = path.join(targetDir, 'package.json');
      const packageJson = await fs.readJSON(packageJsonPath);

      return {
        name: projectName,
        version: packageJson.version || '1.0.0',
        description: packageJson.description || '',
        template: template.id,
        templateVersion: template.version,
        templateType: template.type,
        createdAt: new Date().toISOString(),
        path: targetDir,
        scripts: packageJson.scripts || {},
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {}
      };
    } catch (error) {
      this.logger.warn('Failed to generate project info', {
        targetDir,
        error: error.message
      });
      return {
        name: projectName,
        template: template.id,
        templateVersion: template.version,
        templateType: template.type,
        createdAt: new Date().toISOString(),
        path: targetDir
      };
    }
  }

  /**
   * Get detailed template information
   * @param {string} templateId - Template ID
   * @param {Object} options - Options
   * @param {boolean} options.includeFiles - Include file list
   * @param {boolean} options.includeDependencies - Include dependency details
   * @returns {Promise<Object>} Template information
   */
  async getTemplateInfo(templateId, options = {}) {
    const { includeFiles = false, includeDependencies = false } = options;

    if (!templateId) {
      throw new Error('Template ID is required');
    }

    try {
      this.logger.info('Getting template info', { templateId });

      // Get template
      const template = await this.getTemplate(templateId);

      // Basic template information
      const templateInfo = {
        id: template.id,
        name: template.name,
        version: template.version,
        description: template.description,
        type: template.type,
        author: template.author,
        keywords: template.keywords,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        downloadCount: template.downloadCount,
        supportedVersions: template.supportedVersions,
        configSchema: template.configSchema,
        isCompatible: template.isCompatible,
        getConfig: () => template.getConfig()
      };

      // Add file list if requested
      if (includeFiles) {
        const downloadResult = await this.downloadTemplate(templateId, 'latest');
        templateInfo.files = await this.getTemplateFileList(downloadResult.path);
      }

      // Add dependency details if requested
      if (includeDependencies) {
        templateInfo.dependencies = template.dependencies;
        templateInfo.devDependencies = template.devDependencies;

        // Get dependency information from npm
        const allDependencies = Object.assign({}, template.dependencies, template.devDependencies);
        templateInfo.dependencyInfo = await this.getDependencyInfo(allDependencies);
      }

      // Add usage statistics
      templateInfo.stats = {
        downloadCount: template.downloadCount,
        installCount: this.stats.templatesInstalled,
        lastUpdated: template.updatedAt
      };

      this.logger.info('Template info retrieved', { templateId });

      return templateInfo;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to get template info', {
        templateId,
        error: error.message
      });
      throw new Error(`Failed to get template info: ${error.message}`);
    }
  }

  /**
   * Get template file list
   * @private
   * @param {string} templatePath - Template path
   * @returns {Promise<Array>} Array of file information
   */
  async getTemplateFileList(templatePath) {
    try {
      const files = [];

      const processFiles = async(dir, relativePath = '') => {
        const items = await fs.readdir(dir);

        for (const item of items) {
          // Skip hidden files and node_modules
          if (item.startsWith('.') || item === 'node_modules') {
            continue;
          }

          const itemPath = path.join(dir, item);
          const relativeItemPath = path.join(relativePath, item);
          const stats = await fs.stat(itemPath);

          if (stats.isDirectory()) {
            await processFiles(itemPath, relativeItemPath);
          } else {
            files.push({
              path: relativeItemPath,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              type: path.extname(item)
            });
          }
        }
      };

      await processFiles(templatePath);
      return files;
    } catch (error) {
      this.logger.error('Failed to get template file list', {
        templatePath,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get dependency information
   * @private
   * @param {Object} dependencies - Dependencies object
   * @returns {Promise<Object>} Dependency information
   */
  async getDependencyInfo(dependencies) {
    try {
      const dependencyInfo = {};

      for (const [name, version] of Object.entries(dependencies)) {
        try {
          // Try to get package info from npm
          const response = await axios.get(`https://registry.npmjs.org/${name}`, {
            timeout: 5000
          });

          const packageInfo = response.data;
          dependencyInfo[name] = {
            version: version,
            latest: packageInfo['dist-tags'] && packageInfo['dist-tags'].latest,
            description: packageInfo.description,
            homepage: packageInfo.homepage,
            repository: packageInfo.repository && packageInfo.repository.url,
            license: packageInfo.license,
            deprecated: packageInfo.deprecated || false
          };
        } catch (error) {
          // If npm lookup fails, just return basic info
          dependencyInfo[name] = {
            version: version,
            error: 'Failed to fetch package information'
          };
        }
      }

      return dependencyInfo;
    } catch (error) {
      this.logger.error('Failed to get dependency info', { error: error.message });
      return {};
    }
  }

  /**
   * Get cached data
   * @private
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached data or null
   */
  async getCachedData(key) {
    if (!this.enableCache) {return null;}

    // Use CacheManager if available
    if (this.cacheManager) {
      try {
        const cacheKey = `template_data_${key}`;
        const cacheEntry = await this.cacheManager.getCacheEntry(cacheKey, 'metadata');
        if (cacheEntry) {
          this.stats.cacheHits++;
          return cacheEntry.metadata.data;
        }
      } catch (error) {
        this.logger.warn('Failed to get cached data from CacheManager', { key, error: error.message });
      }
    }

    // Fallback to legacy cache system
    try {
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      if (!(await fs.pathExists(cacheFile))) {return null;}

      const data = await fs.readJSON(cacheFile);
      const now = new Date();
      const cachedTime = new Date(data.cachedAt);

      // Check if cache is expired
      if (now - cachedTime > this.cacheTTL) {
        await fs.remove(cacheFile);
        return null;
      }

      this.stats.cacheHits++;
      return data.value;
    } catch (error) {
      this.logger.warn('Failed to get cached data', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set cached data
   * @private
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  async setCachedData(key, value) {
    if (!this.enableCache) {return;}

    // Use CacheManager if available
    if (this.cacheManager) {
      try {
        const cacheKey = `template_data_${key}`;
        const tempPath = path.join(this.cacheDir, 'temp');
        await fs.ensureDir(tempPath);

        // Create temporary metadata file
        const metadataPath = path.join(tempPath, `${cacheKey}.json`);
        await fs.writeJSON(metadataPath, { data: value, cachedAt: new Date().toISOString() });

        await this.cacheManager.setCacheEntry(cacheKey, 'metadata', tempPath);
        await fs.remove(tempPath);
        return;
      } catch (error) {
        this.logger.warn('Failed to set cached data using CacheManager', { key, error: error.message });
      }
    }

    // Fallback to legacy cache system
    try {
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      const cacheData = {
        value,
        cachedAt: new Date().toISOString()
      };

      await fs.writeJSON(cacheFile, cacheData, { spaces: 2 });
    } catch (error) {
      this.logger.warn('Failed to set cached data', { key, error: error.message });
    }
  }

  /**
   * Get cached template path
   * @private
   * @param {string} templateId - Template ID
   * @param {string} version - Template version
   * @returns {Promise<string|null>} Cached template path or null
   */
  async getCachedTemplatePath(templateId, version) {
    // Use CacheManager if available
    if (this.cacheManager) {
      try {
        const cacheEntry = await this.cacheManager.getCacheEntry(templateId, version);
        if (cacheEntry && await cacheEntry.validate()) {
          this.stats.cacheHits++;
          return cacheEntry.path;
        }
      } catch (error) {
        this.logger.warn('Failed to get cached template from CacheManager', { templateId, version, error: error.message });
      }
    }

    // Fallback to legacy cache system
    try {
      const cacheKey = `${templateId}_${version}`;
      const cachePath = path.join(this.cacheDir, 'templates', cacheKey);

      if (!(await fs.pathExists(cachePath))) {return null;}

      // Validate cache entry
      const cacheStore = new CacheStore({
        id: cacheKey,
        templateId,
        version,
        path: cachePath
      });

      if (await cacheStore.validate()) {
        this.stats.cacheHits++;
        return cachePath;
      }

      // Remove invalid cache
      await fs.remove(cachePath);
    } catch (error) {
      this.logger.warn('Failed to get cached template path', { templateId, version, error: error.message });
    }

    return null;
  }

  /**
   * Get template download path
   * @private
   * @param {string} templateId - Template ID
   * @param {string} version - Template version
   * @returns {Promise<string>} Download path
   */
  async getTemplateDownloadPath(templateId, version) {
    const cacheKey = `${templateId}_${version}`;
    return path.join(this.cacheDir, 'templates', cacheKey);
  }

  /**
   * Cache downloaded template
   * @private
   * @param {string} templateId - Template ID
   * @param {string} version - Template version
   * @param {string} downloadPath - Download path
   */
  async cacheDownloadedTemplate(templateId, version, downloadPath) {
    try {
      // Use CacheManager if available
      if (this.cacheManager) {
        await this.cacheManager.setCacheEntry(templateId, version, downloadPath);
        this.logger.debug('Template cached using CacheManager', { templateId, version, path: downloadPath });
        return;
      }

      // Fallback to legacy cache system
      const cacheKey = `${templateId}_${version}`;
      const cachePath = path.join(this.cacheDir, 'templates', cacheKey);

      // Create cache store instance
      const cacheStore = new CacheStore({
        id: cacheKey,
        templateId,
        version,
        path: cachePath
      });

      // Validate and save to cache
      await cacheStore.validate();
      this.cacheStore.set(cacheKey, cacheStore);

      this.logger.debug('Template cached using legacy system', { templateId, version, path: cachePath });
    } catch (error) {
      this.logger.warn('Failed to cache template', {
        templateId,
        version,
        error: error.message
      });
    }
  }

  /**
   * Clear template cache
   * @returns {Promise<Object>} Cache clearing result
   */
  async clearCache() {
    try {
      this.logger.info('Clearing template cache');

      // Use CacheManager if available
      if (this.cacheManager) {
        try {
          const cacheStats = await this.cacheManager.getCacheStats();
          const result = await this.cacheManager.clearCache();

          // Clear in-memory caches
          this.cacheStore.clear();
          this.templatePackages.clear();

          // Reset cache statistics
          this.stats.cacheHits = 0;
          this.stats.cacheMisses = 0;

          this.logger.info('Template cache cleared using CacheManager', { result });

          return {
            success: true,
            message: 'Template cache cleared successfully',
            cacheManager: true,
            clearedEntries: result.clearedEntries,
            preservedEntries: result.preservedEntries
          };
        } catch (error) {
          this.logger.warn('Failed to clear cache using CacheManager', { error: error.message });
          // Fall through to legacy method
        }
      }

      // Fallback to legacy cache clearing
      await fs.remove(this.cacheDir);
      await this.ensureCacheDirectory();

      // Clear in-memory cache
      this.cacheStore.clear();
      this.templatePackages.clear();

      // Reset cache statistics
      this.stats.cacheHits = 0;
      this.stats.cacheMisses = 0;

      this.logger.info('Template cache cleared using legacy method');

      return {
        success: true,
        message: 'Template cache cleared successfully',
        cacheManager: false
      };
    } catch (error) {
      this.logger.error('Failed to clear cache', { error: error.message });
      throw new Error(`Failed to clear cache: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    const baseStats = {
      enabled: this.enableCache,
      cacheDir: this.cacheDir,
      cacheTTL: this.cacheTTL,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
        : 0,
      cachedTemplates: this.cacheStore.size,
      cachedPackages: this.templatePackages.size,
      hasCacheManager: !!this.cacheManager
    };

    // Include CacheManager stats if available
    if (this.cacheManager) {
      try {
        const cacheManagerStats = await this.cacheManager.getCacheStats();
        baseStats.cacheManager = {
          basic: cacheManagerStats.basic,
          performance: cacheManagerStats.performance,
          policies: cacheManagerStats.policies,
          lru: cacheManagerStats.lru
        };
      } catch (error) {
        baseStats.cacheManagerError = error.message;
      }
    }

    return baseStats;
  }

  /**
   * Get operation statistics
   * @returns {Promise<Object>} Operation statistics
   */
  async getStats() {
    const stats = Object.assign({}, this.stats);
    stats.registries = this.registries.length;
    stats.cacheStats = await this.getCacheStats();
    return stats;
  }

  /**
   * Add registry to manager
   * @param {TemplateRegistry} registry - Registry to add
   */
  addRegistry(registry) {
    if (!(registry instanceof TemplateRegistry)) {
      throw new Error('Registry must be an instance of TemplateRegistry');
    }

    this.registries.push(registry);
    this.logger.info('Registry added', { registryId: registry.id });
  }

  /**
   * Remove registry from manager
   * @param {string} registryId - Registry ID to remove
   */
  removeRegistry(registryId) {
    const index = this.registries.findIndex(r => r.id === registryId);
    if (index === -1) {
      throw new Error(`Registry not found: ${registryId}`);
    }

    this.registries.splice(index, 1);
    this.logger.info('Registry removed', { registryId });
  }

  /**
   * Get registry by ID
   * @param {string} registryId - Registry ID
   * @returns {TemplateRegistry|null} Registry instance or null
   */
  getRegistry(registryId) {
    return this.registries.find(r => r.id === registryId) || null;
  }

  /**
   * Get all registries
   * @returns {Array<TemplateRegistry>} Array of registries
   */
  getRegistries() {
    return this.registries.slice();
  }

  /**
   * Add private registry using RegistryManager
   * @param {Object} registryConfig - Registry configuration
   * @returns {Object} Added registry configuration
   */
  addPrivateRegistry(registryConfig) {
    try {
      const registry = this.registryManager.addRegistry(registryConfig);

      // Create TemplateRegistry instance for compatibility
      const templateRegistry = new TemplateRegistry({
        id: registry.id,
        name: registry.name,
        url: registry.url,
        type: 'private',
        authRequired: registry.authType !== 'none',
        cachePolicy: 'default'
      });

      this.registries.push(templateRegistry);
      this.logger.info('Private registry added', { registryId: registry.id });

      return registry;
    } catch (error) {
      this.logger.error('Failed to add private registry', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove private registry using RegistryManager
   * @param {string} registryId - Registry ID to remove
   * @returns {boolean} Whether registry was removed
   */
  removePrivateRegistry(registryId) {
    try {
      // Remove from RegistryManager
      const removed = this.registryManager.removeRegistry(registryId);

      // Remove from TemplateManager registries
      const index = this.registries.findIndex(r => r.id === registryId);
      if (index !== -1) {
        this.registries.splice(index, 1);
      }

      this.logger.info('Private registry removed', { registryId });
      return removed;
    } catch (error) {
      this.logger.error('Failed to remove private registry', { error: error.message });
      throw error;
    }
  }

  /**
   * List private registries from RegistryManager
   * @param {Object} options - Listing options
   * @returns {Array} Array of private registries
   */
  listPrivateRegistries(options = {}) {
    return this.registryManager.listRegistries(options);
  }

  /**
   * Test private registry connectivity
   * @param {string} registryId - Registry ID
   * @returns {Promise<Object>} Connectivity test result
   */
  async testPrivateRegistry(registryId) {
    try {
      return await this.registryManager.testConnectivity(registryId);
    } catch (error) {
      this.logger.error('Failed to test private registry connectivity', { registryId, error: error.message });
      throw error;
    }
  }

  /**
   * Search packages in private registry
   * @param {string} registryId - Registry ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchPrivatePackages(registryId, query, options = {}) {
    try {
      return await this.registryManager.searchPackages(registryId, query, options);
    } catch (error) {
      this.logger.error('Failed to search private packages', { registryId, query, error: error.message });
      throw error;
    }
  }

  /**
   * Get package info from private registry
   * @param {string} registryId - Registry ID
   * @param {string} packageName - Package name
   * @returns {Promise<Object>} Package information
   */
  async getPrivatePackageInfo(registryId, packageName) {
    try {
      return await this.registryManager.getPackageInfo(registryId, packageName);
    } catch (error) {
      this.logger.error('Failed to get private package info', { registryId, packageName, error: error.message });
      throw error;
    }
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getRegistryStats() {
    return this.registryManager.getStats();
  }
}

module.exports = TemplateManager;
