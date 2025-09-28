/**
 * Input Validation and Sanitization Utilities
 * Validates and sanitizes user inputs to prevent security vulnerabilities
 */

class InputValidator {
  static validateInput(input) {
    // Mock implementation
    return {
      isValid: false,
      errors: ['Input validation not implemented'],
      sanitized: input
    };
  }

  static sanitizeInput(input) {
    // Mock implementation
    return input;
  }

  static validateProjectName(name) {
    // Mock implementation
    return {
      isValid: false,
      errors: ['Project name validation not implemented']
    };
  }

  static validateFilePath(path) {
    if (!path || typeof path !== 'string') {
      return {
        isValid: false,
        errors: ['Path is required and must be a string']
      };
    }

    const errors = [];

    // Check for empty path
    if (path.trim() === '') {
      errors.push('Path cannot be empty');
    }

    // Check for absolute vs relative paths (both are acceptable)
    if (!path.startsWith('/') && !path.startsWith('./') && !path.startsWith('../') && !path.match(/^[a-zA-Z]:\\/)) {
      // Relative path without ./ or ../ is also acceptable
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(path)) {
      errors.push('Path contains invalid characters: < > : " | ? *');
    }

    // Check for directory traversal attempts
    if (path.includes('..') && !path.startsWith('..') && !path.includes('/../') && !path.includes('\\..\\')) {
      // Only allow .. at the beginning for relative paths
      const parts = path.split(/[/\\]/);
      for (let i = 1; i < parts.length; i++) {
        if (parts[i] === '..') {
          errors.push('Path contains potentially unsafe directory traversal');
          break;
        }
      }
    }

    // Validate path length
    if (path.length > 4096) {
      errors.push('Path is too long (maximum 4096 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  static validateGitUrl(url) {
    // Mock implementation
    return {
      isValid: false,
      errors: ['Git URL validation not implemented']
    };
  }

  static validateRegistryUrl(url) {
    if (!url || typeof url !== 'string') {
      return {
        isValid: false,
        errors: ['URL is required and must be a string']
      };
    }

    const errors = [];

    // Support both HTTP/HTTPS URLs and file:// URLs for local registries
    const urlPattern = /^https?:\/\/.+|^file:\/\/\/.+/;
    if (!urlPattern.test(url)) {
      errors.push('URL must start with http://, https://, or file:///');
    }

    // Validate domain
    try {
      const parsedUrl = new URL(url);

      // For HTTP/HTTPS URLs, validate hostname
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        if (!parsedUrl.hostname) {
          errors.push('Invalid hostname');
        }

        // Check for localhost in production (optional)
        if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
          // This is acceptable for development, but you might want to warn
        }

        // Check for common registry patterns
        const validPathPattern = /^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@\/]*$/;
        if (parsedUrl.pathname && !validPathPattern.test(parsedUrl.pathname)) {
          errors.push('Invalid URL path');
        }
      }

      // For file:// URLs, just validate the path exists
      if (parsedUrl.protocol === 'file:') {
        if (!parsedUrl.pathname) {
          errors.push('Invalid file path');
        }
      }

    } catch (error) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  static validateConfig(config) {
    // Mock implementation
    return {
      isValid: false,
      errors: ['Configuration validation not implemented']
    };
  }

  static validateEnvironmentVars(envVars) {
    // Mock implementation
    return {
      isValid: false,
      errors: ['Environment variable validation not implemented']
    };
  }
}

module.exports = {
  validateInput: InputValidator.validateInput,
  sanitizeInput: InputValidator.sanitizeInput,
  validateProjectName: InputValidator.validateProjectName,
  validateFilePath: InputValidator.validateFilePath,
  validateGitUrl: InputValidator.validateGitUrl,
  validateRegistryUrl: InputValidator.validateRegistryUrl,
  validateConfig: InputValidator.validateConfig,
  validateEnvironmentVars: InputValidator.validateEnvironmentVars
};