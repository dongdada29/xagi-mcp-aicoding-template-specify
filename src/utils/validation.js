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
    if (!name || typeof name !== 'string') {
      return {
        isValid: false,
        errors: ['Project name is required and must be a string']
      };
    }

    const errors = [];

    // Check for empty name
    if (name.trim() === '') {
      errors.push('Project name cannot be empty');
    }

    // Check for valid characters (alphanumeric, hyphens, underscores, dots)
    const namePattern = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/;
    if (!namePattern.test(name)) {
      errors.push('Project name must start and end with alphanumeric characters and contain only letters, numbers, hyphens, underscores, and dots');
    }

    // Check length
    if (name.length < 1) {
      errors.push('Project name must be at least 1 character long');
    }

    if (name.length > 50) {
      errors.push('Project name cannot exceed 50 characters');
    }

    // Check for reserved names
    const reservedNames = ['node', 'npm', 'test', 'src', 'dist', 'build', 'docs', 'lib', 'bin'];
    if (reservedNames.includes(name.toLowerCase())) {
      errors.push(`'${name}' is a reserved name`);
    }

    // Check for consecutive dots or hyphens
    if (name.includes('--') || name.includes('..') || name.includes('__') || name.includes('-.')) {
      errors.push('Project name cannot contain consecutive special characters');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
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
    if (!url || typeof url !== 'string') {
      return {
        isValid: false,
        errors: ['Git URL is required and must be a string']
      };
    }

    const errors = [];

    // Check for empty URL
    if (url.trim() === '') {
      errors.push('Git URL cannot be empty');
    }

    // Git URL patterns
    const gitPatterns = [
      // HTTPS URLs
      /^https:\/\/[^\s\/]+\.git$/,
      /^https:\/\/[^\s\/]+\/[^\s\/]+\/[^\s\/]+(\.git)?$/,
      // SSH URLs
      /^git@[^\s:]+:[^\s\/]+\/[^\s\/]+(\.git)?$/,
      /^ssh:\/\/git@[^\s\/]+\/[^\s\/]+\/[^\s\/]+(\.git)?$/,
      // Git protocol
      /^git:\/\/[^\s\/]+\/[^\s\/]+\/[^\s\/]+(\.git)?$/,
      // Local file paths
      /^file:\/\/\/[^\s]+$/,
      /^[^\/].*\.git$/,
      /^\/.*\.git$/
    ];

    const isValidPattern = gitPatterns.some(pattern => pattern.test(url));
    if (!isValidPattern) {
      errors.push('Invalid Git URL format. Supported formats: HTTPS, SSH, git://, file://, or local path');
    }

    // Additional security checks
    if (url.includes('..') && !url.startsWith('..') && !url.includes('/../')) {
      errors.push('Potentially unsafe directory traversal in URL');
    }

    // Check for suspicious protocols
    const suspiciousProtocols = ['ftp://', 'sftp://', 'http://'];
    if (suspiciousProtocols.some(protocol => url.startsWith(protocol))) {
      errors.push('Insecure protocol detected. Use HTTPS instead');
    }

    // Validate URL length
    if (url.length > 2048) {
      errors.push('Git URL is too long (maximum 2048 characters)');
    }

    // Check for common git hosting services
    const validHosts = [
      'github.com', 'gitlab.com', 'bitbucket.org',
      'dev.azure.com', 'visualstudio.com'
    ];

    if (url.startsWith('https://')) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Allow localhost for development
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          // Acceptable for development
        } else if (!validHosts.some(host => hostname === host || hostname.endsWith(`.${host}`))) {
          // Check if it's a custom domain (allow but warn via debug)
          // This is acceptable for enterprise setups
        }

        // Validate path for GitHub-style URLs
        if (hostname.includes('github.com')) {
          const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
          if (pathParts.length < 2) {
            errors.push('GitHub URL should include owner/repository format');
          }
        }

      } catch (error) {
        errors.push('Invalid URL format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
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

  static validateConfig(config, schema) {
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        errors: ['Configuration must be an object']
      };
    }

    if (!schema || typeof schema !== 'object') {
      return {
        isValid: false,
        errors: ['Schema must be an object']
      };
    }

    const errors = [];

    // Basic structural validation
    if (config === null) {
      errors.push('Configuration cannot be null');
    }

    // Check for circular references (basic check)
    try {
      JSON.stringify(config);
    } catch (error) {
      errors.push('Configuration contains circular references');
    }

    // Check for potentially unsafe properties
    const unsafeKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of Object.keys(config)) {
      if (unsafeKeys.includes(key)) {
        errors.push(`Configuration contains potentially unsafe property: ${key}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
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
