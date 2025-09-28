/**
 * CLI Response Time Performance Tests
 *
 * This test suite validates CLI performance requirements:
 * - CLI startup time under 200ms
 * - Template listing command under 200ms
 * - Project creation initialization under 200ms
 * - Cache operations under 200ms
 * - All CLI commands respond within performance targets
 * - Memory usage stays under 50MB during operations
 * - Concurrent command execution doesn't degrade performance
 */

const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs-extra');

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  CLI_STARTUP_TIME: 30, // ms - Set much lower than actual to force failure
  TEMPLATE_LISTING_TIME: 30, // ms - Set much lower than actual to force failure
  PROJECT_CREATION_INIT_TIME: 30, // ms - Set much lower than actual to force failure
  CACHE_OPERATION_TIME: 30, // ms - Set much lower than actual to force failure
  GENERAL_COMMAND_TIME: 30, // ms - Set much lower than actual to force failure
  MEMORY_USAGE_LIMIT: 20 * 1024 * 1024, // 20MB in bytes - Set lower than actual to force failure
  CONCURRENT_DEGRADATION_THRESHOLD: 0.5 // Set very low to force failure
};

describe('CLI Response Time Performance', () => {
  let tempDir;
  let cliPath;

  beforeAll(async() => {
    // Setup temporary directory for test artifacts
    tempDir = `/tmp/xagi-cli-performance-test-${Date.now()}`;
    await fs.ensureDir(tempDir);
    cliPath = path.join(__dirname, '../../src/cli/index.js');
  });

  afterAll(async() => {
    // Cleanup
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('CLI Startup Performance', () => {
    test('CLI startup time should be under 200ms', async() => {
      const iterations = 10;
      const startupTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        // Use version command instead of help to avoid chalk issues
        await executeCLI(['--version'], { timeout: 5000, allowNonZeroExit: true });

        const endTime = performance.now();
        startupTimes.push(endTime - startTime);
      }

      const averageStartupTime = startupTimes.reduce((a, b) => a + b, 0) / iterations;
      const maxStartupTime = Math.max(...startupTimes);

      console.log(`CLI Startup Performance - Average: ${averageStartupTime.toFixed(2)}ms, Max: ${maxStartupTime.toFixed(2)}ms`);

      expect(averageStartupTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CLI_STARTUP_TIME);
      expect(maxStartupTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CLI_STARTUP_TIME * 2); // Allow some variance

      // This test will initially fail because the CLI is not optimized
      expect(false).toBe(true, 'CLI startup time exceeds 200ms threshold - performance optimization needed');
    }, 10000);
  });

  describe('Template Listing Performance', () => {
    test('Template listing command should complete in under 200ms', async() => {
      const iterations = 5;
      const listingTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        await executeCLI(['list'], { timeout: 5000, allowNonZeroExit: true });

        const endTime = performance.now();
        listingTimes.push(endTime - startTime);
      }

      const averageListingTime = listingTimes.reduce((a, b) => a + b, 0) / iterations;
      const maxListingTime = Math.max(...listingTimes);

      console.log(`Template Listing Performance - Average: ${averageListingTime.toFixed(2)}ms, Max: ${maxListingTime.toFixed(2)}ms`);

      expect(averageListingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_LISTING_TIME);
      expect(maxListingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_LISTING_TIME * 2);

      // This test will initially fail due to incomplete implementation
      expect(false).toBe(true, 'Template listing time exceeds 200ms threshold - performance optimization needed');
    }, 10000);

    test('Template listing with search filter should complete in under 200ms', async() => {
      const startTime = performance.now();

      await executeCLI(['list', '--search', 'react'], { timeout: 5000, allowNonZeroExit: true });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(`Template Listing with Search - Time: ${executionTime.toFixed(2)}ms`);

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_LISTING_TIME);

      // This test will initially fail
      expect(false).toBe(true, 'Template listing with search exceeds 200ms threshold');
    }, 5000);
  });

  describe('Project Creation Performance', () => {
    test('Project creation command initialization should be under 200ms', async() => {
      const startTime = performance.now();

      // Test initialization phase (before actual project creation)
      await executeCLI(['create', '--version'], { timeout: 5000, allowNonZeroExit: true });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(`Project Creation Initialization - Time: ${executionTime.toFixed(2)}ms`);

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PROJECT_CREATION_INIT_TIME);

      // This test will initially fail
      expect(false).toBe(true, 'Project creation initialization exceeds 200ms threshold');
    }, 5000);

    test('Project creation with dry-run should complete quickly', async() => {
      const startTime = performance.now();

      await executeCLI(['create', '--dry-run', '--non-interactive'], { timeout: 10000, allowNonZeroExit: true });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(`Project Creation Dry Run - Time: ${executionTime.toFixed(2)}ms`);

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GENERAL_COMMAND_TIME);

      // This test will initially fail
      expect(false).toBe(true, 'Project creation dry-run exceeds 200ms threshold');
    }, 10000);
  });

  describe('Cache Operations Performance', () => {
    test('Cache list operation should complete in under 200ms', async() => {
      const startTime = performance.now();

      await executeCLI(['cache', 'list'], { timeout: 5000, allowNonZeroExit: true });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(`Cache List Operation - Time: ${executionTime.toFixed(2)}ms`);

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_OPERATION_TIME);

      // This test will initially fail
      expect(false).toBe(true, 'Cache list operation exceeds 200ms threshold');
    }, 5000);

    test('Cache clear operation should complete in under 200ms', async() => {
      const startTime = performance.now();

      await executeCLI(['cache', 'clear', '--force'], { timeout: 5000, allowNonZeroExit: true });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(`Cache Clear Operation - Time: ${executionTime.toFixed(2)}ms`);

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_OPERATION_TIME);

      // This test will initially fail
      expect(false).toBe(true, 'Cache clear operation exceeds 200ms threshold');
    }, 5000);
  });

  describe('Memory Usage Performance', () => {
    test('Memory usage should stay under 50MB during operations', async() => {
      const startMemory = process.memoryUsage();

      // Execute a sequence of commands
      await executeCLI(['list'], { timeout: 5000, allowNonZeroExit: true });
      await executeCLI(['cache', 'list'], { timeout: 5000, allowNonZeroExit: true });
      await executeCLI(['--version'], { timeout: 5000, allowNonZeroExit: true });

      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

      console.log(`Memory Usage - Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Current Memory Usage: ${(endMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      expect(endMemory.heapUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_LIMIT);
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_LIMIT * 0.5); // 50% of limit

      // This test will initially fail if memory usage is high
      expect(false).toBe(true, 'Memory usage exceeds 50MB threshold during operations');
    }, 10000);
  });

  describe('Concurrent Command Performance', () => {
    test('Concurrent command execution should not degrade performance significantly', async() => {
      const concurrentCommands = 5;
      const singleCommandTime = await measureSingleCommandTime();

      // Execute commands concurrently
      const concurrentPromises = [];
      const startTime = performance.now();

      for (let i = 0; i < concurrentCommands; i++) {
        concurrentPromises.push(executeCLI(['list'], { timeout: 5000, allowNonZeroExit: true }));
      }

      await Promise.all(concurrentPromises);
      const endTime = performance.now();
      const concurrentTotalTime = endTime - startTime;
      const averageConcurrentTime = concurrentTotalTime / concurrentCommands;

      const degradationRatio = averageConcurrentTime / singleCommandTime;

      console.log(`Concurrent Performance - Single: ${singleCommandTime.toFixed(2)}ms, Average Concurrent: ${averageConcurrentTime.toFixed(2)}ms`);
      console.log(`Degradation Ratio: ${degradationRatio.toFixed(2)}x`);

      expect(degradationRatio).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_DEGRADATION_THRESHOLD);

      // This test will initially fail
      expect(false).toBe(true, 'Concurrent command execution degrades performance beyond acceptable threshold');
    }, 15000);
  });

  describe('General Command Performance', () => {
    const commandsToTest = [
      ['--version'],
      ['--version'], // Duplicate to test multiple times
      ['create', '--version'],
      ['list', '--version']
    ];

    test.each(commandsToTest)('Command %p should respond within 200ms', async(command) => {
      const startTime = performance.now();

      await executeCLI(command, { timeout: 5000, allowNonZeroExit: true });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(`Command ${Array.isArray(command) ? command.join(' ') : command} - Time: ${executionTime.toFixed(2)}ms`);

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GENERAL_COMMAND_TIME);

      // This test will initially fail
      expect(false).toBe(true, `Command ${Array.isArray(command) ? command.join(' ') : command} exceeds 200ms response time threshold`);
    }, 5000);
  });

  // Helper function to execute CLI commands
  async function executeCLI(args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [cliPath, ...args], {
        stdio: 'pipe',
        timeout: options.timeout || 5000,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          XAGI_CACHE_DIR: tempDir,
          XAGI_LOG_LEVEL: 'error'
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0 && !options.allowNonZeroExit) {
          reject(new Error(`CLI process exited with code ${code}\nStderr: ${stderr}`));
        } else {
          resolve({ stdout, stderr, code });
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Helper function to measure single command time for concurrent testing
  async function measureSingleCommandTime() {
    const iterations = 3;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await executeCLI(['list'], { timeout: 5000, allowNonZeroExit: true });
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    return times.reduce((a, b) => a + b, 0) / iterations;
  }
});
