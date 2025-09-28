const ConfigManager = require('../core/config-manager');
const Logger = require('../core/logger');
const { ConfigurationError } = require('../core/error-handler');
const { environmentManager, ENV_VARIABLES } = require('./environment');

/**
 * Application configuration utility
 * Provides centralized access to configuration with lazy initialization
 */
class AppConfig {
  constructor() {
    this.configManager = null;
    this.initialized = false;
    this.initializePromise = null;
  }

  /**
   * Initialize configuration manager
   * @param {Object} options - Initialization options
   * @returns {Promise<ConfigManager>}
   */
  async initialize(options = {}) {
    if (this.initialized) {
      return this.configManager;
    }

    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this.doInitialize(options);
    return this.initializePromise;
  }

  /**
   * Perform initialization
   * @param {Object} options - Initialization options
   * @returns {Promise<ConfigManager>}
   * @private
   */
  async doInitialize(options) {
    try {
      this.configManager = new ConfigManager({
        logger: options.logger || Logger.create('AppConfig'),
        ...options
      });

      await this.configManager.initialize();
      this.initialized = true;

      return this.configManager;
    } catch (error) {
      this.initializePromise = null;
      throw new ConfigurationError('Failed to initialize application configuration', 'INIT_ERROR', {}, error);
    }
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value
   * @returns {Promise<*>} Configuration value
   */
  async get(key, defaultValue = undefined) {
    await this.initialize();
    return this.configManager.get(key, defaultValue);
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    await this.initialize();
    return this.configManager.set(key, value);
  }

  /**
   * Get all configuration
   * @returns {Promise<Object>} Complete configuration
   */
  async getAll() {
    await this.initialize();
    return this.configManager.getAll();
  }

  /**
   * Create service configurations
   * @returns {Promise<Object>} Service configurations
   */
  async createServiceConfigs() {
    await this.initialize();

    return {
      // Logger configuration
      logger: {
        level: await this.get('logging.level', 'info'),
        enableConsole: await this.get('logging.enableConsole', true),
        enableFile: await this.get('logging.enableFile', true),
        logDir: await this.get('logging.logDir'),
        maxFileSize: await this.get('logging.maxFileSize', 10 * 1024 * 1024),
        maxFiles: await this.get('logging.maxFiles', 5)
      },

      // Cache configuration
      cache: {
        enabled: await this.get('cache.enabled', true),
        ttl: await this.get('cache.ttl', 24 * 60 * 60 * 1000),
        maxSize: await this.get('cache.maxSize', 100 * 1024 * 1024),
        dir: await this.get('cache.dir')
      },

      // Template registry configuration
      registries: await this.get('registries', {}),

      // Network configuration
      network: {
        timeout: await this.get('network.timeout', 30000),
        retryAttempts: await this.get('network.retryAttempts', 3),
        retryDelay: await this.get('network.retryDelay', 1000),
        proxy: await this.get('network.proxy', {})
      },

      // Security configuration
      security: {
        validateTemplates: await this.get('security.validateTemplates', true),
        scanForMalware: await this.get('security.scanForMalware', true),
        allowInsecureRegistries: await this.get('security.allowInsecureRegistries', false)
      },

      // Performance configuration
      performance: {
        enableMonitoring: await this.get('performance.enableMonitoring', true),
        slowThreshold: await this.get('performance.slowThreshold', 1000),
        criticalThreshold: await this.get('performance.criticalThreshold', 5000),
        metricsRetention: await this.get('performance.metricsRetention', 7 * 24 * 60 * 60 * 1000)
      }
    };
  }

  /**
   * Get environment variable fallbacks
   * @returns {Object} Environment variable mappings
   */
  getEnvironmentMappings() {
    return {
      'XAGI_LOG_LEVEL': 'logging.level',
      'XAGI_CONFIG_DIR': 'configDir',
      'XAGI_CACHE_DIR': 'cache.dir',
      'XAGI_LOG_DIR': 'logging.logDir',
      'XAGI_DEFAULT_REGISTRY': 'general.defaultRegistry',
      'XAGI_DEFAULT_TEMPLATE': 'general.defaultTemplateType',
      'XAGI_TELEMETRY_ENABLED': 'general.telemetryEnabled',
      'XAGI_AUTO_UPDATE': 'general.autoUpdate',
      'XAGI_NETWORK_TIMEOUT': 'network.timeout',
      'XAGI_PROXY_URL': 'network.proxy.url',
      'XAGI_RETRY_ATTEMPTS': 'network.retryAttempts',
      'XAGI_NPM_TOKEN': 'registries.npm-public.authToken',
      'XAGI_GITHUB_TOKEN': 'registries.github.authToken',
      'XAGI_GITLAB_TOKEN': 'registries.gitlab.authToken',
      'XAGI_VALIDATE_TEMPLATES': 'security.validateTemplates',
      'XAGI_SCAN_MALWARE': 'security.scanForMalware',
      'XAGI_ENABLE_MONITORING': 'performance.enableMonitoring',
      'XAGI_SLOW_THRESHOLD': 'performance.slowThreshold',
      'XAGI_CACHE_ENABLED': 'cache.enabled',
      'NODE_ENV': 'environment'
    };
  }

  /**
   * Load environment variables into configuration
   * @returns {Promise<void>}
   */
  async loadEnvironmentVariables() {
    await this.initialize();

    // Load .env file if it exists
    await environmentManager.loadDotEnv();

    const mappings = this.getEnvironmentMappings();
    const loadedVars = [];
    const validationErrors = [];

    for (const [envVar, configKey] of Object.entries(mappings)) {
      const envDefinition = ENV_VARIABLES[envVar];
      const envValue = process.env[envVar];

      if (envValue !== undefined) {
        try {
          // Use environment manager for proper type conversion and validation
          const parsedValue = environmentManager.get(envVar, {
            type: envDefinition?.type || 'string',
            default: envDefinition?.default,
            enum: envDefinition?.enum
          });

          await this.configManager.set(configKey, parsedValue);
          loadedVars.push(`${envVar} -> ${configKey} = ${parsedValue}`);
        } catch (error) {
          validationErrors.push(`${envVar}: ${error.message}`);
          const logger = Logger.create('AppConfig');
          logger.warn(`Failed to load environment variable ${envVar}`, { error: error.message });
        }
      }
    }

    // Log validation errors
    if (validationErrors.length > 0) {
      const logger = Logger.create('AppConfig');
      logger.warn('Environment variable validation errors', { errors: validationErrors });
    }

    if (loadedVars.length > 0) {
      const logger = Logger.create('AppConfig');
      logger.info('Loaded environment variables', { variables: loadedVars });
    }
  }

  /**
   * Get configuration status
   * @returns {Promise<Object>} Status information
   */
  async getStatus() {
    if (!this.initialized) {
      return { initialized: false };
    }

    return {
      initialized: true,
      configPath: this.configManager.configPath,
      configDir: this.configManager.configDir,
      encryptionEnabled: this.configManager.enableEncryption,
      environmentVariables: Object.keys(this.getEnvironmentMappings()).filter(key => process.env[key]),
      stats: this.configManager.getStats()
    };
  }

  /**
   * Destroy configuration manager
   */
  destroy() {
    if (this.configManager) {
      this.configManager.destroy();
      this.configManager = null;
    }
    this.initialized = false;
    this.initializePromise = null;
  }
}

// Export singleton instance
const appConfig = new AppConfig();

module.exports = {
  AppConfig,
  appConfig
};