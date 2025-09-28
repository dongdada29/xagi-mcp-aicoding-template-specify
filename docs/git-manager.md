# GitManager Service Documentation

The `GitManager` service provides comprehensive git-based template operations for the AI Project Initialization Tool. It handles repository cloning, branch/tag management, validation, and authentication with robust error handling and security features.

## Overview

The GitManager service is designed to:

- Clone git repositories with various options
- Manage branches and tags checkout
- Validate repository accessibility
- Handle authentication for private repositories
- Provide comprehensive error handling
- Include security checks and validation
- Show progress indicators for long operations

## Installation

The service is included in the main package and requires these dependencies:

```bash
npm install simple-git fs-extra ora tempy
```

## Basic Usage

```javascript
const { GitManager } = require('../src/core/git-manager');

// Initialize with configuration
const gitManager = new GitManager({
  debug: true,
  timeout: 60000,
  retries: 3,
  authMethod: 'https'
});
```

## API Reference

### Constructor

```javascript
new GitManager(options)
```

**Options:**
- `debug` (boolean): Enable debug logging (default: false)
- `timeout` (number): Operation timeout in milliseconds (default: 300000)
- `retries` (number): Number of retry attempts (default: 3)
- `authMethod` (string): Authentication method - 'https' or 'ssh' (default: 'ssh')
- `authToken` (string): Authentication token for HTTPS
- `sshKeyPath` (string): Path to SSH private key
- `tempDir` (string): Temporary directory for clones (default: auto-generated)

### Methods

#### cloneRepository(url, options)

Clone a git repository to a local directory.

```javascript
const repoPath = await gitManager.cloneRepository('https://github.com/user/repo.git', {
  targetDir: '/path/to/clone',
  branch: 'main',
  depth: 1,
  singleBranch: true,
  filter: 'tree:0'
});
```

**Parameters:**
- `url` (string): Git repository URL
- `options` (object): Cloning options
  - `targetDir` (string): Target directory (default: auto-generated)
  - `branch` (string): Specific branch to clone
  - `depth` (number): Clone depth (default: 1 for shallow clone)
  - `singleBranch` (boolean): Clone only single branch
  - `filter` (string): Blob filter for sparse checkout

**Returns:** Promise<string> - Path to cloned repository

#### checkoutBranch(repoPath, branch)

Checkout a specific branch in a cloned repository.

```javascript
await gitManager.checkoutBranch('/path/to/repo', 'develop');
```

**Parameters:**
- `repoPath` (string): Path to repository
- `branch` (string): Branch name to checkout

#### checkoutTag(repoPath, tag)

Checkout a specific tag in a cloned repository.

```javascript
await gitManager.checkoutTag('/path/to/repo', 'v1.0.0');
```

**Parameters:**
- `repoPath` (string): Path to repository
- `tag` (string): Tag name to checkout

#### getRepositoryInfo(url)

Get comprehensive information about a repository.

```javascript
const info = await gitManager.getRepositoryInfo('https://github.com/user/repo.git');
console.log(info.name);        // Repository name
console.log(info.defaultBranch); // Default branch
console.log(info.branches);     // Available branches
console.log(info.tags);         // Available tags
console.log(info.latestCommit); // Latest commit info
```

**Returns:** Promise<object> - Repository information

#### validateRepository(url)

Validate if a repository is accessible.

```javascript
const isValid = await gitManager.validateRepository('https://github.com/user/repo.git');
```

**Returns:** Promise<boolean> - True if repository is accessible

#### getBranches(url)

Get list of available branches for a repository.

```javascript
const branches = await gitManager.getBranches('https://github.com/user/repo.git');
```

**Returns:** Promise<string[]> - Array of branch names

#### getTags(url)

Get list of available tags for a repository.

```javascript
const tags = await gitManager.getTags('https://github.com/user/repo.git');
```

**Returns:** Promise<string[]> - Array of tag names

#### cleanupRepository(repoPath)

Clean up a cloned repository directory.

```javascript
await gitManager.cleanupRepository('/path/to/repo');
```

#### configureAuthentication(authConfig)

Configure authentication for git operations.

```javascript
// HTTPS authentication
gitManager.configureAuthentication({
  token: 'your-github-token',
  method: 'https'
});

// SSH authentication
gitManager.configureAuthentication({
  sshKeyPath: '/path/to/private/key',
  method: 'ssh'
});
```

## Authentication

### HTTPS Authentication

For GitHub repositories using personal access tokens:

```javascript
gitManager.configureAuthentication({
  token: process.env.GITHUB_TOKEN,
  method: 'https'
});
```

### SSH Authentication

For repositories using SSH keys:

```javascript
gitManager.configureAuthentication({
  sshKeyPath: '~/.ssh/id_rsa',
  method: 'ssh'
});
```

## Error Handling

The service provides specific error classes for different scenarios:

