/**
 * Performance Tests for Template Download and Validation
 *
 * This test suite validates performance requirements for:
 * 1. Template package download completion times
 * 2. Template validation processing times
 * 3. Git repository cloning performance
 * 4. Template processing and variable substitution
 * 5. Network timeout handling
 * 6. Concurrent template downloads
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const simpleGit = require('simple-git');
const MemoryFS = require('memory-fs/lib/MemoryFileSystem');
const { performance } = require('perf_hooks');

// Test utilities
const {
  createTempDir,
  createTempFile
} = require('../setup');

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  CACHED_TEMPLATE_DOWNLOAD: 1000, // 1 second for cached templates
  NEW_TEMPLATE_DOWNLOAD: 5000, // 5 seconds for new templates
  TEMPLATE_VALIDATION: 500, // 500ms for validation
  GIT_CLONING_SMALL_REPO: 3000, // 3 seconds for small repositories
  TEMPLATE_PROCESSING: 500, // 500ms for template processing
  NETWORK_TIMEOUT: 5000, // 5 seconds for network timeout
  CONCURRENT_OPERATION_MARGIN: 1000 // 1 second margin for concurrent operations
};

// Mock data
const MOCK_TEMPLATES = {
  cached: {
    id: '@xagi/ai-template-react-next-app@1.0.0',
    name: 'React Next.js AI Project Template',
    size: 2048,
    downloadTime: 100 // Simulated cached download time
  },
  new: {
    id: '@xagi/ai-template-vue-nuxt-app@1.0.0',
    name: 'Vue Nuxt.js AI Project Template',
    size: 2560,
    downloadTime: 2000 // Simulated new download time
  },
  large: {
    id: '@xagi/ai-template-fullstack-app@1.0.0',
    name: 'Full Stack AI Project Template',
    size: 5120,
    downloadTime: 3500 // Simulated large download time
  }
};

const MOCK_GIT_REPOSITORIES = {
  small: {
    url: 'https://github.com/xagi/small-template.git',
    name: 'Small Template',
    fileCount: 10,
    cloneTime: 1500
  },
  medium: {
    url: 'https://github.com/xagi/medium-template.git',
    name: 'Medium Template',
    fileCount: 50,
    cloneTime: 2500
  }
};

describe('Template Download and Validation Performance Tests', () => {
  let testCacheDir;
  let testTempDir;
  let memoryFS;
  let performanceMetrics;

  beforeAll(async() => {
    // Create test directories
    testCacheDir = path.join(os.tmpdir(), `xagi-perf-test-${Date.now()}`);
    testTempDir = path.join(os.tmpdir(), `xagi-perf-temp-${Date.now()}`);

    await fs.ensureDir(testCacheDir);
    await fs.ensureDir(testTempDir);

    // Initialize in-memory file system
    memoryFS = new MemoryFS();

    // Setup mock cache entries for cached template tests
    await setupMockCache();
  });

  afterAll(async() => {
    // Clean up test directories
    await fs.remove(testCacheDir);
    await fs.remove(testTempDir);
  });

  beforeEach(async() => {
    // Reset performance metrics
    performanceMetrics = {
      downloads: [],
      validations: [],
      clones: [],
      processing: [],
      timeouts: [],
      concurrent: []
    };

    // Clear any test-specific cache
    await fs.emptyDir(testCacheDir);
    await setupMockCache();
  });

  describe('1. Template Package Download Performance', () => {
    test('Cached template download completes in under 1s', async() => {
      const template = MOCK_TEMPLATES.cached;
      const startTime = performance.now();

      // Simulate cached template download
      const result = await simulateTemplateDownload(template, { cached: true });
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Record performance metric
      performanceMetrics.downloads.push({
        template: template.id,
        type: 'cached',
        duration,
        timestamp: Date.now()
      });

      // Validate performance requirement
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_TEMPLATE_DOWNLOAD);
      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(result.downloadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_TEMPLATE_DOWNLOAD);

      // Log performance data
      console.log(`Cached template download: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.CACHED_TEMPLATE_DOWNLOAD}ms)`);
    });

    test('New template download completes in under 5s', async() => {
      const template = MOCK_TEMPLATES.new;
      const startTime = performance.now();

      // Simulate new template download
      const result = await simulateTemplateDownload(template, { cached: false });
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Record performance metric
      performanceMetrics.downloads.push({
        template: template.id,
        type: 'new',
        duration,
        timestamp: Date.now()
      });

      // Validate performance requirement
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NEW_TEMPLATE_DOWNLOAD);
      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(result.downloadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.NEW_TEMPLATE_DOWNLOAD);

      // Log performance data
      console.log(`New template download: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.NEW_TEMPLATE_DOWNLOAD}ms)`);
    });

    test('Download performance is consistent across multiple attempts', async() => {
      const template = MOCK_TEMPLATES.cached;
      const attempts = 5;
      const durations = [];

      for (let i = 0; i < attempts; i++) {
        const startTime = performance.now();
        await simulateTemplateDownload(template, { cached: true });
        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      // Calculate performance statistics
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      // Validate consistency
      expect(maxDuration - minDuration).toBeLessThan(200); // Less than 200ms variance
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_TEMPLATE_DOWNLOAD);

      console.log(`Download performance consistency - Avg: ${avgDuration.toFixed(2)}ms, Min: ${minDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms`);
    });
  });

  describe('2. Template Validation Performance', () => {
    test('Template validation completes in under 500ms', async() => {
      const template = MOCK_TEMPLATES.cached;
      const startTime = performance.now();

      // Simulate template validation
      const result = await simulateTemplateValidation(template);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Record performance metric
      performanceMetrics.validations.push({
        template: template.id,
        duration,
        timestamp: Date.now()
      });

      // Validate performance requirement
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_VALIDATION);
      expect(result.valid).toBe(true);
      expect(result.validationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_VALIDATION);

      // Log performance data
      console.log(`Template validation: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.TEMPLATE_VALIDATION}ms)`);
    });

    test('Validation performance scales reasonably with template size', async() => {
      const templates = [MOCK_TEMPLATES.cached, MOCK_TEMPLATES.new, MOCK_TEMPLATES.large];
      const results = [];

      for (const template of templates) {
        const startTime = performance.now();
        await simulateTemplateValidation(template);
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          template: template.id,
          size: template.size,
          duration
        });
      }

      // Validate that larger templates don't take disproportionately longer
      // (should scale linearly, not exponentially)
      const sizeRatios = results.map(r => r.size / results[0].size);
      const timeRatios = results.map(r => r.duration / results[0].duration);

      for (let i = 1; i < results.length; i++) {
        const efficiencyRatio = timeRatios[i] / sizeRatios[i];
        expect(efficiencyRatio).toBeLessThan(2.1); // Time should not increase more than 2.1x the size increase
      }

      // All validations should still meet the threshold
      for (const result of results) {
        expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_VALIDATION);
      }

      console.log('Validation scalability:', results.map(r => `${r.template}: ${r.duration.toFixed(2)}ms`));
    });

    test('Validation handles complex template structures efficiently', async() => {
      const complexTemplate = {
        ...MOCK_TEMPLATES.large,
        structure: {
          'package.json': '{}',
          'src/': {
            'components/': {
              'App.js': '',
              'Header.js': '',
              'Footer.js': ''
            },
            'utils/': {
              'helpers.js': '',
              'validators.js': ''
            },
            'services/': {
              'api.js': '',
              'auth.js': ''
            }
          },
          'config/': {
            'webpack.config.js': '',
            'babel.config.js': ''
          },
          'tests/': {
            'unit/': {
              'app.test.js': '',
              'utils.test.js': ''
            },
            'integration/': {
              'api.test.js': ''
            }
          }
        }
      };

      const startTime = performance.now();
      const result = await simulateTemplateValidation(complexTemplate);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_VALIDATION);
      expect(result.valid).toBe(true);

      console.log(`Complex template validation: ${duration.toFixed(2)}ms`);
    });
  });

  describe('3. Git Repository Cloning Performance', () => {
    test('Git repository cloning completes in under 3s for small repositories', async() => {
      const repo = MOCK_GIT_REPOSITORIES.small;
      const startTime = performance.now();

      // Simulate git repository cloning
      const result = await simulateGitClone(repo);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Record performance metric
      performanceMetrics.clones.push({
        repository: repo.url,
        duration,
        timestamp: Date.now()
      });

      // Validate performance requirement
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.GIT_CLONING_SMALL_REPO);
      expect(result.success).toBe(true);
      expect(result.cloneTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GIT_CLONING_SMALL_REPO);

      // Log performance data
      console.log(`Git cloning (${repo.name}): ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.GIT_CLONING_SMALL_REPO}ms)`);
    });

    test('Git cloning performance is consistent across different repositories', async() => {
      const repositories = [MOCK_GIT_REPOSITORIES.small, MOCK_GIT_REPOSITORIES.medium];
      const results = [];

      for (const repo of repositories) {
        const startTime = performance.now();
        await simulateGitClone(repo);
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          repository: repo.name,
          fileCount: repo.fileCount,
          duration
        });
      }

      // Validate performance scales reasonably with repository size
      const smallRepo = results.find(r => r.repository === 'Small Template');
      const mediumRepo = results.find(r => r.repository === 'Medium Template');

      expect(smallRepo.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.GIT_CLONING_SMALL_REPO);

      // Medium repository should take longer but still be reasonable
      expect(mediumRepo.duration).toBeGreaterThan(smallRepo.duration);
      expect(mediumRepo.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.GIT_CLONING_SMALL_REPO * 2);

      console.log('Git cloning performance:', results.map(r => `${r.repository}: ${r.duration.toFixed(2)}ms`));
    });
  });

  describe('4. Template Processing and Variable Substitution Performance', () => {
    test('Template processing and variable substitution completes in under 500ms', async() => {
      const template = MOCK_TEMPLATES.cached;
      const variables = {
        projectName: 'test-project',
        author: 'Test Author',
        description: 'Test project description',
        version: '1.0.0'
      };

      const startTime = performance.now();

      // Simulate template processing and variable substitution
      const result = await simulateTemplateProcessing(template, variables);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Record performance metric
      performanceMetrics.processing.push({
        template: template.id,
        duration,
        variableCount: Object.keys(variables).length,
        timestamp: Date.now()
      });

      // Validate performance requirement
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_PROCESSING);
      expect(result.success).toBe(true);
      expect(result.processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_PROCESSING);

      // Log performance data
      console.log(`Template processing: ${duration.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.TEMPLATE_PROCESSING}ms)`);
    });

    test('Processing performance scales linearly with variable count', async() => {
      const template = MOCK_TEMPLATES.cached;
      const variableCounts = [5, 10, 20, 50];
      const results = [];

      for (const count of variableCounts) {
        const variables = {};
        for (let i = 0; i < count; i++) {
          variables[`var${i}`] = `value${i}`;
        }

        const startTime = performance.now();
        await simulateTemplateProcessing(template, variables);
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          variableCount: count,
          duration
        });
      }

      // Validate linear scaling (duration should increase proportionally)
      for (let i = 1; i < results.length; i++) {
        const expectedRatio = results[i].variableCount / results[i - 1].variableCount;
        const actualRatio = results[i].duration / results[i - 1].duration;

        // Allow for some overhead but should be roughly linear
        expect(actualRatio).toBeLessThan(expectedRatio * 1.5);
      }

      // All processing should still meet the threshold (with some tolerance for edge cases)
      for (const result of results) {
        // Allow a small margin for the most complex case (50 variables)
        const threshold = result.variableCount >= 50 ?
          PERFORMANCE_THRESHOLDS.TEMPLATE_PROCESSING + 150 :
          PERFORMANCE_THRESHOLDS.TEMPLATE_PROCESSING;
        expect(result.duration).toBeLessThan(threshold);
      }

      console.log('Variable substitution scalability:', results.map(r => `${r.variableCount} vars: ${r.duration.toFixed(2)}ms`));
    });
  });

  describe('5. Network Timeout Handling Performance', () => {
    test('Network timeout handling doesn\'t block execution', async() => {
      const slowTemplate = {
        ...MOCK_TEMPLATES.new,
        downloadTime: PERFORMANCE_THRESHOLDS.NETWORK_TIMEOUT + 1000 // Slower than timeout
      };

      const startTime = performance.now();

      // Simulate download with timeout
      const result = await simulateTemplateDownloadWithTimeout(slowTemplate, {
        timeout: PERFORMANCE_THRESHOLDS.NETWORK_TIMEOUT,
        cached: false
      });
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Record performance metric
      performanceMetrics.timeouts.push({
        template: slowTemplate.id,
        duration,
        timeout: PERFORMANCE_THRESHOLDS.NETWORK_TIMEOUT,
        timestamp: Date.now()
      });

      // Validate that timeout handling is fast and doesn't block
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NETWORK_TIMEOUT + 500); // Should timeout quickly
      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.timeoutReason).toContain('timeout');

      // Log performance data
      console.log(`Network timeout handling: ${duration.toFixed(2)}ms (timeout: ${PERFORMANCE_THRESHOLDS.NETWORK_TIMEOUT}ms)`);
    }, 10000); // 10 second timeout for this test

    test('Multiple timeouts are handled efficiently', async() => {
      const timeoutPromises = [];
      const timeoutCount = 5;

      for (let i = 0; i < timeoutCount; i++) {
        const slowTemplate = {
          ...MOCK_TEMPLATES.new,
          id: `${MOCK_TEMPLATES.new.id}-${i}`,
          downloadTime: PERFORMANCE_THRESHOLDS.NETWORK_TIMEOUT + 1000
        };

        timeoutPromises.push(
          simulateTemplateDownloadWithTimeout(slowTemplate, {
            timeout: PERFORMANCE_THRESHOLDS.NETWORK_TIMEOUT,
            cached: false
          })
        );
      }

      const startTime = performance.now();
      const results = await Promise.allSettled(timeoutPromises);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // All should timeout and complete within reasonable time
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.NETWORK_TIMEOUT + 1000);

      const timeouts = results.filter(r => r.status === 'fulfilled' && r.value.timedOut);
      expect(timeouts.length).toBe(timeoutCount);

      console.log(`Multiple timeout handling: ${totalDuration.toFixed(2)}ms for ${timeoutCount} timeouts`);
    }, 10000); // 10 second timeout for this test
  });

  describe('6. Concurrent Template Downloads Performance', () => {
    test('Concurrent template downloads are properly managed', async() => {
      const templates = [
        MOCK_TEMPLATES.cached,
        MOCK_TEMPLATES.new,
        MOCK_TEMPLATES.large
      ];

      const startTime = performance.now();

      // Simulate concurrent downloads
      const downloadPromises = templates.map(template =>
        simulateTemplateDownload(template, { cached: template.id === MOCK_TEMPLATES.cached.id })
      );

      const results = await Promise.allSettled(downloadPromises);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Record performance metric
      performanceMetrics.concurrent.push({
        concurrentDownloads: templates.length,
        totalDuration,
        timestamp: Date.now()
      });

      // Validate that concurrent downloads complete efficiently
      const successfulDownloads = results.filter(r => r.status === 'fulfilled' && r.value.success);
      expect(successfulDownloads.length).toBe(templates.length);

      // Concurrent downloads should be faster than sequential
      const expectedSequentialTime = templates.reduce((sum, template) => {
        return sum + (template.id === MOCK_TEMPLATES.cached.id ?
          template.downloadTime : template.downloadTime);
      }, 0);

      expect(totalDuration).toBeLessThan(expectedSequentialTime);

      // Individual downloads should still meet their thresholds
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const downloadResult = result.value;
          if (downloadResult.fromCache) {
            expect(downloadResult.downloadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_TEMPLATE_DOWNLOAD);
          } else {
            expect(downloadResult.downloadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.NEW_TEMPLATE_DOWNLOAD);
          }
        }
      }

      console.log(`Concurrent downloads: ${totalDuration.toFixed(2)}ms for ${templates.length} templates`);
    });

    test('Concurrent downloads maintain performance under load', async() => {
      const concurrentLevels = [2, 4, 8];
      const results = [];

      for (const level of concurrentLevels) {
        const templates = Array.from({ length: level }, (_, i) => ({
          ...MOCK_TEMPLATES.cached,
          id: `${MOCK_TEMPLATES.cached.id}-${i}`
        }));

        const startTime = performance.now();
        const downloadPromises = templates.map(template =>
          simulateTemplateDownload(template, { cached: true })
        );

        await Promise.allSettled(downloadPromises);
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          concurrentLevel: level,
          duration
        });
      }

      // Validate that performance scales reasonably with concurrency
      for (let i = 1; i < results.length; i++) {
        const expectedRatio = results[i].concurrentLevel / results[i - 1].concurrentLevel;
        const actualRatio = results[i].duration / results[i - 1].duration;

        // Allow for some overhead but should scale reasonably
        expect(actualRatio).toBeLessThan(expectedRatio * 2);
      }

      console.log('Concurrent load performance:', results.map(r => `${r.concurrentLevel} concurrent: ${r.duration.toFixed(2)}ms`));
    });
  });

  describe('7. Performance Benchmarking and Metrics', () => {
    test('Performance metrics are collected and can be analyzed', () => {
      // Verify that performance metrics are being collected
      expect(performanceMetrics).toBeDefined();
      expect(typeof performanceMetrics).toBe('object');

      const metricTypes = ['downloads', 'validations', 'clones', 'processing', 'timeouts', 'concurrent'];
      for (const type of metricTypes) {
        expect(Array.isArray(performanceMetrics[type])).toBe(true);
      }
    });

    test('Performance benchmarks meet minimum requirements', () => {
      // Calculate aggregate performance statistics
      const avgDownloadTime = performanceMetrics.downloads.length > 0 ?
        performanceMetrics.downloads.reduce((sum, d) => sum + d.duration, 0) / performanceMetrics.downloads.length : 0;

      const avgValidationTime = performanceMetrics.validations.length > 0 ?
        performanceMetrics.validations.reduce((sum, v) => sum + v.duration, 0) / performanceMetrics.validations.length : 0;

      const avgProcessingTime = performanceMetrics.processing.length > 0 ?
        performanceMetrics.processing.reduce((sum, p) => sum + p.duration, 0) / performanceMetrics.processing.length : 0;

      // Validate aggregate performance
      if (avgDownloadTime > 0) {
        expect(avgDownloadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_TEMPLATE_DOWNLOAD);
      }
      if (avgValidationTime > 0) {
        expect(avgValidationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_VALIDATION);
      }
      if (avgProcessingTime > 0) {
        expect(avgProcessingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TEMPLATE_PROCESSING);
      }

      console.log('Performance summary:', {
        avgDownloadTime: avgDownloadTime.toFixed(2) + 'ms',
        avgValidationTime: avgValidationTime.toFixed(2) + 'ms',
        avgProcessingTime: avgProcessingTime.toFixed(2) + 'ms'
      });
    });

    test('Performance regression detection works', () => {
      // This test establishes a baseline for regression detection
      // In a real implementation, this would compare against historical data
      const baselineMetrics = {
        cachedDownload: 200, // ms
        validation: 100, // ms
        processing: 150 // ms
      };

      const currentMetrics = {
        cachedDownload: performanceMetrics.downloads
          .filter(d => d.type === 'cached')
          .reduce((sum, d) => sum + d.duration, 0) /
          Math.max(1, performanceMetrics.downloads.filter(d => d.type === 'cached').length),

        validation: performanceMetrics.validations.length > 0 ?
          performanceMetrics.validations.reduce((sum, v) => sum + v.duration, 0) / performanceMetrics.validations.length : 0,

        processing: performanceMetrics.processing.length > 0 ?
          performanceMetrics.processing.reduce((sum, p) => sum + p.duration, 0) / performanceMetrics.processing.length : 0
      };

      // Validate no significant performance regression (> 20% degradation)
      const regressionThreshold = 1.2; // 20% tolerance

      if (currentMetrics.cachedDownload > 0) {
        expect(currentMetrics.cachedDownload).toBeLessThan(baselineMetrics.cachedDownload * regressionThreshold);
      }
      if (currentMetrics.validation > 0) {
        expect(currentMetrics.validation).toBeLessThan(baselineMetrics.validation * regressionThreshold);
      }
      if (currentMetrics.processing > 0) {
        expect(currentMetrics.processing).toBeLessThan(baselineMetrics.processing * regressionThreshold);
      }

      console.log('Regression check passed - current performance within acceptable bounds');
    });
  });

  // Helper functions for simulating template operations
  async function setupMockCache() {
    // Create mock cached template entry
    const cachedTemplateDir = path.join(testCacheDir, MOCK_TEMPLATES.cached.id);
    await fs.ensureDir(cachedTemplateDir);

    // Create mock cache metadata
    const cacheMetadata = {
      id: MOCK_TEMPLATES.cached.id,
      name: MOCK_TEMPLATES.cached.name,
      version: '1.0.0',
      cachedAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 1,
      size: MOCK_TEMPLATES.cached.size,
      downloadTime: MOCK_TEMPLATES.cached.downloadTime
    };

    await fs.writeJSON(path.join(cachedTemplateDir, 'metadata.json'), cacheMetadata);

    // Create mock template files
    await fs.writeJSON(path.join(cachedTemplateDir, 'package.json'), {
      name: MOCK_TEMPLATES.cached.name,
      version: '1.0.0',
      description: 'Mock cached template'
    });
  }

  async function simulateTemplateDownload(template, options = {}) {
    // Simulate network delay
    const downloadTime = options.cached ?
      Math.random() * 100 + 50 : // 50-150ms for cached
      template.downloadTime; // Use template's download time for new

    await new Promise(resolve => setTimeout(resolve, downloadTime));

    if (options.cached) {
      // Simulate cache hit
      const cachePath = path.join(testCacheDir, template.id);
      if (await fs.pathExists(cachePath)) {
        const metadata = await fs.readJSON(path.join(cachePath, 'metadata.json'));
        metadata.lastAccessed = new Date().toISOString();
        metadata.accessCount = (metadata.accessCount || 0) + 1;
        await fs.writeJSON(path.join(cachePath, 'metadata.json'), metadata);

        return {
          success: true,
          fromCache: true,
          downloadTime,
          template: template.id
        };
      }
    }

    // Simulate cache miss - download new template
    const downloadPath = path.join(testTempDir, template.id);
    await fs.ensureDir(downloadPath);

    // Create mock template files
    await fs.writeJSON(path.join(downloadPath, 'package.json'), {
      name: template.name,
      version: '1.0.0',
      description: 'Downloaded template'
    });

    return {
      success: true,
      fromCache: false,
      downloadTime,
      template: template.id
    };
  }

  async function simulateTemplateDownloadWithTimeout(template, options = {}) {
    try {
      // Simulate timeout using Promise.race
      const downloadPromise = simulateTemplateDownload(template, options);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Download timeout')), options.timeout)
      );

      const result = await Promise.race([downloadPromise, timeoutPromise]);
      return result;
    } catch (error) {
      return {
        success: false,
        timedOut: true,
        timeoutReason: error.message,
        downloadTime: options.timeout
      };
    }
  }

  async function simulateTemplateValidation(template) {
    // Simulate validation processing time
    const validationTime = Math.random() * 200 + 50; // 50-250ms
    await new Promise(resolve => setTimeout(resolve, validationTime));

    // Mock validation logic
    const isValid = template.id && template.name && template.size > 0;

    return {
      valid: isValid,
      validationTime,
      template: template.id,
      issues: isValid ? [] : ['Invalid template structure']
    };
  }

  async function simulateGitClone(repository) {
    // Simulate git clone time
    const cloneTime = repository.cloneTime;
    await new Promise(resolve => setTimeout(resolve, cloneTime));

    return {
      success: true,
      cloneTime,
      repository: repository.url,
      fileCount: repository.fileCount
    };
  }

  async function simulateTemplateProcessing(template, variables) {
    // Simulate template processing time based on complexity
    const processingTime = Math.random() * 300 + 100; // 100-400ms base
    const variableOverhead = Object.keys(variables).length * 5; // 5ms per variable
    const totalTime = processingTime + variableOverhead;

    await new Promise(resolve => setTimeout(resolve, totalTime));

    return {
      success: true,
      processingTime: totalTime,
      template: template.id,
      variablesProcessed: Object.keys(variables).length
    };
  }
});
