/**
 * Template Package Model
 *
 * Represents a template package with all required attributes and validation logic.
 * Template packages follow the naming convention @xagi/ai-template-{type}
 */

const Ajv = require('ajv');
const semver = require('semver');

// Supported template types
const TEMPLATE_TYPES = ['react-next', 'node-api', 'vue-app'];

// Default CLI version range compatibility
const DEFAULT_CLI_VERSION_RANGE = '^1.0.0';

class TemplatePackage {
  /**
   * Create a new TemplatePackage instance
   * @param {Object} data - Template package data
   * @param {string} data.id - Unique identifier (npm package name)
   * @param {string} data.name - Human-readable template name
   * @param {string} data.version - Semantic version string
   * @param {string} data.description - Template description
   * @param {string} data.type - Template type (react-next, node-api, vue-app)
   * @param {string} data.author - Template author/maintainer
   * @param {Array<string>} data.keywords - Search keywords for discovery
   * @param {Object} data.dependencies - Template-specific dependencies
   * @param {Object} data.devDependencies - Development dependencies
   * @param {Object} data.configSchema - JSON Schema for template configuration
   * @param {Array<string>} data.supportedVersions - Array of compatible CLI versions
   * @param {string} data.createdAt - Creation timestamp
   * @param {string} data.updatedAt - Last update timestamp
   * @param {number} data.downloadCount - Number of times downloaded
   */
  constructor(data) {
    if (!data) {
      throw new Error('TemplatePackage data is required');
    }

    this.id = data.id || '';
    this.name = data.name || '';
    this.version = data.version || '1.0.0';
    this.description = data.description || '';
    this.type = data.type || '';
    this.author = data.author || '';
    this.keywords = data.keywords || [];
    this.dependencies = data.dependencies || {};
    this.devDependencies = data.devDependencies || {};
    this.configSchema = data.configSchema || {};
    this.supportedVersions = data.supportedVersions || [DEFAULT_CLI_VERSION_RANGE];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.downloadCount = data.downloadCount || 0;

    // Initialize AJV for schema validation
    this.ajv = new Ajv({ allErrors: true });
    this._compiledSchema = null;
  }

  /**
   * Validate template package structure and naming convention
   * @returns {Object} Validation result with isValid, errors, and warnings
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Validate required fields
    if (!this.id) {
      errors.push('Template ID is required');
    }

    if (!this.name) {
      errors.push('Template name is required');
    }

    // Type validation happens after naming convention check (for auto-detection)

    // Validate naming convention @xagi/ai-template-{type} and auto-detect type
    if (this.id) {
      const namingValidation = this._validateNamingConvention();
      if (!namingValidation.isValid) {
        errors.push(...namingValidation.errors);
      }
    }

    // Validate template type (after potentially auto-detecting from naming convention)
    if (this.type && !TEMPLATE_TYPES.includes(this.type)) {
      errors.push(`Invalid template type '${this.type}'. Must be one of: ${TEMPLATE_TYPES.join(', ')}`);
    } else if (!this.type) {
      errors.push('Template type is required');
    }

    // Validate semantic version
    if (this.version && !semver.valid(this.version)) {
      errors.push(`Invalid semantic version: ${this.version}`);
    }

    // Validate dependencies and devDependencies are objects
    if (typeof this.dependencies !== 'object' || this.dependencies === null) {
      errors.push('Dependencies must be an object');
    }

    if (typeof this.devDependencies !== 'object' || this.devDependencies === null) {
      errors.push('Dev dependencies must be an object');
    }

    // Validate configSchema is an object
    if (typeof this.configSchema !== 'object' || this.configSchema === null) {
      errors.push('Config schema must be an object');
    }

    // Validate supportedVersions
    if (!Array.isArray(this.supportedVersions)) {
      errors.push('Supported versions must be an array');
    } else if (this.supportedVersions.length === 0) {
      warnings.push('No supported CLI versions specified - using default compatibility');
    }

    // Validate keywords
    if (!Array.isArray(this.keywords)) {
      errors.push('Keywords must be an array');
    }

    // Validate timestamps
    if (this.createdAt && isNaN(new Date(this.createdAt).getTime())) {
      errors.push('Invalid created timestamp');
    }

    if (this.updatedAt && isNaN(new Date(this.updatedAt).getTime())) {
      errors.push('Invalid updated timestamp');
    }

    // Validate download count
    if (typeof this.downloadCount !== 'number' || this.downloadCount < 0) {
      errors.push('Download count must be a non-negative number');
    }

    // Validate dependency versions
    this._validateDependencyVersions(errors, warnings);

    // Validate config schema
    this._validateConfigSchema(errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if template is compatible with CLI version
   * @param {string} version - CLI version to check
   * @returns {boolean} True if compatible
   */
  isCompatible(version) {
    if (!this.supportedVersions || this.supportedVersions.length === 0) {
      return true; // Assume compatibility if no version constraints
    }

    return this.supportedVersions.some(supportedRange => {
      try {
        return semver.satisfies(version, supportedRange);
      } catch (error) {
        return false;
      }
    });
  }