```javascript
const { GitError, AuthenticationError, RepositoryNotFoundError } = require('../src/core/git-manager');

try {
  await gitManager.cloneRepository(url);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Authentication failed:', error.message);
  } else if (error instanceof RepositoryNotFoundError) {
    console.log('Repository not found:', error.message);
  } else {
    console.log('Git operation failed:', error.message);
  }
}
```

### Error Classes

- `GitError`: Base error class for all git operations
- `AuthenticationError`: Authentication failures
- `RepositoryNotFoundError`: Repository not found or inaccessible
- `BranchNotFoundError`: Specified branch not found
- `TagNotFoundError`: Specified tag not found

## Security Features

### URL Validation

The service validates git URLs to prevent security issues:

```javascript
const { validateGitUrl } = require('../src/utils/validation');

const result = validateGitUrl('https://github.com/user/repo.git');
if (result.isValid) {
  // URL is safe to use
} else {
  console.log('Invalid URL:', result.errors);
}
```

### Path Safety

Cleanup operations include safety checks to prevent accidental deletion of system directories:

```javascript
// These paths will be rejected for cleanup
const unsafePaths = [
  '/usr/bin',    // System directory
  '/etc',        // System configuration
  '/tmp',        // System temp directory
  process.cwd()  // Current working directory
];
```

## Progress Indicators

The service uses the `ora` library to show progress for long-running operations:

```
⠋ Cloning repository from https://github.com/user/repo.git
✔ Repository cloned successfully to /tmp/repo-123
```

Debug mode provides detailed logging:

```javascript
gitManager.setDebugMode(true);
// Enables detailed logging of git operations
```

## Configuration Examples

### Development Configuration

```javascript
const devConfig = new GitManager({
  debug: true,
  timeout: 60000,
  retries: 2,
  authMethod: 'ssh',
  sshKeyPath: '~/.ssh/id_rsa'
});
```

### Production Configuration

```javascript
const prodConfig = new GitManager({
  debug: false,
  timeout: 120000,
  retries: 5,
  authMethod: 'https',
  authToken: process.env.GITHUB_TOKEN,
  tempDir: '/tmp/git-templates'
});
```

### CI/CD Configuration

```javascript
const ciConfig = new GitManager({
  debug: false,
  timeout: 300000,
  retries: 1,
  authMethod: 'https',
  authToken: process.env.CI_GITHUB_TOKEN
});
```

## Best Practices

### 1. Always Use Authentication for Private Repos

```javascript
// Best: Use environment variables
gitManager.configureAuthentication({
  token: process.env.GITHUB_TOKEN,
  method: 'https'
});
```

### 2. Handle Errors Gracefully

```javascript
try {
  const repoPath = await gitManager.cloneRepository(url);
  // Work with repository
  await gitManager.cleanupRepository(repoPath);
} catch (error) {
  console.error('Failed to clone repository:', error.message);
  // Provide user-friendly error message
}
```

### 3. Use Shallow Clones for Templates

```javascript
// Faster cloning for template operations
const repoPath = await gitManager.cloneRepository(url, {
  depth: 1,
  filter: 'tree:0'
});
```

### 4. Cleanup Temporary Repositories

```javascript
// Always clean up temporary directories
try {
  const repoPath = await gitManager.cloneRepository(url);
  // Process repository
} finally {
  await gitManager.cleanupRepository(repoPath);
}
```

### 5. Validate Before Operations

```javascript
// Check repository accessibility before cloning
if (await gitManager.validateRepository(url)) {
  const repoPath = await gitManager.cloneRepository(url);
  // Continue with operations
} else {
  console.log('Repository is not accessible');
}
```

## Testing

Run the basic test suite:

```bash
node tests/manual/basic-test.js
```

For network-dependent tests:

```bash
RUN_NETWORK_TESTS=true node tests/manual/git-manager-test.js
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify token is valid and has necessary permissions
   - Check token scope for repository access
   - Ensure correct authentication method

2. **Repository Not Found**
   - Verify repository URL is correct
   - Check repository accessibility in browser
   - Ensure proper authentication for private repos

3. **Timeout Issues**
   - Increase timeout value for large repositories
   - Check network connectivity
   - Use shallow cloning options

4. **Permission Denied**
   - Verify SSH key permissions (600 for private keys)
   - Check file system permissions for target directory
   - Ensure proper authentication configuration

### Debug Mode

Enable debug mode for detailed logging:

```javascript
gitManager.setDebugMode(true);
```

This will show:
- Git command execution
- Authentication setup
- Progress indicators
- Detailed error information

## Contributing

When contributing to the GitManager service:

1. Follow JavaScript best practices
2. Add comprehensive JSDoc comments
3. Include error handling for all operations
4. Add tests for new functionality
5. Update documentation for API changes
6. Ensure security validation for all inputs

## License

MIT License - see LICENSE file for details.