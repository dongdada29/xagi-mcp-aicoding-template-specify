/**
 * ProjectConfiguration Model
 * Represents user-specified parameters for project customization
 *
 * This model manages the configuration for creating projects from templates,
 * including validation against template schemas and proper serialization.
 */

const {
  validateProjectName,
  validateFilePath,
  validateConfig,
  validateRegistryUrl
} = require('../utils/validation');

const CONFIG_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

/**
 * Custom error class for ProjectConfiguration validation errors
 */
class ConfigurationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ConfigurationError';
    this.field = field;
    this.isConfigurationError = true;
  }
}

/**
 * ProjectConfiguration class manages user-specified parameters for project customization
 */
class ProjectConfiguration {
  /**
   * Create a new ProjectConfiguration instance
   * @param {Object} config - Configuration object
   * @param {string} config.id - Unique configuration identifier
   * @param {string} config.templateId - Reference to TemplatePackage
   * @param {string} config.projectName - Name of the project to create
   * @param {string} config.projectPath - Target directory path
   * @param {string} config.version - Template version to use
   * @param {Object} config.configValues - User-provided configuration values
   * @param {Object} config.overrides - Configuration overrides for template
   * @param {string} config.registry - npm registry to use (defaults to public)
   * @param {string} config.authToken - Authentication token for private registries
   * @param {Date|string} config.createdAt - Configuration creation timestamp
   * @param {string} config.status - Configuration status (draft, active, completed, failed)
   */
  constructor(config = {}) {
    // Generate ID if not provided
    this.id = config.id || this._generateId();

    // Validate required fields
    if (!config.templateId) {
      throw new ConfigurationError('templateId is required', 'templateId');
    }
    if (!config.projectName) {
      throw new ConfigurationError('projectName is required', 'projectName');
    }
    if (!config.projectPath) {
      throw new ConfigurationError('projectPath is required', 'projectPath');
    }

    // Set properties with validation
    this.templateId = config.templateId;
    this.projectName = config.projectName;
    this.projectPath = config.projectPath;
    this.version = config.version || 'latest';
    this.configValues = config.configValues || {};
    this.overrides = config.overrides || {};
    this.registry = config.registry || DEFAULT_REGISTRY;
    this.authToken = config.authToken || null;
    this.createdAt = config.createdAt ? new Date(config.createdAt) : new Date();
    this.status = config.status || CONFIG_STATUS.DRAFT;

    // Validate configuration after construction
    this._validateRequiredFields();
  }

