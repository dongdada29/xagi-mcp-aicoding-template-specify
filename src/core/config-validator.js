/**
 * ConfigValidator Service
 * Validates project configurations using JSON Schema and custom validation rules
 *
 * This service provides comprehensive validation for project configurations,
 * including schema validation, project name validation, path validation,
 * and template-specific configuration validation.
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs').promises;
const path = require('path');
const { ProjectConfiguration } = require('../models/config');
const { validateProjectName, validateFilePath, validateRegistryUrl } = require('../utils/validation');

// Initialize AJV with additional formats
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
  coerceTypes: true,
  removeAdditional: false,
  schemas: [] // Don't add schemas automatically
});

// Add common formats
addFormats(ajv);

// Add custom formats for project-specific validation
ajv.addFormat('project-name', {
  validate: (value) => {
    const validation = validateProjectName(value);
    return validation.isValid;
  },
  type: 'string'
});

ajv.addFormat('file-path', {
  validate: (value) => {
    const validation = validateFilePath(value);
    return validation.isValid;
  },
  type: 'string'
});

ajv.addFormat('semver', {
  validate: (value) => {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semverRegex.test(value);
  },
  type: 'string'
});

/**
 * Custom error class for validation errors
 */
class ValidationError extends Error {
  constructor(message, field = null, suggestions = []) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.suggestions = suggestions;
    this.isValidationError = true;
  }
}

/**
 * ConfigValidator class provides comprehensive configuration validation
 */
class ConfigValidator {
  constructor() {
    this.schemas = new Map();
    this.validators = new Map();
    this.compiledSchemas = new Map();

    // Initialize common schemas
    this._initializeCommonSchemas();
  }

  /**
   * Initialize common project configuration schemas
   * @private
   */
  _initializeCommonSchemas() {
    // Project configuration schema
    const projectConfigSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://xagi.dev/schemas/project-config.json',
      title: 'Project Configuration',
      description: 'Configuration for project creation',
      type: 'object',
      required: ['templateId', 'projectName', 'projectPath'],
      properties: {
        templateId: {
          type: 'string',
          description: 'Template identifier',
          minLength: 1,
          pattern: '^[a-zA-Z0-9-_.]+$'
        },
        projectName: {
          type: 'string',
          description: 'Project name',
          format: 'project-name',
          minLength: 1,
          maxLength: 50
        },
        projectPath: {
          type: 'string',
          description: 'Project target path',
          format: 'file-path',
          minLength: 1
        },
        version: {
          type: 'string',
          description: 'Template version',
          minLength: 1,
          default: 'latest'
        },
        registry: {
          type: 'string',
          description: 'Registry URL',
          default: 'https://registry.npmjs.org'
        },
        authToken: {
          type: ['string', 'null'],
          description: 'Authentication token for private registries'
        },
        configValues: {
          type: 'object',
          description: 'Configuration values',
          default: {}
        },
        overrides: {
          type: 'object',
          description: 'Configuration overrides',
          default: {}
        },
        // Allow ProjectConfiguration internal properties
        id: {
          type: 'string',
          description: 'Configuration ID'
        },
        createdAt: {
          type: 'string',
          description: 'Creation timestamp',
          format: 'date-time'
        },
        status: {
          type: 'string',
          description: 'Configuration status',
          enum: ['draft', 'active', 'completed', 'failed']
        }
      },
      additionalProperties: false
    };

