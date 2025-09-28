const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { exec } = require('child_process');
const axios = require('axios');
const semver = require('semver');
const { ValidationError, SecurityError, FileSystemError } = require('./error-handler');
const Logger = require('./logger');

const execAsync = promisify(exec);

/**
 * Template Validator with comprehensive validation and schema verification
 */
class TemplateValidator {
  /**
   * Create a new TemplateValidator
   * @param {Object} options - Validator options
   * @param {Logger} options.logger - Logger instance
   * @param {boolean} options.enableSecurity - Enable security validation
   * @param {boolean} options.enableSchema - Enable schema validation
   * @param {Object} options.securityRules - Security validation rules
   */
  constructor(options = {}) {
    this.logger = options.logger || Logger.create('TemplateValidator');
    this.enableSecurity = options.enableSecurity !== false;
    this.enableSchema = options.enableSchema !== false;
    this.securityRules = options.securityRules || this.getDefaultSecurityRules();
    this.validationCache = new Map();
    this.schemas = this.initializeSchemas();
  }

  /**
   * Get default security rules
   * @returns {Object} Default security rules
   * @private
   */
  getDefaultSecurityRules() {
    return {
      // File security rules
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: [
        '.js', '.ts', '.jsx', '.tsx', '.vue', '.json', '.md',
        '.html', '.css', '.scss', '.sass', '.less', '.yaml', '.yml',
        '.txt', '.env.example', '.gitignore', '.npmignore'
      ],
      blockedFilePatterns: [
        /^\.env$/,
        /^\.env\.local$/,
        /^\.env\.development$/,
        /^\.env\.production$/,
        /^.*\.key$/,
        /^.*\.pem$/,
        /^.*\.p12$/,
        /^.*\.pfx$/,
        /^node_modules/,
        /^\.git/,
        /^\.DS_Store$/,
        /^Thumbs\.db$/,
        /^desktop\.ini$/
      ],

      // Content security rules
      blockedPatterns: [
        /process\.env\./, // Environment variable access
        /require\(['"`]\.\.\/['"`]/, // Relative path requires
        /eval\s*\(/, // eval usage
        /Function\s*\(/, // Function constructor
        /new\s+Function\s*\(/, // Dynamic function creation
        /document\.write/, // document.write
        /innerHTML\s*=/, // innerHTML assignment
        /localStorage\.|sessionStorage\./, // Storage access
        /XMLHttpRequest|fetch\s*\(/, // Network requests
        /WebSocket|EventSource/, // Real-time connections
        /crypto\.subtle/, // Cryptography API
        /worker\.|Worker\s*\(/, // Web Workers
        /importScripts/, // Worker scripts import
        /fs\.|path\.|os\.|child_process\./, // Node.js core modules
        /exec\(|spawn\s*\(|fork\s*\(/, // Process execution
        /rm\s+-rf|del\s+\/s/, // Dangerous commands
      ],

      // Dependency security rules
      blockedDependencies: [
        /^shelljs$/, // Shell execution
        /^child_process$/, // Process execution
        /^fs-extra$/, // File system access
        /^path$/, // Path manipulation
        /^os$/, // OS access
        /^crypto$/, // Cryptography
        /^net$/, // Network
        /^tls$/, // TLS/SSL
        /^dns$/, // DNS
        /^http$/i, // HTTP client
        /^https$/i, // HTTPS client
        /^ws$/i, // WebSocket
        /^sqlite3$/, // Database
        /^pg$/, // PostgreSQL
        /^mysql2?$/, // MySQL
        /^mongodb$/, // MongoDB
        /^redis$/, // Redis
        /^aws-sdk/, // AWS SDK
        /^@aws-sdk/, // AWS SDK v2+
        /^azure/, // Azure SDK
        /^@azure/, // Azure SDK
        /^google-cloud/, // Google Cloud SDK
        /^@google-cloud/, // Google Cloud SDK
      ],

      // Package.json validation rules
      requiredFields: ['name', 'version', 'description'],
      allowedScripts: ['test', 'start', 'build', 'dev', 'lint', 'clean'],
      blockedScripts: ['install', 'postinstall', 'preinstall'],
    };
  }

  /**
   * Initialize validation schemas
   * @returns {Object} Validation schemas
   * @private
   */
  initializeSchemas() {
    return {
      // Template package schema
      templatePackage: {
        type: 'object',
        required: ['id', 'name', 'version', 'type', 'description'],
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9._-]+$' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          version: { type: 'string', pattern: '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$' },
          type: { type: 'string', enum: ['react-next', 'node-api', 'vue-app'] },
          description: { type: 'string', minLength: 10, maxLength: 500 },
          author: { type: 'string', minLength: 1, maxLength: 100 },
          keywords: { type: 'array', items: { type: 'string', maxLength: 50 } },
          homepage: { type: 'string', format: 'uri' },
          repository: { type: 'string', format: 'uri' },
          bugs: { type: 'string', format: 'uri' },
          license: { type: 'string', pattern: '^[A-Z0-9.-]+$' },
          engines: {
            type: 'object',
            properties: {
              node: { type: 'string', pattern: '^>=?[0-9]+\.[0-9]+\.[0-9]+$' }
            }
          },
          dependencies: { type: 'object' },
          devDependencies: { type: 'object' },
          configSchema: { type: 'object' },
          supportedVersions: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },

      // Template configuration schema
      templateConfig: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            pattern: '^[a-zA-Z0-9._-]+$'
          },
          projectDescription: {
            type: 'string',
            minLength: 10,
            maxLength: 200
          },
          author: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              email: { type: 'string', format: 'email' },
              url: { type: 'string', format: 'uri' }
            }
          },
          features: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['typescript', 'eslint', 'prettier', 'testing', 'docker', 'ci-cd']
            }
          },
          database: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['none', 'sqlite', 'postgresql', 'mysql', 'mongodb'] },
              host: { type: 'string' },
              port: { type: 'number', minimum: 1, maximum: 65535 },
              name: { type: 'string' },
              username: { type: 'string' },
              password: { type: 'string' }
            }
          }
        }
      },

      // Template file schema
      templateFile: {
        type: 'object',
        required: ['path', 'type', 'content'],
        properties: {
          path: { type: 'string', pattern: '^[a-zA-Z0-9._/-]+$' },
          type: { type: 'string', enum: ['source', 'config', 'doc', 'binary', 'template'] },
          content: { type: 'string' },
          encoding: { type: 'string', enum: ['utf8', 'base64'] },
          executable: { type: 'boolean', default: false },
          permissions: { type: 'string', pattern: '^[0-7]{3,4}$' }
        }
      }
    };
  }

  /**
   * Validate template package comprehensively
   * @param {Object} templateData - Template data to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateTemplatePackage(templateData, options = {}) {
    const validationId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      this.logger.info('Starting template package validation', {
        templateId: templateData.id,
        validationId
      });

      const result = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {
          validationId,
          templateId: templateData.id,
          templateType: templateData.type,
          validatedAt: new Date().toISOString(),
          validationDuration: 0,
          checksPerformed: []
        }
      };

      // Check cache first
      const cacheKey = this.getValidationCacheKey(templateData);
      if (options.force !== true && this.validationCache.has(cacheKey)) {
        const cached = this.validationCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
          this.logger.debug('Using cached validation result', { validationId });
          return cached.result;
        }
      }

      // Schema validation
      if (this.enableSchema) {
        const schemaResult = await this.validateTemplateSchema(templateData);
        result.checksPerformed.push('schema');
        result.errors.push(...schemaResult.errors);
        result.warnings.push(...schemaResult.warnings);
      }

      // Security validation
      if (this.enableSecurity && templateData.path) {
        const securityResult = await this.validateTemplateSecurity(templateData.path, templateData);
        result.checksPerformed.push('security');
        result.errors.push(...securityResult.errors);
        result.warnings.push(...securityResult.warnings);
      }

      // Dependencies validation
      if (templateData.dependencies || templateData.devDependencies) {
        const depsResult = await this.validateDependencies(templateData);
        result.checksPerformed.push('dependencies');
        result.errors.push(...depsResult.errors);
        result.warnings.push(...depsResult.warnings);
      }

      // Template structure validation
      if (templateData.path) {
        const structureResult = await this.validateTemplateStructure(templateData.path, templateData.type);
        result.checksPerformed.push('structure');
        result.errors.push(...structureResult.errors);
        result.warnings.push(...structureResult.warnings);
      }

      // Version compatibility validation
      const versionResult = this.validateVersionCompatibility(templateData);
      result.checksPerformed.push('version');
      result.errors.push(...versionResult.errors);
      result.warnings.push(...versionResult.warnings);

      // Set overall validity
      result.isValid = result.errors.length === 0;
      result.metadata.validationDuration = Date.now() - startTime;

      // Cache result
      this.validationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      this.logger.info('Template validation completed', {
        validationId,
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        duration: result.metadata.validationDuration
      });

      return result;

    } catch (error) {
      this.logger.error('Template validation failed', {
        validationId,
        templateId: templateData.id,
        error: error.message
      });

      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        metadata: {
          validationId,
          templateId: templateData.id,
          validatedAt: new Date().toISOString(),
          validationDuration: Date.now() - startTime,
          checksPerformed: [],
          error: error.message
        }
      };
    }
  }

  /**
   * Validate template against schema
   * @param {Object} templateData - Template data
   * @returns {Object} Schema validation result
   * @private
   */
  async validateTemplateSchema(templateData) {
    const errors = [];
    const warnings = [];

    try {
      // Validate required fields
      for (const field of this.schemas.templatePackage.required) {
        if (!(field in templateData)) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Validate field types and constraints
      const validateField = (value, schema, fieldPath = '') => {
        if (value === undefined || value === null) {
          if (schema.required?.includes(fieldPath.split('.').pop())) {
            errors.push(`Missing required field: ${fieldPath}`);
          }
          return;
        }

        // Type validation
        if (schema.type && typeof value !== schema.type) {
          errors.push(`Invalid type for ${fieldPath}: expected ${schema.type}, got ${typeof value}`);
        }

        // String validation
        if (schema.type === 'string' && typeof value === 'string') {
          if (schema.minLength && value.length < schema.minLength) {
            errors.push(`${fieldPath} too short: minimum ${schema.minLength} characters`);
          }
          if (schema.maxLength && value.length > schema.maxLength) {
            errors.push(`${fieldPath} too long: maximum ${schema.maxLength} characters`);
          }
          if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
            errors.push(`${fieldPath} format invalid: must match ${schema.pattern}`);
          }
        }

        // Array validation
        if (schema.type === 'array' && Array.isArray(value)) {
          if (schema.items) {
            value.forEach((item, index) => {
              validateField(item, schema.items, `${fieldPath}[${index}]`);
            });
          }
        }

        // Object validation
        if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
          if (schema.properties) {
            for (const [prop, propSchema] of Object.entries(schema.properties)) {
              validateField(value[prop], propSchema, `${fieldPath}.${prop}`);
            }
          }
        }

        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
          errors.push(`${fieldPath} must be one of: ${schema.enum.join(', ')}`);
        }
      };

      validateField(templateData, this.schemas.templatePackage);

      // Additional business logic validation
      if (templateData.version && !semver.valid(templateData.version)) {
        errors.push('Invalid version format: must be semantic version (x.y.z)');
      }

      if (templateData.engines && templateData.engines.node) {
        try {
          const nodeRange = templateData.engines.node.replace(/^\\>=?/, '');
          if (!semver.valid(nodeRange)) {
            errors.push('Invalid Node.js engine constraint');
          }
        } catch (error) {
          errors.push('Invalid Node.js engine constraint');
        }
      }

    } catch (error) {
      errors.push(`Schema validation failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate template security
   * @param {string} templatePath - Template file path
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Security validation result
   * @private
   */
  async validateTemplateSecurity(templatePath, templateData) {
    const errors = [];
    const warnings = [];

    try {
      // Validate package.json security
      if (await fs.pathExists(path.join(templatePath, 'package.json'))) {
        const packageJson = await fs.readJson(path.join(templatePath, 'package.json'));
        const pkgResult = this.validatePackageJsonSecurity(packageJson);
        errors.push(...pkgResult.errors);
        warnings.push(...pkgResult.warnings);
      }

      // Scan file system for security issues
      const fileScanResult = await this.scanTemplateFiles(templatePath);
      errors.push(...fileScanResult.errors);
      warnings.push(...fileScanResult.warnings);

      // Validate template source if available
      if (templateData.sourceUrl) {
        const sourceResult = await this.validateTemplateSource(templateData.sourceUrl);
        errors.push(...sourceResult.errors);
        warnings.push(...sourceResult.warnings);
      }

    } catch (error) {
      errors.push(`Security validation failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate package.json security
   * @param {Object} packageJson - Package.json content
   * @returns {Object} Security validation result
   * @private
   */
  validatePackageJsonSecurity(packageJson) {
    const errors = [];
    const warnings = [];

    // Check required fields
    for (const field of this.securityRules.requiredFields) {
      if (!(field in packageJson)) {
        warnings.push(`Missing recommended field in package.json: ${field}`);
      }
    }

    // Validate scripts
    if (packageJson.scripts && typeof packageJson.scripts === 'object') {
      for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts)) {
        if (this.securityRules.blockedScripts.includes(scriptName)) {
          errors.push(`Blocked script name: ${scriptName}`);
        }

        // Check for dangerous commands
        const command = scriptCommand.toLowerCase();
        if (command.includes('rm -rf') || command.includes('del /s') || command.includes('sudo')) {
          errors.push(`Potentially dangerous script: ${scriptName}`);
        }
      }
    }

    // Validate dependencies
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const [depName, depVersion] of Object.entries(allDeps)) {
      // Check blocked dependencies
      for (const blockedPattern of this.securityRules.blockedDependencies) {
        if (blockedPattern.test(depName)) {
          errors.push(`Blocked dependency: ${depName}`);
          break;
        }
      }

      // Validate version specification
      if (depVersion && typeof depVersion === 'string') {
        if (depVersion.startsWith('git+') || depVersion.startsWith('http://')) {
          warnings.push(`Non-registry dependency: ${depName}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Scan template files for security issues
   * @param {string} templatePath - Template path
   * @returns {Promise<Object>} File scan result
   * @private
   */
  async scanTemplateFiles(templatePath) {
    const errors = [];
    const warnings = [];

    try {
      const files = await this.getTemplateFiles(templatePath);

      for (const file of files) {
        // Check file size
        if (file.stats.size > this.securityRules.maxFileSize) {
          warnings.push(`Large file: ${file.path} (${file.stats.size} bytes)`);
        }

        // Check file type
        const ext = path.extname(file.path).toLowerCase();
        if (!this.securityRules.allowedFileTypes.includes(ext) && ext !== '') {
          warnings.push(`Unusual file type: ${file.path} (${ext})`);
        }

        // Check blocked file patterns
        for (const pattern of this.securityRules.blockedFilePatterns) {
          if (pattern.test(file.path)) {
            errors.push(`Blocked file pattern: ${file.path}`);
            break;
          }
        }

        // Scan content for security issues
        if (this.isTextFile(file.path)) {
          try {
            const content = await fs.readFile(file.fullPath, 'utf8');
            const contentResult = this.scanFileContent(content, file.path);
            errors.push(...contentResult.errors);
            warnings.push(...contentResult.warnings);
          } catch (error) {
            warnings.push(`Could not scan file content: ${file.path}`);
          }
        }
      }

    } catch (error) {
      errors.push(`File scan failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Get all template files recursively
   * @param {string} templatePath - Template path
   * @returns {Promise<Array>} File list
   * @private
   */
  async getTemplateFiles(templatePath) {
    const files = [];
    const entries = await fs.readdir(templatePath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(templatePath, entry.name);
      const relativePath = path.relative(templatePath, fullPath);

      if (entry.isDirectory()) {
        // Skip node_modules and .git
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          const subFiles = await this.getTemplateFiles(fullPath);
          files.push(...subFiles);
        }
      } else {
        try {
          const stats = await fs.stat(fullPath);
          files.push({
            path: relativePath,
            fullPath,
            stats
          });
        } catch (error) {
          // Skip files that can't be accessed
        }
      }
    }

    return files;
  }

  /**
   * Check if file is a text file
   * @param {string} filePath - File path
   * @returns {boolean} Is text file
   * @private
   */
  isTextFile(filePath) {
    const textExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.vue', '.json', '.md', '.html',
      '.css', '.scss', '.sass', '.less', '.yaml', '.yml', '.txt',
      '.env.example', '.gitignore', '.npmignore', '.eslintrc', '.prettierrc'
    ];
    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext) || ext === '';
  }

  /**
   * Scan file content for security issues
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {Object} Content scan result
   * @private
   */
  scanFileContent(content, filePath) {
    const errors = [];
    const warnings = [];

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for blocked patterns
      for (const pattern of this.securityRules.blockedPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          const context = line.trim();
          if (this.isSuspiciousContext(context, filePath)) {
            errors.push(`Security issue in ${filePath}:${lineNumber}: ${context}`);
          }
        }
      }

      // Check for potential hardcoded secrets
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['"`][A-Za-z0-9]{20,}['"`]/i,
        /password\s*[:=]\s*['"`][A-Za-z0-9]{8,}['"`]/i,
        /secret\s*[:=]\s*['"`][A-Za-z0-9]{16,}['"`]/i,
        /token\s*[:=]\s*['"`][A-Za-z0-9]{20,}['"`]/i,
        /private[_-]?key\s*[:=]\s*['"`][A-Za-z0-9]{20,}['"`]/i
      ];

      for (const pattern of secretPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          warnings.push(`Potential hardcoded secret in ${filePath}:${lineNumber}: ${matches[0]}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Check if pattern match is in suspicious context
   * @param {string} context - Line content
   * @param {string} filePath - File path
   * @returns {boolean} Is suspicious
   * @private
   */
  isSuspiciousContext(context, filePath) {
    // Skip comments and strings that are likely harmless
    const skipPatterns = [
      /^\/\//, // JavaScript comments
      /^#/, // Shell/Python comments
      /^\/\*/, // Multi-line comment start
      /console\.log/, // Debug logging
      /\/\/ TODO/, // TODO comments
      /example/i, // Example values
      /your-/i, // Placeholder values
      /test/i, // Test values
      /demo/i, // Demo values
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(context)) {
        return false;
      }
    }

    // Skip certain file types that commonly have these patterns
    const safeFiles = [
      'package.json',
      'README.md',
      '.eslintrc.js',
      'jest.config.js',
      'webpack.config.js'
    ];

    if (safeFiles.includes(path.basename(filePath))) {
      return false;
    }

    return true;
  }

  /**
   * Validate template source URL
   * @param {string} sourceUrl - Template source URL
   * @returns {Promise<Object>} Source validation result
   * @private
   */
  async validateTemplateSource(sourceUrl) {
    const errors = [];
    const warnings = [];

    try {
      // Basic URL validation
      if (!sourceUrl.startsWith('https://') && !sourceUrl.startsWith('git@')) {
        warnings.push('Template source should use HTTPS or SSH');
      }

      // Check if it's a known repository
      if (sourceUrl.includes('github.com') || sourceUrl.includes('gitlab.com')) {
        // Could add additional repository validation here
        warnings.push('Template source appears to be from a git repository');
      }

    } catch (error) {
      warnings.push(`Could not validate template source: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate template dependencies
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Dependencies validation result
   * @private
   */
  async validateDependencies(templateData) {
    const errors = [];
    const warnings = [];

    try {
      const allDeps = {
        ...(templateData.dependencies || {}),
        ...(templateData.devDependencies || {})
      };

      for (const [depName, depVersion] of Object.entries(allDeps)) {
        // Validate dependency name format
        if (!/^[a-zA-Z0-9._-]+$/.test(depName)) {
          errors.push(`Invalid dependency name format: ${depName}`);
        }

        // Validate version specification
        if (typeof depVersion === 'string') {
          if (depVersion.startsWith('file:')) {
            warnings.push(`Local dependency: ${depName}`);
          } else if (depVersion.startsWith('git+')) {
            warnings.push(`Git dependency: ${depName}`);
          } else if (!semver.validRange(depVersion.replace(/^[^0-9]*/, ''))) {
            warnings.push(`Invalid version range for ${depName}: ${depVersion}`);
          }
        }

        // Check for known vulnerable dependencies (simplified check)
        const vulnerableDeps = [
          'lodash@<4.17.12',
          'moment@<2.29.2',
          'axios@<0.21.1'
        ];

        for (const vulnerableDep of vulnerableDeps) {
          const [vulnName, vulnRange] = vulnerableDep.split('@');
          if (depName === vulnName && semver.satisfies(depVersion, vulnRange)) {
            errors.push(`Known vulnerable dependency: ${depName}@${depVersion}`);
          }
        }
      }

    } catch (error) {
      errors.push(`Dependency validation failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate template structure
   * @param {string} templatePath - Template path
   * @param {string} templateType - Template type
   * @returns {Promise<Object>} Structure validation result
   * @private
   */
  async validateTemplateStructure(templatePath, templateType) {
    const errors = [];
    const warnings = [];

    try {
      const requiredFiles = this.getRequiredFilesForType(templateType);
      const foundFiles = new Set();

      // Check for required files
      const files = await this.getTemplateFiles(templatePath);
      for (const file of files) {
        foundFiles.add(file.path);
      }

      for (const requiredFile of requiredFiles) {
        if (!foundFiles.has(requiredFile)) {
          warnings.push(`Missing recommended file: ${requiredFile}`);
        }
      }

      // Check for unexpected files
      const unexpectedFiles = ['node_modules', '.git', '.DS_Store', 'Thumbs.db'];
      for (const file of files) {
        if (unexpectedFiles.some(pattern => file.path.includes(pattern))) {
          warnings.push(`Unexpected file in template: ${file.path}`);
        }
      }

      // Validate directory structure
      const expectedDirs = ['src', 'public', 'tests', 'docs'];
      for (const dir of expectedDirs) {
        const dirPath = path.join(templatePath, dir);
        if (await fs.pathExists(dirPath)) {
          const dirFiles = await fs.readdir(dirPath);
          if (dirFiles.length === 0) {
            warnings.push(`Empty directory: ${dir}`);
          }
        }
      }

    } catch (error) {
      errors.push(`Structure validation failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Get required files for template type
   * @param {string} templateType - Template type
   * @returns {Array} Required files
   * @private
   */
  getRequiredFilesForType(templateType) {
    const baseFiles = ['package.json', 'README.md', '.gitignore'];

    switch (templateType) {
      case 'react-next':
        return [...baseFiles, 'src/pages/index.js', 'src/app.js', 'next.config.js'];
      case 'node-api':
        return [...baseFiles, 'src/index.js', 'src/routes/', 'src/middleware/'];
      case 'vue-app':
        return [...baseFiles, 'src/App.vue', 'src/main.js', 'vue.config.js'];
      default:
        return baseFiles;
    }
  }

  /**
   * Validate version compatibility
   * @param {Object} templateData - Template data
   * @returns {Object} Version validation result
   * @private
   */
  validateVersionCompatibility(templateData) {
    const errors = [];
    const warnings = [];

    try {
      // Check if template version is compatible with CLI version
      const cliVersion = '1.0.0'; // This should come from package.json

      if (templateData.engines) {
        if (templateData.engines.node) {
          const currentNodeVersion = process.version;
          const requiredRange = templateData.engines.node.replace(/^>=*/, '');

          if (!semver.satisfies(currentNodeVersion.replace(/^v/, ''), requiredRange)) {
            errors.push(`Template requires Node.js ${templateData.engines.node}, current version: ${currentNodeVersion}`);
          }
        }
      }

      // Check for deprecated versions
      if (templateData.version) {
        const deprecatedVersions = ['0.0.1', '0.0.2', '1.0.0-alpha'];
        if (deprecatedVersions.includes(templateData.version)) {
          warnings.push(`Template version ${templateData.version} is deprecated`);
        }
      }

    } catch (error) {
      errors.push(`Version validation failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Get validation cache key
   * @param {Object} templateData - Template data
   * @returns {string} Cache key
   * @private
   */
  getValidationCacheKey(templateData) {
    const hash = crypto.createHash('sha256');
    hash.update(`${templateData.id}@${templateData.version}`);
    return hash.digest('hex');
  }

  /**
   * Get validation statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      cacheSize: this.validationCache.size,
      enableSecurity: this.enableSecurity,
      enableSchema: this.enableSchema,
      validationRules: {
        maxFileSize: this.securityRules.maxFileSize,
        allowedFileTypes: this.securityRules.allowedFileTypes.length,
        blockedPatterns: this.securityRules.blockedPatterns.length
      }
    };
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }
}

module.exports = TemplateValidator;