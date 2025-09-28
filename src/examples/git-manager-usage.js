/**
 * Git Manager Usage Example
 * Demonstrates how to use the GitManager service for git operations
 */

const { GitManager } = require('../core/git-manager');

async function demonstrateGitManager() {
  console.log('🚀 GitManager Usage Examples\n');

  // Initialize GitManager with custom configuration
  const gitManager = new GitManager({
    debug: true,
    timeout: 60000, // 1 minute timeout
    retries: 3,
    authMethod: 'https'
  });

  // Example repository URLs
  const repositories = {
    helloWorld: 'https://github.com/octocat/Hello-World.git',
    nodeJs: 'https://github.com/nodejs/node.git',
    react: 'https://github.com/facebook/react.git'
  };

  try {
    // Example 1: Repository Validation
    console.log('1. Repository Validation');
    console.log('======================');

    for (const [name, url] of Object.entries(repositories)) {
      try {
        const isValid = await gitManager.validateRepository(url);
        console.log(`✅ ${name}: ${isValid ? 'Accessible' : 'Not accessible'}`);
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
      }
    }
    console.log();

    // Example 2: Get Repository Information
    console.log('2. Repository Information');
    console.log('========================');

    try {
      const repoInfo = await gitManager.getRepositoryInfo(repositories.helloWorld);
      console.log(`📁 Repository: ${repoInfo.name}`);
      console.log(`🌿 Default Branch: ${repoInfo.defaultBranch}`);
      console.log(`🔀 Branches: ${repoInfo.branches.length} found`);
      console.log(`🏷️  Tags: ${repoInfo.tags.length} found`);
      if (repoInfo.latestCommit) {
        console.log(`💬 Latest Commit: ${repoInfo.latestCommit.message}`);
        console.log(`👤 Author: ${repoInfo.latestCommit.author}`);
        console.log(`📅 Date: ${repoInfo.latestCommit.date}`);
      }
    } catch (error) {
      console.log(`❌ Failed to get repository info: ${error.message}`);
    }
    console.log();

    // Example 3: Get Branches and Tags
    console.log('3. Available Branches and Tags');
    console.log('=============================');

    try {
      const branches = await gitManager.getBranches(repositories.helloWorld);
      console.log(`🌿 Branches (${branches.length}):`);
      branches.slice(0, 5).forEach(branch => console.log(`   - ${branch}`));
      if (branches.length > 5) {
        console.log(`   ... and ${branches.length - 5} more`);
      }
    } catch (error) {
      console.log(`❌ Failed to get branches: ${error.message}`);
    }

    try {
      const tags = await gitManager.getTags(repositories.helloWorld);
      console.log(`🏷️  Tags (${tags.length}):`);
      tags.slice(0, 5).forEach(tag => console.log(`   - ${tag}`));
      if (tags.length > 5) {
        console.log(`   ... and ${tags.length - 5} more`);
      }
    } catch (error) {
      console.log(`❌ Failed to get tags: ${error.message}`);
    }
    console.log();

    // Example 4: Clone Repository
    console.log('4. Repository Cloning');
    console.log('====================');

    try {
      const clonePath = await gitManager.cloneRepository(repositories.helloWorld, {
        depth: 1, // Shallow clone
        branch: 'master' // Specific branch
      });
      console.log(`✅ Cloned to: ${clonePath}`);

      // Example 5: Checkout Branch
      console.log('\n5. Branch Checkout');
      console.log('==================');

      try {
        await gitManager.checkoutBranch(clonePath, 'master');
        console.log('✅ Successfully checked out master branch');
      } catch (error) {
        console.log(`⚠️  Branch checkout issue: ${error.message}`);
      }

      // Example 6: Checkout Tag
      console.log('\n6. Tag Checkout');
      console.log('===============');

      try {
        // Get available tags first
        const availableTags = await gitManager.getTags(repositories.helloWorld);
        if (availableTags.length > 0) {
          const latestTag = availableTags[availableTags.length - 1];
          await gitManager.checkoutTag(clonePath, latestTag);
          console.log(`✅ Successfully checked out tag: ${latestTag}`);
        } else {
          console.log('ℹ️  No tags available for checkout');
        }
      } catch (error) {
        console.log(`⚠️  Tag checkout issue: ${error.message}`);
      }

      // Example 7: Cleanup
      console.log('\n7. Cleanup');
      console.log('=========');

      await gitManager.cleanupRepository(clonePath);
      console.log('✅ Repository cleaned up successfully');

    } catch (error) {
      console.log(`❌ Clone operation failed: ${error.message}`);
    }
    console.log();

    // Example 8: Authentication Configuration
    console.log('8. Authentication Configuration');
    console.log('==============================');

    // Configure for private repositories
    gitManager.configureAuthentication({
      token: 'your-github-token-here', // In real use, get from environment/config
      method: 'https'
    });
    console.log('✅ HTTPS authentication configured');

    // Or configure SSH authentication
    gitManager.configureAuthentication({
      sshKeyPath: '/path/to/your/private/key',
      method: 'ssh'
    });
    console.log('✅ SSH authentication configured');

    console.log('\n🎉 GitManager demonstration complete!');
    console.log('\nNote: Replace "your-github-token-here" with actual credentials');
    console.log('for private repository access in production use.');

  } catch (error) {
    console.error('❌ Demonstration failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Error handling example
async function demonstrateErrorHandling() {
  console.log('\n🔧 Error Handling Examples');
  console.log('=========================');

  const gitManager = new GitManager();

  // Test with invalid repository
  try {
    await gitManager.validateRepository('https://github.com/nonexistent/repo.git');
  } catch (error) {
    console.log('🎯 Caught repository error:');
    console.log(`   Type: ${error.constructor.name}`);
    console.log(`   Operation: ${error.operation}`);
    console.log(`   Repository: ${error.repository}`);
    console.log(`   Message: ${error.message}`);
  }

  // Test with invalid URL
  try {
    await gitManager.cloneRepository('invalid-url');
  } catch (error) {
    console.log('🎯 Caught validation error:');
    console.log(`   Type: ${error.constructor.name}`);
    console.log(`   Message: ${error.message}`);
  }
}

// Configuration examples
function demonstrateConfiguration() {
  console.log('\n⚙️  Configuration Examples');
  console.log('=========================');

  // Basic configuration
  const basicConfig = new GitManager({
    debug: false,
    timeout: 30000
  });
  console.log('✅ Basic configuration created');

  // Production configuration
  const productionConfig = new GitManager({
    debug: false,
    timeout: 120000, // 2 minutes
    retries: 5,
    authMethod: 'https',
    authToken: process.env.GITHUB_TOKEN, // From environment
    tempDir: '/tmp/git-templates'
  });
  console.log('✅ Production configuration created');

  // Development configuration
  const developmentConfig = new GitManager({
    debug: true,
    timeout: 60000,
    retries: 2,
    authMethod: 'ssh',
    sshKeyPath: '~/.ssh/id_rsa'
  });
  console.log('✅ Development configuration created');
}

// Run examples
if (require.main === module) {
  demonstrateGitManager()
    .then(() => demonstrateErrorHandling())
    .then(() => demonstrateConfiguration())
    .catch(console.error);
}

module.exports = {
  demonstrateGitManager,
  demonstrateErrorHandling,
  demonstrateConfiguration
};