  /**
   * Get template configuration schema
   * @returns {Object} Configuration schema
   */
  getConfig() {
    return {
      ...this.configSchema,
      // Add metadata to schema
      _metadata: {
        templateId: this.id,
        templateName: this.name,
        templateType: this.type,
        version: this.version,
        schemaVersion: '1.0'
      }
    };
  }

  /**
   * Validate configuration data against template schema
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateConfig(config) {
    if (!this.configSchema || Object.keys(this.configSchema).length === 0) {
      return {
        isValid: true,
        errors: [],
        validatedConfig: config
      };
    }

    try {
      if (!this._compiledSchema) {
        this._compiledSchema = this.ajv.compile(this.configSchema);
      }

      const isValid = this._compiledSchema(config);

      return {
        isValid,
        errors: isValid ? [] : this._compiledSchema.errors.map(err =>
          `${err.instancePath || 'root'}: ${err.message}`
        ),
        validatedConfig: isValid ? config : null
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Schema compilation error: ${error.message}`],
        validatedConfig: null
      };
    }
  }

  /**
   * Serialize template package to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      type: this.type,
      author: this.author,
      keywords: [...this.keywords],
      dependencies: { ...this.dependencies },
      devDependencies: { ...this.devDependencies },
      configSchema: { ...this.configSchema },
      supportedVersions: [...this.supportedVersions],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      downloadCount: this.downloadCount,
      metadata: {
        isCompatible: (version) => this.isCompatible(version),
        config: this.getConfig()
      }
    };
  }

  /**
   * Create TemplatePackage from package.json data
   * @param {Object} packageData - Package.json data
   * @returns {TemplatePackage} New TemplatePackage instance
   */
  static fromPackageJson(packageData) {
    const templateData = {
      id: packageData.name,
      name: packageData.displayName || packageData.name,
      version: packageData.version,
      description: packageData.description,
      type: packageData.type,
      author: packageData.author,
      keywords: packageData.keywords,
      dependencies: packageData.dependencies,
      devDependencies: packageData.devDependencies,
      configSchema: packageData.configSchema,
      supportedVersions: packageData.supportedVersions,
      createdAt: packageData.createdAt,
      updatedAt: packageData.updatedAt,
      downloadCount: packageData.downloadCount
    };

    return new TemplatePackage(templateData);
  }

  /**
   * Get template type from package name
   * @param {string} packageName - Package name
   * @returns {string|null} Template type or null if not a template package
   */
  static getTemplateType(packageName) {
    const match = packageName.match(/^@xagi\/ai-template-(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Validate naming convention for template packages
   * @private
   * @returns {Object} Validation result
   */
  _validateNamingConvention() {
    const errors = [];

    // Must start with @xagi/ai-template-
    if (!this.id.startsWith('@xagi/ai-template-')) {
      errors.push('Template ID must follow naming convention: @xagi/ai-template-{type}');
      return { isValid: false, errors };
    }

    // Extract type from package name
    const templateType = TemplatePackage.getTemplateType(this.id);

    if (!templateType) {
      errors.push('Could not extract template type from package name');
      return { isValid: false, errors };
    }

    // Validate that the type from ID matches the type property
    if (this.type && templateType !== this.type) {
      errors.push(`Template type mismatch: package name suggests '${templateType}' but type property is '${this.type}'`);
      return { isValid: false, errors };
    }

    // Validate extracted type
    if (!TEMPLATE_TYPES.includes(templateType)) {
      errors.push(`Invalid template type '${templateType}'. Must be one of: ${TEMPLATE_TYPES.join(', ')}`);
      return { isValid: false, errors };
    }

    // If no type property is set, set it from the package name
    if (!this.type) {
      this.type = templateType;
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Validate dependency versions
   * @private
   * @param {Array} errors - Errors array to append to
   * @param {Array} warnings - Warnings array to append to
   */
  _validateDependencyVersions(errors, warnings) {
    const allDependencies = { ...this.dependencies, ...this.devDependencies };

    for (const [dep, version] of Object.entries(allDependencies)) {
      // Basic validation for version format
      if (typeof version !== 'string') {
        errors.push(`Invalid version format for dependency ${dep}: must be a string`);
        continue;
      }

      // Check if it's a valid npm version range
      try {
        semver.validRange(version);
      } catch (error) {
        warnings.push(`Potential invalid version range for ${dep}: ${version}`);
      }
    }
  }

  /**
   * Validate config schema
   * @private
   * @param {Array} errors - Errors array to append to
   */
  _validateConfigSchema(errors) {
    if (this.configSchema && Object.keys(this.configSchema).length > 0) {
      try {
        // Try to compile the schema to check if it's valid
        this.ajv.compile(this.configSchema);
      } catch (error) {
        errors.push(`Invalid JSON Schema: ${error.message}`);
      }
    }
  }

  /**
   * Update template metadata
   * @param {Object} updates - Updates to apply
   */
  update(updates) {
    const allowedFields = [
      'name', 'version', 'description', 'author', 'keywords',
      'dependencies', 'devDependencies', 'configSchema', 'supportedVersions'
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        this[key] = value;
      }
    }

    this.updatedAt = new Date().toISOString();

    // Re-validate after update
    return this.validate();
  }

  /**
   * Increment download count
   */
  incrementDownloadCount() {
    this.downloadCount += 1;
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = TemplatePackage;
