const Logger = require('../core/logger');

/**
 * Environment variable utility with validation and type conversion
 */
class EnvironmentManager {
  constructor() {
    this.logger = Logger.create('EnvironmentManager');
    this.definedVars = new Map();
  }

  /**
   * Get environment variable with type conversion and default value
   * @param {string} key - Environment variable key
   * @param {Object} options - Options
   * @param {*} options.default - Default value
   * @param {string} options.type - Expected type ('string', 'number', 'boolean', 'json')
   * @param {boolean} options.required - Whether variable is required
   * @param {RegExp} options.pattern - Validation pattern
   * @param {Array} options.enum - Allowed values
   * @returns {*} Environment variable value
   */
  get(key, options = {}) {
    const {
      default: defaultValue,
      type = 'string',
      required = false,
      pattern,
      enum: allowedValues
    } = options;

    let value = process.env[key];

    // Handle required variables
    if (required && value === undefined) {
      throw new Error(`Required environment variable '${key}' is not defined`);
    }

    // Use default value if not set
    if (value === undefined) {
      value = defaultValue;
    }

    // Return undefined if no value and no default
    if (value === undefined) {
      return undefined;
    }

    // Type conversion
    try {
      value = this.convertType(value, type);
    } catch (error) {
      this.logger.error(`Failed to convert environment variable '${key}' to type '${type}'`, { error: error.message });
      throw error;
    }

    // Validation
    if (pattern && !pattern.test(String(value))) {
      throw new Error(`Environment variable '${key}' does not match required pattern`);
    }

    if (allowedValues && !allowedValues.includes(value)) {
      throw new Error(`Environment variable '${key}' must be one of: ${allowedValues.join(', ')}`);
    }

    // Cache the variable for tracking
    this.definedVars.set(key, { value, type, required });

    return value;
  }