    // Template configuration schema
    const templateConfigSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'https://xagi.dev/schemas/template-config.json',
      title: 'Template Configuration',
      description: 'Configuration for template customization',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Template name',
          minLength: 1,
          maxLength: 100
        },
        version: {
          type: 'string',
          description: 'Template version',
          format: 'semver'
        },
        description: {
          type: 'string',
          description: 'Template description',
          maxLength: 500
        },
        author: {
          type: 'string',
          description: 'Template author',
          maxLength: 100
        },
        license: {
          type: 'string',
          description: 'Template license',
          enum: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0', 'ISC', 'UNLICENSED'],
          default: 'MIT'
        },
        repository: {
          type: 'string',
          description: 'Template repository URL',
          format: 'uri'
        },
        keywords: {
          type: 'array',
          description: 'Template keywords',
          items: {
            type: 'string',
            minLength: 1,
            maxLength: 50
          },
          maxItems: 20
        },
        engines: {
          type: 'object',
          description: 'Engine requirements',
          properties: {
            node: {
              type: 'string',
              description: 'Node.js version requirement'
            },
            npm: {
              type: 'string',
              description: 'npm version requirement'
            }
          },
          additionalProperties: true
        },
        dependencies: {
          type: 'object',
          description: 'Template dependencies',
          patternProperties: {
            '^[a-zA-Z0-9-_.]+$': {
              type: 'string',
              description: 'Dependency version'
            }
          },
          additionalProperties: false
        },
        devDependencies: {
          type: 'object',
          description: 'Development dependencies',
          patternProperties: {
            '^[a-zA-Z0-9-_.]+$': {
              type: 'string',
              description: 'Development dependency version'
            }
          },
          additionalProperties: false
        },
        scripts: {
          type: 'object',
          description: 'Build scripts',
          patternProperties: {
            '^[a-zA-Z0-9-_.]+$': {
              type: 'string',
              description: 'Script command'
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    };

    // Register common schemas
    this.registerSchema('project-config', projectConfigSchema);
    this.registerSchema('template-config', templateConfigSchema);
  }

  /**
   * Register a validation schema
   * @param {string} name - Schema name
   * @param {Object} schema - JSON Schema object
   * @throws {ValidationError} If schema is invalid
   */
  registerSchema(name, schema) {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Schema name is required and must be a string', 'name');
    }

    if (!schema || typeof schema !== 'object') {
      throw new ValidationError('Schema must be an object', 'schema');
    }

    // Create a deep copy of the schema to avoid modifying the original
    const schemaCopy = JSON.parse(JSON.stringify(schema));

    // Remove $id if it exists to prevent conflicts, or create a unique one
    if (schemaCopy.$id) {
      delete schemaCopy.$id;
    }

    try {
      // Create a unique ID for this schema instance
      schemaCopy.$id = `https://xagi.dev/schemas/${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;

      // Validate schema structure
      const schemaValidation = ajv.compile(schemaCopy);

      // Store original schema and compiled version
      this.schemas.set(name, schema);
      this.compiledSchemas.set(name, schemaValidation);
    } catch (error) {
      throw new ValidationError(`Invalid schema: ${error.message}`, 'schema');
    }
  }

  /**
   * Get a registered schema
   * @param {string} name - Schema name
   * @returns {Object} Schema object
   * @throws {ValidationError} If schema not found
   */
  getSchema(name) {
    if (!this.schemas.has(name)) {
      throw new ValidationError(`Schema '${name}' not found`, 'name');
    }
    return this.schemas.get(name);
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration object
   * @param {Object|string} schema - Schema object or schema name
   * @returns {Object} Validation result
   */
  validateConfiguration(config, schema) {
    try {
      // Get schema
      let schemaObj;
      let compiledValidator;

      if (typeof schema === 'string') {
        if (!this.compiledSchemas.has(schema)) {
          throw new ValidationError(`Schema '${schema}' not registered`, 'schema');
        }
        schemaObj = this.schemas.get(schema);
        compiledValidator = this.compiledSchemas.get(schema);
      } else if (typeof schema === 'object') {
        schemaObj = schema;
        compiledValidator = ajv.compile(schema);
      } else {
        throw new ValidationError('Schema must be an object or schema name', 'schema');
      }

      // Validate configuration
      const isValid = compiledValidator(config);

      if (!isValid) {
        const errors = this._formatValidationErrors(compiledValidator.errors);
        const suggestions = this._generateSuggestions(errors, schemaObj);
        return {
          isValid: false,
          errors: errors,
          schema: schemaObj,
          suggestions: suggestions
        };
      }

      return {
        isValid: true,
        errors: [],
        schema: schemaObj,
        suggestions: []
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error; // Re-throw ValidationError instances
      }
      return {
        isValid: false,
        errors: [error.message],
        schema: schema,
        suggestions: []
      };
    }
  }

  /**
   * Validate project name format and availability
   * @param {string} name - Project name
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateProjectName(name, options = {}) {
    const {
      checkAvailability = false,
      existingNames = [],
      minLength = 1,
      maxLength = 50
    } = options;

    const errors = [];
    const suggestions = [];

    // Basic validation using utility function
    const basicValidation = validateProjectName(name);
    if (!basicValidation.isValid) {
      errors.push(...basicValidation.errors);
    }

    // Additional length validation
    if (name && name.length < minLength) {
      errors.push(`Project name must be at least ${minLength} characters long`);
      suggestions.push(`Consider a longer name (minimum ${minLength} characters)`);
    }

    if (name && name.length > maxLength) {
      errors.push(`Project name cannot exceed ${maxLength} characters`);
      suggestions.push(`Consider a shorter name (maximum ${maxLength} characters)`);
    }

    // Check for reserved names
    const reservedNames = ['node', 'npm', 'test', 'src', 'dist', 'build', 'docs'];
    if (name && reservedNames.includes(name.toLowerCase())) {
      errors.push(`'${name}' is a reserved name`);
      suggestions.push(`Consider an alternative name like '${name}-project'`);
    }

    // Check availability if requested
    if (checkAvailability && existingNames.includes(name)) {
      errors.push(`Project name '${name}' is already in use`);
      suggestions.push(`Consider these alternatives: ${this._generateNameAlternatives(name, existingNames).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Validate project path and permissions
   * @param {string} projectPath - Project path
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateProjectPath(projectPath, options = {}) {
    const {
      checkWritePermission = true,
      checkExists = true,
      allowOverwrite = false
    } = options;

    const errors = [];
    const suggestions = [];

    // Basic path validation using utility function
    const basicValidation = validateFilePath(projectPath);
    if (!basicValidation.isValid) {
      errors.push(...basicValidation.errors);
    }

    // Check if path exists
    if (checkExists) {
      try {
        const pathStats = await fs.stat(projectPath);

        if (pathStats.isDirectory()) {
          if (!allowOverwrite) {
            errors.push(`Directory '${projectPath}' already exists`);
            suggestions.push('Consider using a different path or enable overwrite option');
          }
        } else {
          errors.push(`'${projectPath}' is not a directory`);
          suggestions.push('The specified path must be a directory');
        }
      } catch (error) {
        // Path doesn't exist, which is fine for new projects
        if (error.code !== 'ENOENT') {
          errors.push(`Cannot access path '${projectPath}': ${error.message}`);
          suggestions.push('Check if the path is accessible and you have the right permissions');
        }
      }
    }

    // Check parent directory exists and is writable
    if (checkWritePermission) {
      try {
        const parentPath = path.dirname(projectPath);
        const parentStats = await fs.stat(parentPath);

        if (!parentStats.isDirectory()) {
          errors.push(`Parent directory '${parentPath}' is not a directory`);
          suggestions.push('The parent path must be a directory');
        } else {
          // Test write permission
          const testFile = path.join(parentPath, `.write-test-${Date.now()}`);
          try {
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
          } catch (writeError) {
            errors.push(`No write permission in parent directory '${parentPath}'`);
            suggestions.push('Check directory permissions or use a different path');
          }
        }
      } catch (error) {
        errors.push(`Cannot access parent directory: ${error.message}`);
        suggestions.push('Make sure the parent directory exists and is accessible');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Validate template-specific configuration
   * @param {Object} templateConfig - Template configuration
   * @param {Object} schema - Template schema
   * @returns {Object} Validation result
   */
  validateTemplateConfig(templateConfig, schema = null) {
    const errors = [];
    const suggestions = [];

    // Use provided schema or default template config schema
    const validationSchema = schema || this.getSchema('template-config');

    // Validate against schema
    const schemaValidation = this.validateConfiguration(templateConfig, validationSchema);
    if (!schemaValidation.isValid) {
      errors.push(...schemaValidation.errors);
      suggestions.push(...schemaValidation.suggestions);
    }

    // Additional template-specific validations
    if (templateConfig.dependencies && typeof templateConfig.dependencies === 'object') {
      const depErrors = this._validateDependencies(templateConfig.dependencies);
      errors.push(...depErrors.errors);
      suggestions.push(...depErrors.suggestions);
    }

    if (templateConfig.scripts && typeof templateConfig.scripts === 'object') {
      const scriptErrors = this._validateScripts(templateConfig.scripts);
      errors.push(...scriptErrors.errors);
      suggestions.push(...scriptErrors.suggestions);
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Get formatted validation errors
   * @param {Object} validationResult - Validation result from validateConfiguration
   * @returns {Array} Formatted error messages
   */
  getValidationErrors(validationResult) {
    if (!validationResult || typeof validationResult !== 'object') {
      return ['Invalid validation result'];
    }

    if (validationResult.isValid) {
      return [];
    }

    const errors = [];

    if (validationResult.errors && Array.isArray(validationResult.errors)) {
      errors.push(...validationResult.errors);
    }

    // Add suggestions as warnings
    if (validationResult.suggestions && Array.isArray(validationResult.suggestions)) {
      validationResult.suggestions.forEach(suggestion => {
        errors.push(`Suggestion: ${suggestion}`);
      });
    }

    return errors;
  }

  /**
   * Check if configuration is valid
   * @param {Object} config - Configuration object
   * @param {Object|string} schema - Schema object or schema name
   * @returns {boolean} True if configuration is valid
   */
  isValidConfiguration(config, schema) {
    const result = this.validateConfiguration(config, schema);
    return result.isValid;
  }

  /**
   * Format AJV validation errors
   * @private
   * @param {Array} errors - AJV validation errors
   * @returns {Array} Formatted error messages
   */
  _formatValidationErrors(errors) {
    if (!errors || !Array.isArray(errors)) {
      return [];
    }

    return errors.map(error => {
      let message = error.message;

      if (error.dataPath) {
        message = `Field '${error.dataPath.substring(1)}': ${message}`;
      }

      if (error.params && error.params.additionalProperty) {
        message = `Additional property '${error.params.additionalProperty}' is not allowed`;
      }

      return message;
    });
  }

  /**
   * Generate suggestions based on validation errors
   * @private
   * @param {Array} errors - Validation errors
   * @param {Object} schema - Schema object
   * @returns {Array} Suggestions
   */
  _generateSuggestions(errors, schema) {
    const suggestions = [];

    for (const error of errors) {
      if (error.keyword === 'type') {
        suggestions.push(`Check the data type of field '${error.dataPath.substring(1)}'`);
      } else if (error.keyword === 'minLength') {
        suggestions.push(`Increase the length of field '${error.dataPath.substring(1)}'`);
      } else if (error.keyword === 'maxLength') {
        suggestions.push(`Decrease the length of field '${error.dataPath.substring(1)}'`);
      } else if (error.keyword === 'pattern') {
        suggestions.push(`Ensure field '${error.dataPath.substring(1)}' matches the required pattern`);
      } else if (error.keyword === 'required') {
        suggestions.push(`Add the required field '${error.params.missingProperty}'`);
      } else if (error.keyword === 'additionalProperties') {
        suggestions.push(`Remove the additional property '${error.params.additionalProperty}'`);
      }
    }

    return suggestions;
  }

  /**
   * Generate alternative project names
   * @private
   * @param {string} name - Original name
   * @param {Array} existingNames - Existing names
   * @returns {Array} Alternative names
   */
  _generateNameAlternatives(name, existingNames) {
    const alternatives = [];
    const suffixes = ['app', 'project', 'app', 'service', 'api'];

    for (const suffix of suffixes) {
      const altName = `${name}-${suffix}`;
      if (!existingNames.includes(altName)) {
        alternatives.push(altName);
        if (alternatives.length >= 3) {break;}
      }
    }

    // Try numeric suffixes
    let i = 2;
    while (alternatives.length < 3) {
      const altName = `${name}${i}`;
      if (!existingNames.includes(altName)) {
        alternatives.push(altName);
      }
      i++;
    }

    return alternatives;
  }

  /**
   * Validate dependencies object
   * @private
   * @param {Object} dependencies - Dependencies object
   * @returns {Object} Validation result
   */
  _validateDependencies(dependencies) {
    const errors = [];
    const suggestions = [];

    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof name !== 'string' || !name.match(/^[a-zA-Z0-9-_.]+$/)) {
        errors.push(`Invalid dependency name: '${name}'`);
        suggestions.push('Dependency names should match pattern: ^[a-zA-Z0-9-_.]+$');
      }

      if (typeof version !== 'string' || version.trim() === '') {
        errors.push(`Invalid version for dependency '${name}'`);
        suggestions.push(`Use a valid version specification for '${name}'`);
      }
    }

    return { errors, suggestions };
  }

  /**
   * Validate scripts object
   * @private
   * @param {Object} scripts - Scripts object
   * @returns {Object} Validation result
   */
  _validateScripts(scripts) {
    const errors = [];
    const suggestions = [];

    const reservedScriptNames = ['install', 'test', 'start', 'build'];

    for (const [name, command] of Object.entries(scripts)) {
      if (typeof name !== 'string' || !name.match(/^[a-zA-Z0-9-_.]+$/)) {
        errors.push(`Invalid script name: '${name}'`);
        suggestions.push('Script names should match pattern: ^[a-zA-Z0-9-_.]+$');
      }

      if (typeof command !== 'string' || command.trim() === '') {
        errors.push(`Invalid command for script '${name}'`);
        suggestions.push(`Provide a valid command for script '${name}'`);
      }

      // Warn about overriding common scripts
      if (reservedScriptNames.includes(name)) {
        suggestions.push(`Script '${name}' is commonly used - ensure this is intentional`);
      }
    }

    return { errors, suggestions };
  }

  /**
   * Validate ProjectConfiguration instance
   * @param {ProjectConfiguration} config - Project configuration instance
   * @returns {Object} Validation result
   */
  validateProjectConfiguration(config) {
    if (!(config instanceof ProjectConfiguration)) {
      throw new ValidationError('Expected ProjectConfiguration instance', 'config');
    }

    const errors = [];
    const suggestions = [];

    // Validate basic configuration
    const basicValidation = this.validateConfiguration(config.toJSON(), 'project-config');
    if (!basicValidation.isValid) {
      errors.push(...basicValidation.errors);
      suggestions.push(...basicValidation.suggestions);
    }

    // Validate config values and overrides
    if (config.configValues && Object.keys(config.configValues).length > 0) {
      const configValuesValidation = this.validateConfiguration(config.configValues, {});
      if (!configValuesValidation.isValid) {
        errors.push('Configuration values validation failed:');
        errors.push(...configValuesValidation.errors);
        suggestions.push(...configValuesValidation.suggestions);
      }
    }

    if (config.overrides && Object.keys(config.overrides).length > 0) {
      const overridesValidation = this.validateConfiguration(config.overrides, {});
      if (!overridesValidation.isValid) {
        errors.push('Configuration overrides validation failed:');
        errors.push(...overridesValidation.errors);
        suggestions.push(...overridesValidation.suggestions);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Get all registered schema names
   * @returns {Array} Schema names
   */
  getRegisteredSchemas() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Clear all registered schemas
   */
  clearSchemas() {
    this.schemas.clear();
    this.compiledSchemas.clear();
    // Re-initialize common schemas
    this._initializeCommonSchemas();
  }

  /**
   * Get AJV instance for advanced customization
   * @returns {Ajv} AJV instance
   */
  getAjvInstance() {
    return ajv;
  }
}

// Export the ConfigValidator class and ValidationError
module.exports = {
  ConfigValidator,
  ValidationError
};