  /**
   * Generate a unique configuration ID
   * @private
   * @returns {string} Unique identifier
   */
  _generateId() {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate all required fields
   * @private
   * @throws {ConfigurationError} If validation fails
   */
  _validateRequiredFields() {
    // Validate template ID
    if (typeof this.templateId !== 'string' || this.templateId.trim().length === 0) {
      throw new ConfigurationError('templateId must be a non-empty string', 'templateId');
    }

    // Validate project name
    const nameValidation = validateProjectName(this.projectName);
    if (!nameValidation.isValid) {
      throw new ConfigurationError(
        `Invalid project name: ${nameValidation.errors.join(', ')}`,
        'projectName'
      );
    }

    // Validate project path
    const pathValidation = validateFilePath(this.projectPath);
    if (!pathValidation.isValid) {
      throw new ConfigurationError(
        `Invalid project path: ${pathValidation.errors.join(', ')}`,
        'projectPath'
      );
    }

    // Validate version
    if (typeof this.version !== 'string' || this.version.trim().length === 0) {
      throw new ConfigurationError('version must be a non-empty string', 'version');
    }

    // Validate registry URL
    const registryValidation = validateRegistryUrl(this.registry);
    if (!registryValidation.isValid) {
      throw new ConfigurationError(
        `Invalid registry URL: ${registryValidation.errors.join(', ')}`,
        'registry'
      );
    }

    // Validate status
    if (!Object.values(CONFIG_STATUS).includes(this.status)) {
      throw new ConfigurationError(
        `Invalid status: ${this.status}. Must be one of: ${Object.values(CONFIG_STATUS).join(', ')}`,
        'status'
      );
    }

    // Validate configValues and overrides are objects
    if (typeof this.configValues !== 'object' || this.configValues === null) {
      throw new ConfigurationError('configValues must be an object', 'configValues');
    }

    if (typeof this.overrides !== 'object' || this.overrides === null) {
      throw new ConfigurationError('overrides must be an object', 'overrides');
    }
  }

  /**
   * Validate configuration against template schema
   * @param {Object} templateSchema - Template configuration schema
   * @returns {Object} Validation result
   */
  validate(templateSchema = null) {
    try {
      // Validate basic configuration structure
      this._validateRequiredFields();

      // Validate against template schema if provided
      if (templateSchema) {
        const configValidation = validateConfig({
          ...this.configValues,
          ...this.overrides
        }, templateSchema);

        if (!configValidation.isValid) {
          return {
            isValid: false,
            errors: ['Template schema validation failed', ...configValidation.errors],
            warnings: configValidation.warnings || []
          };
        }

        return {
          isValid: true,
          errors: [],
          warnings: configValidation.warnings || []
        };
      }

      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   * @throws {ConfigurationError} If key or value is invalid
   */
  setConfig(key, value) {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new ConfigurationError('key must be a non-empty string', 'key');
    }

    // Set nested property support
    if (key.includes('.')) {
      const keys = key.split('.');
      let current = this.configValues;

      // Navigate to parent object
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      // Set the final value
      current[keys[keys.length - 1]] = value;
    } else {
      this.configValues[key] = value;
    }
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @param {any} defaultValue - Default value if key not found
   * @returns {any} Configuration value
   */
  getConfig(key, defaultValue) {
    if (!key || typeof key !== 'string') {
      return defaultValue;
    }

    // Support nested property access
    if (key.includes('.')) {
      const keys = key.split('.');
      let current = this.configValues;

      for (const k of keys) {
        if (!current || typeof current !== 'object' || !(k in current)) {
          return defaultValue;
        }
        current = current[k];
      }

      return current;
    }

    return this.configValues[key] ?? defaultValue;
  }

  /**
   * Set a configuration override
   * @param {string} key - Override key
   * @param {any} value - Override value
   * @throws {ConfigurationError} If key or value is invalid
   */
  setOverride(key, value) {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new ConfigurationError('key must be a non-empty string', 'key');
    }

    this.overrides[key] = value;
  }

  /**
   * Get a configuration override
   * @param {string} key - Override key
   * @param {any} defaultValue - Default value if key not found
   * @returns {any} Override value
   */
  getOverride(key, defaultValue) {
    if (!key || typeof key !== 'string') {
      return defaultValue;
    }
    return this.overrides[key] ?? defaultValue;
  }

  /**
   * Update configuration status
   * @param {string} status - New status
   * @throws {ConfigurationError} If status is invalid
   */
  updateStatus(status) {
    if (!Object.values(CONFIG_STATUS).includes(status)) {
      throw new ConfigurationError(
        `Invalid status: ${status}. Must be one of: ${Object.values(CONFIG_STATUS).join(', ')}`,
        'status'
      );
    }
    this.status = status;
  }

  /**
   * Serialize configuration to JSON
   * @returns {Object} JSON-serializable object
   */
  toJSON() {
    return {
      id: this.id,
      templateId: this.templateId,
      projectName: this.projectName,
      projectPath: this.projectPath,
      version: this.version,
      configValues: this.configValues,
      overrides: this.overrides,
      registry: this.registry,
      authToken: this.authToken,
      createdAt: this.createdAt.toISOString(),
      status: this.status
    };
  }

  /**
   * Create a copy of the configuration
   * @param {Object} overrides - Optional properties to override in the clone
   * @returns {ProjectConfiguration} New configuration instance
   */
  clone(overrides = {}) {
    const configData = {
      ...this.toJSON(),
      id: overrides.id, // Generate new ID unless specified
      ...overrides
    };

    // Remove undefined values
    Object.keys(configData).forEach(key => {
      if (typeof configData[key] === 'undefined') {
        delete configData[key];
      }
    });

    return new ProjectConfiguration(configData);
  }

  /**
   * Create ProjectConfiguration from JSON object
   * @param {Object} json - JSON object
   * @returns {ProjectConfiguration} Configuration instance
   * @throws {ConfigurationError} If JSON is invalid
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new ConfigurationError('Invalid JSON: must be an object');
    }

    try {
      return new ProjectConfiguration(json);
    } catch (error) {
      throw new ConfigurationError(`Failed to create configuration from JSON: ${error.message}`);
    }
  }

  /**
   * Create ProjectConfiguration from JSON string
   * @param {string} jsonString - JSON string
   * @returns {ProjectConfiguration} Configuration instance
   * @throws {ConfigurationError} If JSON string is invalid
   */
  static fromJSONString(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new ConfigurationError('Invalid JSON string');
    }

    try {
      const json = JSON.parse(jsonString);
      return ProjectConfiguration.fromJSON(json);
    } catch (error) {
      throw new ConfigurationError(`Failed to parse JSON string: ${error.message}`);
    }
  }

  /**
   * Get configuration status constants
   * @returns {Object} Status constants
   */
  static get Status() {
    return CONFIG_STATUS;
  }

  /**
   * Get default registry URL
   * @returns {string} Default registry URL
   */
  static get DefaultRegistry() {
    return DEFAULT_REGISTRY;
  }
}

module.exports = {
  ProjectConfiguration,
  ConfigurationError,
  CONFIG_STATUS,
  DEFAULT_REGISTRY
};
