/**
 * Basic Git Manager Test
 * Test core functionality without problematic dependencies
 */

const { validateGitUrl } = require('../../src/utils/validation');

function testValidation() {
  console.log('🧪 Testing Git URL Validation\n');

  const testUrls = [
    'https://github.com/octocat/Hello-World.git',
    'git@github.com:octocat/Hello-World.git',
    'https://gitlab.com/user/repo.git',
    'https://bitbucket.org/user/repo.git',
    'invalid-url',
    'ftp://github.com/user/repo.git',
    'http://github.com/user/repo.git',
    '',
    'https://github.com/', // missing user/repo
    'https://github.com/user', // missing repo
    'file:///path/to/repo.git',
    '/path/to/local/repo.git'
  ];

  console.log('URL Validation Results:');
  console.log('======================');

  let validCount = 0;
  let invalidCount = 0;

  for (const url of testUrls) {
    const result = validateGitUrl(url);
    const status = result.isValid ? '✅ Valid' : '❌ Invalid';
    console.log(`${status} ${url}`);

    if (!result.isValid) {
      console.log(`      Errors: ${result.errors.join(', ')}`);
      invalidCount++;
    } else {
      validCount++;
    }
    console.log();
  }

  console.log(`Summary: ${validCount} valid, ${invalidCount} invalid URLs`);
}

// Simple GitManager test without importing dependencies
function testGitManagerBasic() {
  console.log('\n🧪 Testing GitManager Basic Structure\n');

  // Test the basic class structure by reading the file
  const fs = require('fs');
  const path = require('path');

  const gitManagerPath = path.join(__dirname, '../../src/core/git-manager.js');

  try {
    const content = fs.readFileSync(gitManagerPath, 'utf8');

    // Check if required methods are defined
    const requiredMethods = [
      'cloneRepository',
      'checkoutBranch',
      'checkoutTag',
      'getRepositoryInfo',
      'validateRepository',
      'cleanupRepository',
      'getBranches',
      'getTags'
    ];

    console.log('Checking for required methods:');
    let allMethodsFound = true;

    for (const method of requiredMethods) {
      if (content.includes(`async ${method}`) || content.includes(`${method}(`)) {
        console.log(`✅ ${method}`);
      } else {
        console.log(`❌ ${method} - NOT FOUND`);
        allMethodsFound = false;
      }
    }

    // Check for error classes
    const errorClasses = ['GitError', 'AuthenticationError', 'RepositoryNotFoundError'];
    console.log('\nChecking for error classes:');

    for (const errorClass of errorClasses) {
      if (content.includes(`class ${errorClass}`) || content.includes(`extends ${errorClass}`)) {
        console.log(`✅ ${errorClass}`);
      } else {
        console.log(`❌ ${errorClass} - NOT FOUND`);
        allMethodsFound = false;
      }
    }

    // Check for key functionality
    const keyFeatures = [
      'simple-git',
      'authentication',
      'security',
      'validation',
      'progress',
      'error handling'
    ];

    console.log('\nChecking for key features:');

    for (const feature of keyFeatures) {
      if (content.toLowerCase().includes(feature)) {
        console.log(`✅ ${feature}`);
      } else {
        console.log(`❌ ${feature} - NOT FOUND`);
        allMethodsFound = false;
      }
    }

    console.log(`\nStructure Check: ${allMethodsFound ? '✅ PASSED' : '❌ FAILED'}`);

    // Check file size
    const stats = fs.statSync(gitManagerPath);
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.log(`❌ Failed to read GitManager file: ${error.message}`);
  }
}

// Test configuration validation
function testConfiguration() {
  console.log('\n🧪 Testing Configuration Structure\n');

  const fs = require('fs');
  const path = require('path');

  const configPath = path.join(__dirname, '../../package.json');

  try {
    const packageJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Check if required dependencies are present
    const requiredDeps = ['simple-git', 'fs-extra', 'ora', 'tempy'];

    console.log('Checking dependencies:');
    let allDepsFound = true;

    for (const dep of requiredDeps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        console.log(`✅ ${dep} (${packageJson.dependencies[dep]})`);
      } else {
        console.log(`❌ ${dep} - MISSING`);
        allDepsFound = false;
      }
    }

    console.log(`\nDependencies Check: ${allDepsFound ? '✅ PASSED' : '❌ FAILED'}`);

    // Check if the file is properly exported
    const gitManagerPath = path.join(__dirname, '../../src/core/git-manager.js');
    const content = fs.readFileSync(gitManagerPath, 'utf8');

    if (content.includes('module.exports')) {
      console.log('✅ Module exports found');
    } else {
      console.log('❌ Module exports not found');
    }

  } catch (error) {
    console.log(`❌ Failed to check configuration: ${error.message}`);
  }
}

// Run all tests
function runTests() {
  console.log('🚀 Running GitManager Implementation Tests\n');

  testValidation();
  testGitManagerBasic();
  testConfiguration();

  console.log('\n🎉 Tests Complete!');
  console.log('\nNote: This is a basic structure test. Full functionality testing requires');
  console.log('resolving the ES module compatibility issues with Jest.');
}

// Run the tests
runTests();