  /**
   * Convert value to specified type
   * @param {*} value - Value to convert
   * @param {string} type - Target type
   * @returns {*} Converted value
   * @private
   */
  convertType(value, type) {
    if (value === null || value === undefined) {
      return value;
    }

    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Cannot convert '${value}' to number`);
        }
        return num;
      case 'boolean':
        const str = String(value).toLowerCase();
        if (str === 'true' || str === '1') return true;
        if (str === 'false' || str === '0') return false;
        throw new Error(`Cannot convert '${value}' to boolean`);
      case 'json':
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error(`Cannot convert '${value}' to JSON: ${error.message}`);
        }
      case 'array':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value.split(',').map(item => item.trim());
          }
        }
        throw new Error(`Cannot convert '${value}' to array`);
      case 'object':
        if (typeof value === 'object') return value;
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error(`Cannot convert '${value}' to object: ${error.message}`);
        }
      default:
        return value;
    }
  }

  /**
   * Get all environment variables with XAGI_ prefix
   * @returns {Object} XAGI environment variables
   */
  getXagiVariables() {
    const xagiVars = {};
    const prefix = 'XAGI_';

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        xagiVars[key] = value;
      }
    }

    return xagiVars;
  }

  /**
   * Validate required environment variables
   * @param {Array} requiredVars - Required variable definitions
   * @returns {Object} Validation result
   */
  validateRequired(requiredVars) {
    const errors = [];
    const missing = [];
    const invalid = [];

    for (const { key, ...options } of requiredVars) {
      try {
        this.get(key, { ...options, required: true });
      } catch (error) {
        if (error.message.includes('not defined')) {
          missing.push(key);
        } else {
          invalid.push({ key, error: error.message });
        }
      }
    }

    return {
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
      errors: [...missing.map(key => `${key} is missing`), ...invalid.map(item => `${item.key}: ${item.error}`)]
    };
  }

  /**
   * Create configuration from environment variables
   * @param {Object} schema - Configuration schema
   * @returns {Object} Configuration object
   */
  createConfigFromEnv(schema) {
    const config = {};

    for (const [configKey, envMapping] of Object.entries(schema)) {
      const envKey = typeof envMapping === 'string' ? envMapping : envMapping.env;
      const options = typeof envMapping === 'object' ? envMapping : {};

      try {
        const value = this.get(envKey, options);
        if (value !== undefined) {
          this.setNestedValue(config, configKey, value);
        }
      } catch (error) {
        this.logger.warn(`Failed to load environment variable ${envKey} for ${configKey}`, { error: error.message });
      }
    }

    return config;
  }

  /**
   * Set nested value in object
   * @param {Object} obj - Target object
   * @param {string} path - Dot-separated path
   * @param {*} value - Value to set
   * @private
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get environment variable info
   * @returns {Object} Environment variable information
   */
  getInfo() {
    return {
      definedVariables: Object.fromEntries(this.definedVars),
      xagiVariables: this.getXagiVariables(),
      totalVariables: Object.keys(process.env).length,
      nodeEnvironment: process.env.NODE_ENV,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * Check if running in specific environment
   * @param {string} env - Environment name
   * @returns {boolean}
   */
  isEnvironment(env) {
    return process.env.NODE_ENV === env;
  }

  /**
   * Check if running in development
   * @returns {boolean}
   */
  isDevelopment() {
    return this.isEnvironment('development') || !process.env.NODE_ENV;
  }

  /**
   * Check if running in production
   * @returns {boolean}
   */
  isProduction() {
    return this.isEnvironment('production');
  }

  /**
   * Check if running in test
   * @returns {boolean}
   */
  isTest() {
    return this.isEnvironment('test');
  }

  /**
   * Get environment-specific configuration
   * @param {Object} configs - Environment-specific configurations
   * @returns {Object} Configuration for current environment
   */
  getEnvironmentConfig(configs = {}) {
    const env = process.env.NODE_ENV || 'development';
    return configs[env] || configs.development || {};
  }

  /**
   * Expand environment variables in a string
   * @param {string} str - String with environment variables
   * @returns {string} Expanded string
   */
  expandVariables(str) {
    return str.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g, (match, braced, unbraced) => {
      const key = braced || unbraced;
      return process.env[key] || match;
    });
  }

  /**
   * Load environment variables from .env file
   * @param {string} filePath - Path to .env file
   * @returns {Promise<void>}
   */
  async loadDotEnv(filePath = '.env') {
    try {
      const fs = require('fs-extra');
      const path = require('path');

      if (await fs.pathExists(filePath)) {
        const envContent = await fs.readFile(filePath, 'utf8');
        const lines = envContent.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
              const [, key, value] = match;
              // Remove quotes if present
              const cleanValue = value.replace(/^["']|["']$/g, '');
              process.env[key] = cleanValue;
            }
          }
        }

        this.logger.info(`Loaded environment variables from ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to load .env file from ${filePath}`, { error: error.message });
    }
  }
}

// Environment variable definitions
const ENV_VARIABLES = {
  // General
  'XAGI_CONFIG_DIR': {
    env: 'XAGI_CONFIG_DIR',
    type: 'string',
    default: '~/.xagi/create-ai-project',
    description: 'Configuration directory path'
  },
  'XAGI_LOG_LEVEL': {
    env: 'XAGI_LOG_LEVEL',
    type: 'string',
    enum: ['error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
    description: 'Logging level'
  },
  'XAGI_NODE_ENV': {
    env: 'NODE_ENV',
    type: 'string',
    enum: ['development', 'production', 'test'],
    default: 'development',
    description: 'Node.js environment'
  },

  // Network
  'XAGI_NETWORK_TIMEOUT': {
    env: 'XAGI_NETWORK_TIMEOUT',
    type: 'number',
    default: 30000,
    description: 'Network timeout in milliseconds'
  },
  'XAGI_PROXY_URL': {
    env: 'XAGI_PROXY_URL',
    type: 'string',
    description: 'Proxy URL for network requests'
  },
  'XAGI_RETRY_ATTEMPTS': {
    env: 'XAGI_RETRY_ATTEMPTS',
    type: 'number',
    default: 3,
    description: 'Number of retry attempts for failed requests'
  },

  // Authentication
  'XAGI_NPM_TOKEN': {
    env: 'XAGI_NPM_TOKEN',
    type: 'string',
    sensitive: true,
    description: 'NPM authentication token'
  },
  'XAGI_GITHUB_TOKEN': {
    env: 'XAGI_GITHUB_TOKEN',
    type: 'string',
    sensitive: true,
    description: 'GitHub authentication token'
  },
  'XAGI_GITLAB_TOKEN': {
    env: 'XAGI_GITLAB_TOKEN',
    type: 'string',
    sensitive: true,
    description: 'GitLab authentication token'
  },

  // Features
  'XAGI_TELEMETRY_ENABLED': {
    env: 'XAGI_TELEMETRY_ENABLED',
    type: 'boolean',
    default: false,
    description: 'Enable telemetry collection'
  },
  'XAGI_AUTO_UPDATE': {
    env: 'XAGI_AUTO_UPDATE',
    type: 'boolean',
    default: true,
    description: 'Enable automatic updates'
  },
  'XAGI_CACHE_ENABLED': {
    env: 'XAGI_CACHE_ENABLED',
    type: 'boolean',
    default: true,
    description: 'Enable caching'
  },

  // Security
  'XAGI_VALIDATE_TEMPLATES': {
    env: 'XAGI_VALIDATE_TEMPLATES',
    type: 'boolean',
    default: true,
    description: 'Enable template validation'
  },
  'XAGI_SCAN_MALWARE': {
    env: 'XAGI_SCAN_MALWARE',
    type: 'boolean',
    default: true,
    description: 'Enable malware scanning'
  },

  // Performance
  'XAGI_ENABLE_MONITORING': {
    env: 'XAGI_ENABLE_MONITORING',
    type: 'boolean',
    default: true,
    description: 'Enable performance monitoring'
  },
  'XAGI_SLOW_THRESHOLD': {
    env: 'XAGI_SLOW_THRESHOLD',
    type: 'number',
    default: 1000,
    description: 'Slow operation threshold in milliseconds'
  }
};

// Export singleton instance
const environmentManager = new EnvironmentManager();

module.exports = {
  EnvironmentManager,
  environmentManager,
  ENV_VARIABLES
};