# Security Test Suite - Input Validation and Sanitization

## Overview

This security test suite validates that all user input is properly sanitized and validated to prevent security vulnerabilities. The tests are designed to fail initially and pass only when proper security measures are implemented.

## Test Coverage

### 1. Command Injection Prevention
- Tests that shell operators (`;`, `&&`, `||`, `|`, `` ` ``, `$()`, `<`, `>`) are blocked in project names
- Validates that input sanitization removes dangerous characters
- Prevents OS command execution through user input

### 2. Project Name Validation
- Rejects project names with security concerns:
  - Directory traversal (`../../malicious`)
  - Reserved system names (`con`, `prn`, `aux`, `nul`)
  - XSS attacks (`<script>alert(1)</script>`)
  - SQL injection (`' OR '1'='1`)
  - JNDI injection (`${jndi:ldap://malicious.com/a}`)
  - File schemes (`file:///etc/passwd`)
  - Malicious URLs (`http://malicious.com/shell`)

### 3. File Path Validation
- Prevents directory traversal attacks
- Blocks null byte injection (`%00`)
- Rejects absolute paths and system paths
- Validates only relative paths are allowed

### 4. Configuration Validation
- Sanitizes configuration values
- Validates configuration structure
- Prevents malicious configuration injection

### 5. Environment Variable Handling
- Validates environment variables for security
- Prevents sensitive variable exposure
- Blocks malicious environment values

### 6. Git URL Validation
- Blocks malicious git protocols (`git://`, `file://`)
- Prevents command injection in URLs
- Validates only allowed protocols (https, ssh)

### 7. Registry URL Validation
- Prevents SSRF attacks through registry URLs
- Blocks internal network access (`localhost`, `127.0.0.1`)
- Validates only allowed registry domains

### 8. API Endpoint Security
- Validates input in API endpoints
- Handles large payloads to prevent DoS
- Ensures proper request validation

### 9. Principle of Least Privilege
- Enforces least privilege on user input
- Validates input scope and permissions
- Prevents privileged operations

### 10. Cross-Site Scripting (XSS) Prevention
- Sanitizes input to prevent XSS attacks
- Blocks dangerous HTML/JavaScript patterns
- Prevents various XSS vectors

### 11. SQL Injection Prevention
- Prevents SQL injection attempts
- Blocks SQL operators and keywords
- Validates database input safety

### 12. LDAP/NoSQL Injection Prevention
- Prevents LDAP injection attacks
- Blocks NoSQL injection attempts
- Validates query safety

### 13. Log Injection Prevention
- Prevents log injection attacks
- Blocks newline and control characters
- Ensures safe log formatting

### 14. HTTP Header Injection Prevention
- Prevents HTTP header injection
- Blocks CRLF sequences
- Ensures safe header values

### 15. File Inclusion Prevention
- Prevents local file inclusion (LFI) attacks
- Blocks remote file inclusion (RFI) attacks
- Validates file path safety

### 16. Command Line Argument Injection
- Prevents command line argument injection
- Blocks dangerous CLI operators
- Ensures safe command execution

## Running Tests

```bash
# Run security tests only
npm run test:security

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/security/test_input_validation.js
```

## Test Results Interpretation

### Expected Behavior (Initially)
- **24 tests should fail**: Indicating missing security validation
- **4 tests should pass**: Basic validation working
- **Low coverage scores**: Security features not implemented

### After Implementation
- **All 28 tests should pass**: Security validation working
- **High coverage scores**: Comprehensive security coverage
- **No security vulnerabilities**: All input properly validated

## Security Principles Tested

1. **Input Validation**: All user input is validated before processing
2. **Sanitization**: Dangerous characters and patterns are removed
3. **Least Privilege**: Input is restricted to minimum required access
4. **Defense in Depth**: Multiple layers of security validation
5. **Fail Secure**: Validation failures default to secure behavior
6. **Zero Trust**: No input is trusted by default

## Vulnerabilities Prevented

- **OWASP Top 10**: A1-Injection, A3-XSS, A5-Security Misconfiguration
- **Command Injection**: OS command execution through user input
- **Directory Traversal**: File system access outside intended scope
- **SSRF**: Server-side request forgery attacks
- **File Inclusion**: Local and remote file inclusion attacks
- **Log Injection**: Log forging and manipulation
- **Header Injection**: HTTP header manipulation
- **Environment Variable Manipulation**: Process environment tampering

## Implementation Requirements

To make these tests pass, the following security measures must be implemented:

1. **Comprehensive input validation** for all user inputs
2. **Output encoding** for all dynamic content
3. **Parameterized queries** for database operations
4. **File path validation** to prevent directory traversal
5. **URL validation** to prevent SSRF and malicious URLs
6. **Configuration validation** for all settings
7. **Environment variable sanitization** for process security
8. **Rate limiting** and input size restrictions
9. **Security headers** and content security policies
10. **Audit logging** for security events