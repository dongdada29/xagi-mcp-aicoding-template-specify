/**
 * Manual Git Manager Test
 * This file can be run directly to test the GitManager implementation
 */

const { GitManager, GitError, AuthenticationError, RepositoryNotFoundError } = require('../../src/core/git-manager');
const { validateGitUrl } = require('../../src/utils/validation');

async function testGitManager() {
  console.log('🧪 Testing GitManager Implementation\n');

  // Test 1: URL Validation
  console.log('1. Testing URL Validation...');
  const testUrls = [
    'https://github.com/octocat/Hello-World.git',
    'git@github.com:octocat/Hello-World.git',
    'https://gitlab.com/user/repo.git',
    'invalid-url',
    'ftp://github.com/user/repo.git',
    ''
  ];

  for (const url of testUrls) {
    const result = validateGitUrl(url);
    console.log(`   ${url}: ${result.isValid ? '✅ Valid' : '❌ Invalid'}`);
    if (!result.isValid) {
      console.log(`      Errors: ${result.errors.join(', ')}`);
    }
  }
  console.log();

  // Test 2: GitManager Instantiation
  console.log('2. Testing GitManager Instantiation...');
  try {
    const gitManager = new GitManager({
      debug: true,
      timeout: 30000
    });
    console.log('   ✅ GitManager created successfully');

    // Test configuration methods
    gitManager.setTimeout(60000);
    console.log('   ✅ Timeout set to 60s');

    gitManager.setDebugMode(true);
    console.log('   ✅ Debug mode enabled');

    gitManager.configureAuthentication({
      token: 'test-token',
      method: 'https'
    });
    console.log('   ✅ HTTPS authentication configured');

  } catch (error) {
    console.log('   ❌ Failed to create GitManager:', error.message);
  }
  console.log();

  // Test 3: Repository Name Extraction
  console.log('3. Testing Repository Name Extraction...');
  const gitManager = new GitManager();
  const testRepoUrls = [
    'https://github.com/octocat/Hello-World.git',
    'git@github.com:octocat/Hello-World.git',
    'https://gitlab.com/user/my-awesome-project.git'
  ];

  for (const url of testRepoUrls) {
    const name = gitManager.extractRepoName(url);
    console.log(`   ${url} -> ${name}`);
  }
  console.log();

  // Test 4: Security Checks
  console.log('4. Testing Security Checks...');
  const unsafePaths = [
    '/usr/bin',
    '/etc',
    '/var/log',
    '/tmp',
    '/root'
  ];

  const safePaths = [
    '/tmp/test-repo-123',
    '/tmp/git-clone-456',
    '/tmp/project-template-789'
  ];

  console.log('   Unsafe paths:');
  for (const path of unsafePaths) {
    const isUnsafe = gitManager.isUnsafePath(path);
    console.log(`     ${path}: ${isUnsafe ? '❌ Unsafe' : '✅ Safe'}`);
  }

  console.log('   Safe paths:');
  for (const path of safePaths) {
    const isUnsafe = gitManager.isUnsafePath(path);
    console.log(`     ${path}: ${isUnsafe ? '❌ Unsafe' : '✅ Safe'}`);
  }
  console.log();

  // Test 5: Error Classes
  console.log('5. Testing Error Classes...');
  try {
    throw new GitError('Test error', 'test-operation', 'test-repo');
  } catch (error) {
    console.log(`   ✅ GitError: ${error.name} - ${error.message}`);
    console.log(`      Operation: ${error.operation}`);
    console.log(`      Repository: ${error.repository}`);
    console.log(`      Timestamp: ${error.timestamp}`);
  }

  try {
    throw new AuthenticationError('Auth failed', 'test-repo');
  } catch (error) {
    console.log(`   ✅ AuthenticationError: ${error.name} - ${error.message}`);
  }

  try {
    throw new RepositoryNotFoundError('Not found', 'test-repo');
  } catch (error) {
    console.log(`   ✅ RepositoryNotFoundError: ${error.name} - ${error.message}`);
  }
  console.log();

  // Test 6: File Operations (Mock)
  console.log('6. Testing File Operations...');
  const fs = require('fs-extra');
  const tempDir = '/tmp/test-git-manager-' + Date.now();

  try {
    // Create test directory
    await fs.ensureDir(tempDir);
    console.log(`   ✅ Created test directory: ${tempDir}`);

    // Test cleanup
    await gitManager.cleanupRepository(tempDir);
    console.log('   ✅ Cleaned up test directory');

    // Verify directory is gone
    const exists = await fs.pathExists(tempDir);
    console.log(`   Directory exists after cleanup: ${exists ? '❌ Yes' : '✅ No'}`);

  } catch (error) {
    console.log(`   ❌ File operation failed: ${error.message}`);
    // Clean up on error
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  }
  console.log();

  // Test 7: Logger Functionality
  console.log('7. Testing Logger Functionality...');
  gitManager.setDebugMode(true);

  console.log('   Testing logger with debug mode enabled:');
  gitManager.logger.info('Info message');
  gitManager.logger.warn('Warning message');
  gitManager.logger.error('Error message');
  gitManager.logger.debug('Debug message');

  gitManager.setDebugMode(false);
  console.log('   Testing logger with debug mode disabled:');
  gitManager.logger.info('Info message (should not show)');
  gitManager.logger.debug('Debug message (should not show)');
  gitManager.logger.error('Error message (should always show)');
  console.log();

  console.log('🎉 GitManager Implementation Test Complete!');
  console.log('\nNote: Network-dependent tests (cloning, validation) require network access');
  console.log('and are skipped in this basic test. Run with network access to test full functionality.');
}

// Run the test
if (require.main === module) {
  testGitManager().catch(console.error);
}

module.exports = { testGitManager };
