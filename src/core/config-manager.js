const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { ConfigurationError, ValidationError } = require('./error-handler');
const Logger = require('./logger');

/**
 * Configuration Manager for centralized application configuration
 */
class ConfigManager {
  /**
   * Create a new ConfigManager
   * @param {Object} options - Configuration options
   * @param {string} options.configDir - Configuration directory
   * @param {string} options.configFile - Configuration file name
   * @param {boolean} options.enableEncryption - Enable sensitive data encryption
   * @param {Logger} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.configDir = options.configDir || path.join(os.homedir(), '.xagi', 'create-ai-project');
    this.configFile = options.configFile || 'config.json';
    this.enableEncryption = options.enableEncryption !== false;
    this.logger = options.logger || Logger.create('ConfigManager');

    this.configPath = path.join(this.configDir, this.configFile);
    this.encryptionKey = null;
    this.config = null;
    this.schema = null;
    this.watchers = new Set();
    this.isWatching = false;

    // Default configuration schema
    this.initializeSchema();
  }

  /**
   * Initialize configuration schema
   * @private
   */
  initializeSchema() {
    this.schema = {
      type: 'object',
      properties: {
        // General settings
        general: {
          type: 'object',
          properties: {
            defaultTemplateType: {
              type: 'string',
              enum: ['react-next', 'node-api', 'vue-app'],
              default: 'react-next'
            },
            defaultRegistry: {
              type: 'string',
              default: 'npm-public'
            },
            defaultProjectDir: {
              type: 'string',
              default: process.cwd()
            },
            telemetryEnabled: {
              type: 'boolean',
              default: false
            },
            autoUpdate: {
              type: 'boolean',
              default: true
            }
          }
        },

        // Registry configuration
        registries: {
          type: 'object',
          properties: {
            'npm-public': {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  default: 'https://registry.npmjs.org'
                },
                enabled: {
                  type: 'boolean',
                  default: true
                },
                authToken: {
                  type: 'string',
                  sensitive: true
                }
              }
            },
            'github': {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  default: true
                },
                defaultBranch: {
                  type: 'string',
                  default: 'main'
                },
                authToken: {
                  type: 'string',
                  sensitive: true
                }
              }
            },
            'gitlab': {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  default: false
                },
                defaultBranch: {
                  type: 'string',
                  default: 'main'
                },
                authToken: {
                  type: 'string',
                  sensitive: true
                }
              }
            }
          }
        },

        // Cache settings
        cache: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: true
            },
            ttl: {
              type: 'number',
              default: 24 * 60 * 60 * 1000, // 24 hours
              minimum: 0
            },
            maxSize: {
              type: 'number',
              default: 100 * 1024 * 1024, // 100MB
              minimum: 0
            },
            dir: {
              type: 'string',
              default: path.join(this.configDir, 'cache')
            }
          }
        },

        // Logging settings
        logging: {
          type: 'object',
          properties: {
            level: {
              type: 'string',
              enum: ['error', 'warn', 'info', 'debug', 'trace'],
              default: 'info'
            },
            enableConsole: {
              type: 'boolean',
              default: true
            },
            enableFile: {
              type: 'boolean',
              default: true
            },
            logDir: {
              type: 'string',
              default: path.join(this.configDir, 'logs')
            },
            maxFileSize: {
              type: 'number',
              default: 10 * 1024 * 1024, // 10MB
              minimum: 1024 * 1024 // 1MB
            },
            maxFiles: {
              type: 'number',
              default: 5,
              minimum: 1
            }
          }
        },

        // Security settings
        security: {
          type: 'object',
          properties: {
            validateTemplates: {
              type: 'boolean',
              default: true
            },
            scanForMalware: {
              type: 'boolean',
              default: true
            },
            allowInsecureRegistries: {
              type: 'boolean',
              default: false
            },
            encryptionEnabled: {
              type: 'boolean',
              default: true
            }
          }
        },

        // Performance settings
        performance: {
          type: 'object',
          properties: {
            enableMonitoring: {
              type: 'boolean',
              default: true
            },
            slowThreshold: {
              type: 'number',
              default: 1000,
              minimum: 100
            },
            criticalThreshold: {
              type: 'number',
              default: 5000,
              minimum: 1000
            },
            metricsRetention: {
              type: 'number',
              default: 7 * 24 * 60 * 60 * 1000, // 7 days
              minimum: 24 * 60 * 60 * 1000 // 1 day
            }
          }
        },

        // Network settings
        network: {
          type: 'object',
          properties: {
            timeout: {
              type: 'number',
              default: 30000,
              minimum: 5000
            },
            retryAttempts: {
              type: 'number',
              default: 3,
              minimum: 0,
              maximum: 10
            },
            retryDelay: {
              type: 'number',
              default: 1000,
              minimum: 100
            },
            proxy: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  default: false
                },
                url: {
                  type: 'string'
                },
                username: {
                  type: 'string',
                  sensitive: true
                },
                password: {
                  type: 'string',
                  sensitive: true
                }
              }
            }
          }
        }
      }
    };
  }

  /**
   * Initialize configuration manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Ensure config directory exists
      await fs.ensureDir(this.configDir);

      // Initialize encryption key if enabled
      if (this.enableEncryption) {
        await this.initializeEncryption();
      }

      // Load existing configuration or create default
      await this.loadConfiguration();

      this.logger.info('Configuration manager initialized', {
        configPath: this.configPath,
        encryptionEnabled: this.enableEncryption
      });
    } catch (error) {
      this.logger.error('Failed to initialize configuration manager', { error: error.message });
      throw new ConfigurationError('Failed to initialize configuration manager', 'INIT_ERROR', {}, error);
    }
  }

  /**
   * Initialize encryption key
   * @private
   */
  async initializeEncryption() {
    const keyPath = path.join(this.configDir, '.encryption_key');

    try {
      if (await fs.pathExists(keyPath)) {
        const keyData = await fs.readFile(keyPath, 'utf8');
        this.encryptionKey = Buffer.from(keyData, 'hex');
      } else {
        // Generate new encryption key
        this.encryptionKey = crypto.randomBytes(32);
        await fs.writeFile(keyPath, this.encryptionKey.toString('hex'), 'utf8');
        await fs.chmod(keyPath, '0600'); // Read/write only for owner
      }
    } catch (error) {
      this.logger.warn('Failed to initialize encryption key', { error: error.message });
      this.enableEncryption = false;
    }
  }

  /**
   * Load configuration from file
   * @private
   */
  async loadConfiguration() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const configData = await fs.readFile(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);

        // Decrypt sensitive values if encryption is enabled
        if (this.enableEncryption && this.encryptionKey) {
          this.decryptSensitiveValues(loadedConfig);
        }

        // Merge with default configuration
        this.config = this.mergeWithDefaults(loadedConfig);
      } else {
        // Create default configuration
        this.config = this.getDefaultConfiguration();
        await this.saveConfiguration();
      }

      // Validate configuration
      this.validateConfiguration();
    } catch (error) {
      this.logger.error('Failed to load configuration', { error: error.message });
      this.config = this.getDefaultConfiguration();
      await this.saveConfiguration();
    }
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration
   * @private
   */
  getDefaultConfiguration() {
    const config = {};

    // Extract default values from schema
    const extractDefaults = (schema) => {
      const result = {};
      for (const [key, value] of Object.entries(schema.properties || {})) {
        if (value.default !== undefined) {
          result[key] = value.default;
        } else if (value.type === 'object') {
          result[key] = extractDefaults(value);
        }
      }
      return result;
    };

    return extractDefaults(this.schema);
  }

  /**
   * Merge configuration with defaults
   * @param {Object} userConfig - User configuration
   * @returns {Object} Merged configuration
   * @private
   */
  mergeWithDefaults(userConfig) {
    const defaults = this.getDefaultConfiguration();
    return this.deepMerge(defaults, userConfig);
  }

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   * @private
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Encrypt sensitive values in configuration
   * @param {Object} config - Configuration object
   * @private
   */
  encryptSensitiveValues(config) {
    const encryptObject = (obj, schema) => {
      for (const [key, value] of Object.entries(obj)) {
        const propertySchema = schema.properties?.[key];

        if (propertySchema?.sensitive && value && typeof value === 'string') {
          const iv = crypto.randomBytes(16);
          const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
          let encrypted = cipher.update(value, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          obj[key] = `${iv.toString('hex')}:${encrypted}`;
        } else if (value && typeof value === 'object' && propertySchema) {
          encryptObject(value, propertySchema);
        }
      }
    };

    encryptObject(config, this.schema);
  }

  /**
   * Decrypt sensitive values in configuration
   * @param {Object} config - Configuration object
   * @private
   */
  decryptSensitiveValues(config) {
    const decryptObject = (obj, schema) => {
      for (const [key, value] of Object.entries(obj)) {
        const propertySchema = schema.properties?.[key];

        if (propertySchema?.sensitive && value && typeof value === 'string') {
          try {
            const [ivHex, encrypted] = value.split(':');
            if (ivHex && encrypted) {
              const iv = Buffer.from(ivHex, 'hex');
              const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
              let decrypted = decipher.update(encrypted, 'hex', 'utf8');
              decrypted += decipher.final('utf8');
              obj[key] = decrypted;
            }
          } catch (error) {
            this.logger.warn(`Failed to decrypt ${key}`, { error: error.message });
          }
        } else if (value && typeof value === 'object' && propertySchema) {
          decryptObject(value, propertySchema);
        }
      }
    };

    decryptObject(config, this.schema);
  }

  /**
   * Validate configuration against schema
   * @private
   */
  validateConfiguration() {
    const errors = [];

    const validateObject = (obj, schema, path = '') => {
      if (schema.type === 'object' && obj) {
        for (const [key, value] of Object.entries(obj)) {
          const propertySchema = schema.properties?.[key];

          if (!propertySchema) {
            errors.push(`Unknown property: ${path}${key}`);
            continue;
          }

          const fullPath = path ? `${path}.${key}` : key;

          // Type validation
          if (propertySchema.type && typeof value !== propertySchema.type) {
            errors.push(`Invalid type for ${fullPath}: expected ${propertySchema.type}, got ${typeof value}`);
          }

          // Enum validation
          if (propertySchema.enum && !propertySchema.enum.includes(value)) {
            errors.push(`Invalid value for ${fullPath}: must be one of [${propertySchema.enum.join(', ')}]`);
          }

          // Range validation
          if (propertySchema.minimum !== undefined && value < propertySchema.minimum) {
            errors.push(`Value for ${fullPath} must be >= ${propertySchema.minimum}`);
          }
          if (propertySchema.maximum !== undefined && value > propertySchema.maximum) {
            errors.push(`Value for ${fullPath} must be <= ${propertySchema.maximum}`);
          }

          // Recursive validation
          if (propertySchema.type === 'object') {
            validateObject(value, propertySchema, `${fullPath}.`);
          }
        }
      }
    };

    validateObject(this.config, this.schema);

    if (errors.length > 0) {
      throw new ValidationError('Configuration validation failed', { errors });
    }
  }

  /**
   * Save configuration to file
   * @returns {Promise<void>}
   */
  async saveConfiguration() {
    try {
      // Create a copy for saving
      const configToSave = JSON.parse(JSON.stringify(this.config));

      // Encrypt sensitive values if encryption is enabled
      if (this.enableEncryption && this.encryptionKey) {
        this.encryptSensitiveValues(configToSave);
      }

      await fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2));
      this.logger.debug('Configuration saved', { configPath: this.configPath });
    } catch (error) {
      this.logger.error('Failed to save configuration', { error: error.message });
      throw new ConfigurationError('Failed to save configuration', 'SAVE_ERROR', {}, error);
    }
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key (dot notation supported)
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key (dot notation supported)
   * @param {*} value - Value to set
   * @returns {Promise<void>}
   */
  async set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.config;

    // Navigate to parent object
    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    // Set value
    target[lastKey] = value;

    // Validate and save
    try {
      this.validateConfiguration();
      await this.saveConfiguration();
      this.logger.debug('Configuration updated', { key, value: typeof value === 'object' ? '[object]' : value });
    } catch (error) {
      this.logger.error('Failed to set configuration', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Delete configuration value
   * @param {string} key - Configuration key (dot notation supported)
   * @returns {Promise<void>}
   */
  async delete(key) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.config;

    // Navigate to parent object
    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== 'object') {
        return; // Key doesn't exist
      }
      target = target[k];
    }

    // Delete value
    if (lastKey in target) {
      delete target[lastKey];
      await this.saveConfiguration();
      this.logger.debug('Configuration deleted', { key });
    }
  }

  /**
   * Get all configuration
   * @returns {Object} Complete configuration
   */
  getAll() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<void>}
   */
  async reset() {
    this.config = this.getDefaultConfiguration();
    await this.saveConfiguration();
    this.logger.info('Configuration reset to defaults');
  }

  /**
   * Watch configuration file for changes
   * @param {Function} callback - Change callback
   */
  async watch(callback) {
    if (this.isWatching) {
      return;
    }

    try {
      const watcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          try {
            await this.loadConfiguration();
            if (callback) {
              callback(this.config);
            }
          } catch (error) {
            this.logger.error('Failed to reload configuration', { error: error.message });
          }
        }
      });

      this.watchers.add(watcher);
      this.isWatching = true;

      this.logger.info('Configuration watcher started');
    } catch (error) {
      this.logger.error('Failed to start configuration watcher', { error: error.message });
    }
  }

  /**
   * Stop watching configuration file
   */
  stopWatching() {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
    this.isWatching = false;
    this.logger.info('Configuration watcher stopped');
  }

  /**
   * Export configuration
   * @param {boolean} includeSensitive - Include sensitive values
   * @returns {Object} Exported configuration
   */
  export(includeSensitive = false) {
    const exported = JSON.parse(JSON.stringify(this.config));

    if (!includeSensitive) {
      const removeSensitive = (obj, schema) => {
        for (const [key, value] of Object.entries(obj)) {
          const propertySchema = schema.properties?.[key];

          if (propertySchema?.sensitive) {
            delete obj[key];
          } else if (value && typeof value === 'object' && propertySchema) {
            removeSensitive(value, propertySchema);
          }
        }
      };

      removeSensitive(exported, this.schema);
    }

    return exported;
  }

  /**
   * Import configuration
   * @param {Object} importedConfig - Configuration to import
   * @param {boolean} merge - Merge with existing configuration
   * @returns {Promise<void>}
   */
  async import(importedConfig, merge = true) {
    try {
      if (merge) {
        this.config = this.deepMerge(this.config, importedConfig);
      } else {
        this.config = importedConfig;
      }

      this.validateConfiguration();
      await this.saveConfiguration();
      this.logger.info('Configuration imported', { merge });
    } catch (error) {
      this.logger.error('Failed to import configuration', { error: error.message });
      throw error;
    }
  }

  /**
   * Get configuration schema
   * @returns {Object} Configuration schema
   */
  getSchema() {
    return JSON.parse(JSON.stringify(this.schema));
  }

  /**
   * Get configuration statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      configPath: this.configPath,
      configDir: this.configDir,
      encryptionEnabled: this.enableEncryption,
      isWatching: this.isWatching,
      watcherCount: this.watchers.size,
      configSize: JSON.stringify(this.config).length
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopWatching();
  }
}

module.exports = ConfigManager;