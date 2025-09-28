/**
 * ErrorHandler Unit Tests
 * Tests error handling functionality
 */

const {
  ErrorHandler,
  ConfigurationError,
  ValidationError,
  FileSystemError,
  NetworkError,
  SecurityError,
  TemplateError,
  RegistryError,
  CacheError
} = require('../../src/core/error-handler');

// Mock dependencies
jest.mock('../../src/core/logger');

describe('ErrorHandler', () => {
  let errorHandler;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create ErrorHandler instance
    errorHandler = new ErrorHandler({
      logger: mockLogger,
      enableErrorTracking: true,
      maxErrorHistory: 100
    });
  });

  describe('Constructor', () => {
    test('should create ErrorHandler with default options', () => {
      const handler = new ErrorHandler();

      expect(handler).toBeInstanceOf(ErrorHandler);
      expect(handler.enableErrorTracking).toBe(true);
      expect(handler.maxErrorHistory).toBe(1000);
      expect(handler.errorHistory).toEqual([]);
      expect(handler.errorStats).toBeDefined();
    });

    test('should create ErrorHandler with custom options', () => {
      const options = {
        logger: mockLogger,
        enableErrorTracking: false,
        maxErrorHistory: 50
      };

      const handler = new ErrorHandler(options);

      expect(handler.logger).toBe(mockLogger);
      expect(handler.enableErrorTracking).toBe(false);
      expect(handler.maxErrorHistory).toBe(50);
    });
  });

  describe('handleError', () => {
    test('should handle standard Error object', () => {
      const error = new Error('Test error');

      const result = errorHandler.handleError(error);

      expect(result.success).toBe(true);
      expect(result.errorId).toBeDefined();
      expect(result.handledAt).toBeInstanceOf(Date);
      expect(mockLogger.error).toHaveBeenCalledWith('Error handled', expect.any(Object));
    });

    test('should handle custom error types', () => {
      const error = new ConfigurationError('Config error', 'CONFIG_FILE_NOT_FOUND');

      const result = errorHandler.handleError(error);

      expect(result.success).toBe(true);
      expect(result.errorType).toBe('ConfigurationError');
      expect(result.errorCode).toBe('CONFIG_FILE_NOT_FOUND');
    });

    test('should handle string errors', () => {
      const result = errorHandler.handleError('String error');

      expect(result.success).toBe(true);
      expect(result.message).toBe('String error');
      expect(result.errorType).toBe('Error');
    });

    test('should handle object errors', () => {
      const error = { message: 'Object error', code: 'CUSTOM_CODE' };

      const result = errorHandler.handleError(error);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Object error');
      expect(result.code).toBe('CUSTOM_CODE');
    });

    test('should track error history when enabled', () => {
      errorHandler.enableErrorTracking = true;
      const error = new Error('Test error');

      errorHandler.handleError(error);

      expect(errorHandler.errorHistory).toHaveLength(1);
      expect(errorHandler.errorHistory[0]).toEqual(expect.objectContaining({
        message: 'Test error',
        errorId: expect.any(String)
      }));
    });

    test('should not track error history when disabled', () => {
      errorHandler.enableErrorTracking = false;
      const error = new Error('Test error');

      errorHandler.handleError(error);

      expect(errorHandler.errorHistory).toHaveLength(0);
    });

    test('should respect max error history limit', () => {
      errorHandler.maxErrorHistory = 2;

      // Add 3 errors
      errorHandler.handleError(new Error('Error 1'));
      errorHandler.handleError(new Error('Error 2'));
      errorHandler.handleError(new Error('Error 3'));

      expect(errorHandler.errorHistory).toHaveLength(2);
      expect(errorHandler.errorHistory[0].message).toBe('Error 2');
      expect(errorHandler.errorHistory[1].message).toBe('Error 3');
    });
  });

  describe('createError', () => {
    test('should create ConfigurationError', () => {
      const error = errorHandler.createError('ConfigurationError', 'Config failed', 'CONFIG_FAILED');

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Config failed');
      expect(error.code).toBe('CONFIG_FAILED');
    });

    test('should create ValidationError', () => {
      const error = errorHandler.createError('ValidationError', 'Validation failed', 'VALIDATION_FAILED');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_FAILED');
    });

    test('should create Error with additional context', () => {
      const context = { field: 'username', value: 'test' };
      const error = errorHandler.createError('Error', 'Test error', 'TEST_ERROR', context);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual(context);
    });
  });

  describe('wrapError', () => {
    test('should wrap existing error with additional context', () => {
      const originalError = new Error('Original error');
      const context = { operation: 'file_read', path: '/test/file.txt' };

      const wrappedError = errorHandler.wrapError(originalError, 'Failed to read file', 'FILE_READ_ERROR', context);

      expect(wrappedError.message).toBe('Failed to read file: Original error');
      expect(wrappedError.code).toBe('FILE_READ_ERROR');
      expect(wrappedError.originalError).toBe(originalError);
      expect(wrappedError.context).toEqual(context);
    });

    test('should preserve original error type', () => {
      const originalError = new ConfigurationError('Config error', 'CONFIG_ERROR');
      const wrappedError = errorHandler.wrapError(originalError, 'Wrapped error');

      expect(wrappedError).toBeInstanceOf(ConfigurationError);
    });
  });

  describe('isRecoverable', () => {
    test('should identify recoverable errors', () => {
      const recoverableErrors = [
        new NetworkError('Network timeout'),
        new FileSystemError('File not found'),
        new CacheError('Cache miss')
      ];

      recoverableErrors.forEach(error => {
        expect(errorHandler.isRecoverable(error)).toBe(true);
      });
    });

    test('should identify non-recoverable errors', () => {
      const nonRecoverableErrors = [
        new SecurityError('Security violation'),
        new ValidationError('Invalid schema'),
        new Error('Unknown error')
      ];

      nonRecoverableErrors.forEach(error => {
        expect(errorHandler.isRecoverable(error)).toBe(false);
      });
    });
  });

  describe('getUserMessage', () => {
    test('should return user-friendly message for known error types', () => {
      const errors = [
        { error: new NetworkError('Connection failed'), expected: /network/ },
        { error: new FileSystemError('File not found'), expected: /file/ },
        { error: new SecurityError('Access denied'), expected: /security/ },
        { error: new ValidationError('Invalid data'), expected: /validation/ }
      ];

      errors.forEach(({ error, expected }) => {
        const message = errorHandler.getUserMessage(error);
        expect(message.toLowerCase()).toMatch(expected);
      });
    });

    test('should return generic message for unknown errors', () => {
      const error = new Error('Unknown error occurred');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('An unexpected error occurred');
    });

    test('should include error code in user message when available', () => {
      const error = new ConfigurationError('Config error', 'CONFIG_NOT_FOUND');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('CONFIG_NOT_FOUND');
    });
  });

  describe('getErrorSuggestions', () => {
    test('should return suggestions for common errors', () => {
      const testCases = [
        {
          error: new NetworkError('Connection timeout'),
          expectedSuggestions: [/network/, /timeout/, /connection/]
        },
        {
          error: new FileSystemError('Permission denied'),
          expectedSuggestions: [/permission/, /access/]
        },
        {
          error: new ValidationError('Invalid configuration'),
          expectedSuggestions: [/configuration/, /validation/]
        }
      ];

      testCases.forEach(({ error, expectedSuggestions }) => {
        const suggestions = errorHandler.getErrorSuggestions(error);
        expect(suggestions).toBeInstanceOf(Array);

        // Check that at least one expected pattern matches
        const hasMatchingSuggestion = expectedSuggestions.some(pattern =>
          suggestions.some(suggestion => pattern.test(suggestion.toLowerCase()))
        );
        expect(hasMatchingSuggestion).toBe(true);
      });
    });

    test('should return empty array for unknown errors', () => {
      const error = new Error('Unknown error');
      const suggestions = errorHandler.getErrorSuggestions(error);

      expect(suggestions).toEqual([]);
    });
  });

  describe('getErrorStats', () => {
    test('should return error statistics', () => {
      // Add some errors to history
      errorHandler.handleError(new NetworkError('Network error 1'));
      errorHandler.handleError(new NetworkError('Network error 2'));
      errorHandler.handleError(new FileSystemError('File error'));

      const stats = errorHandler.getErrorStats();

      expect(stats).toEqual(expect.objectContaining({
        totalErrors: 3,
        errorTypes: expect.any(Object),
        recentErrors: expect.any(Array),
        mostCommonError: expect.any(String)
      }));

      expect(stats.errorTypes.NetworkError).toBe(2);
      expect(stats.errorTypes.FileSystemError).toBe(1);
    });

    test('should handle empty error history', () => {
      const stats = errorHandler.getErrorStats();

      expect(stats.totalErrors).toBe(0);
      expect(stats.errorTypes).toEqual({});
      expect(stats.recentErrors).toEqual([]);
    });
  });

  describe('clearErrorHistory', () => {
    test('should clear error history', () => {
      errorHandler.handleError(new Error('Test error'));
      expect(errorHandler.errorHistory).toHaveLength(1);

      errorHandler.clearErrorHistory();

      expect(errorHandler.errorHistory).toHaveLength(0);
    });

    test('should reset error statistics', () => {
      errorHandler.handleError(new Error('Test error'));
      const initialStats = errorHandler.getErrorStats();
      expect(initialStats.totalErrors).toBe(1);

      errorHandler.clearErrorHistory();
      const clearedStats = errorHandler.getErrorStats();
      expect(clearedStats.totalErrors).toBe(0);
    });
  });

  describe('exportErrorReport', () => {
    test('should export error report as JSON', () => {
      errorHandler.handleError(new Error('Test error'));

      const report = errorHandler.exportErrorReport('json');

      expect(report).toContain('"totalErrors":');
      expect(report).toContain('"errorHistory":');
      expect(report).toContain('"timestamp":');
    });

    test('should export error report as text', () => {
      errorHandler.handleError(new Error('Test error'));

      const report = errorHandler.exportErrorReport('text');

      expect(report).toContain('Error Report');
      expect(report).toContain('Total Errors:');
      expect(report).toContain('Test error');
    });

    test('should handle empty error history in export', () => {
      const report = errorHandler.exportErrorReport('json');

      expect(report).toContain('"totalErrors":0');
      expect(report).toContain('"errorHistory":[]');
    });
  });

  describe('Error Types', () => {
    test('should create ConfigurationError with correct properties', () => {
      const error = new ConfigurationError('Config error', 'CONFIG_ERROR', { field: 'setting' });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Config error');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.context).toEqual({ field: 'setting' });
    });

    test('should create ValidationError with correct properties', () => {
      const validationErrors = [{ field: 'email', message: 'Invalid email format' }];
      const error = new ValidationError('Validation failed', 'VALIDATION_ERROR', validationErrors);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.validationErrors).toEqual(validationErrors);
    });

    test('should create FileSystemError with correct properties', () => {
      const error = new FileSystemError('File not found', 'FILE_NOT_FOUND', '/path/to/file');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FileSystemError');
      expect(error.filePath).toBe('/path/to/file');
    });

    test('should create NetworkError with correct properties', () => {
      const error = new NetworkError('Connection failed', 'NETWORK_ERROR', 'https://api.example.com');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('NetworkError');
      expect(error.url).toBe('https://api.example.com');
    });

    test('should create SecurityError with correct properties', () => {
      const error = new SecurityError('Security violation', 'SECURITY_VIOLATION', 'UNAUTHORIZED_ACCESS');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('SecurityError');
      expect(error.severity).toBe('UNAUTHORIZED_ACCESS');
    });

    test('should create TemplateError with correct properties', () => {
      const error = new TemplateError('Template error', 'TEMPLATE_ERROR', 'test-template');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TemplateError');
      expect(error.templateId).toBe('test-template');
    });

    test('should create RegistryError with correct properties', () => {
      const error = new RegistryError('Registry error', 'REGISTRY_ERROR', 'test-registry');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('RegistryError');
      expect(error.registryId).toBe('test-registry');
    });

    test('should create CacheError with correct properties', () => {
      const error = new CacheError('Cache error', 'CACHE_ERROR', 'test-key');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('CacheError');
      expect(error.cacheKey).toBe('test-key');
    });
  });
});