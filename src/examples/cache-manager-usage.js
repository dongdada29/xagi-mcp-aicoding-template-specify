/**
 * CacheManager Usage Example
 *
 * This example demonstrates how to use the CacheManager service
 * for managing template cache operations.
 */

const CacheManager = require('../core/cache-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function cacheManagerExample() {
  console.log('=== CacheManager Usage Example ===\n');

  // Create a temporary directory for testing
  const testDir = path.join(os.tmpdir(), `cache-manager-example-${Date.now()}`);
  const templateDir = path.join(testDir, 'templates', 'react-template');
  const cacheDir = path.join(testDir, 'cache');

  try {
    // Create test template
    await createTestTemplate(templateDir);

    // Initialize CacheManager with custom configuration
    const cacheManager = new CacheManager({
      cacheDir: cacheDir,
      ttl: 60 * 60 * 1000, // 1 hour
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 100,
      persistent: true,
      enableMetrics: true,
      lruSize: 10
    });

    console.log('✓ CacheManager initialized');
    console.log(`  Cache directory: ${cacheDir}`);

    // Example 1: Check if template is cached
    console.log('\n1. Checking if template is cached...');
    const isCached = await cacheManager.isCached('react-template', '1.0.0');
    console.log(`  React template cached: ${isCached}`);

    // Example 2: Set cache entry
    console.log('\n2. Setting cache entry...');
    const cacheEntry = await cacheManager.setCacheEntry('react-template', '1.0.0', templateDir);
    console.log('✓ Cache entry created:');
    console.log(`  ID: ${cacheEntry.id}`);
    console.log(`  Template ID: ${cacheEntry.templateId}`);
    console.log(`  Version: ${cacheEntry.version}`);
    console.log(`  Size: ${cacheEntry.getFormattedSize()}`);

    // Example 3: Get cache entry
    console.log('\n3. Retrieving cache entry...');
    const retrievedEntry = await cacheManager.getCacheEntry('react-template', '1.0.0');
    if (retrievedEntry) {
      console.log('✓ Cache entry retrieved:');
      console.log(`  Access count: ${retrievedEntry.accessCount}`);
      console.log(`  Last accessed: ${retrievedEntry.lastAccessed.toISOString()}`);
      console.log(`  Valid: ${retrievedEntry.isValid}`);
    }

    // Example 4: Check cache statistics
    console.log('\n4. Getting cache statistics...');
    const stats = await cacheManager.getCacheStats();
    console.log('✓ Cache statistics:');
    console.log(`  Total entries: ${stats.basic.totalEntries}`);
    console.log(`  Total size: ${formatBytes(stats.basic.totalSize)}`);
    console.log(`  Hit rate: ${stats.performance.hitRate.toFixed(2)}%`);
    console.log(`  Average access time: ${stats.performance.averageAccessTime.toFixed(2)}ms`);
    console.log(`  LRU cache size: ${stats.lru.lruSize}/${stats.lru.maxLruSize}`);

    // Example 5: Create multiple cache entries
    console.log('\n5. Creating multiple cache entries...');
    const templates = [
      { id: 'vue-template', version: '2.0.0' },
      { id: 'angular-template', version: '15.0.0' },
      { id: 'node-template', version: '18.0.0' }
    ];

    for (const template of templates) {
      const templatePath = path.join(testDir, 'templates', template.id);
      await createTestTemplate(templatePath, template.id);
      await cacheManager.setCacheEntry(template.id, template.version, templatePath);
      console.log(`  ✓ Cached ${template.id}@${template.version}`);
    }

    // Example 6: Get updated statistics
    console.log('\n6. Updated cache statistics...');
    const updatedStats = await cacheManager.getCacheStats();
    console.log(`  Total entries: ${updatedStats.basic.totalEntries}`);
    console.log(`  Total size: ${formatBytes(updatedStats.basic.totalSize)}`);
    console.log(`  Cache utilization: ${updatedStats.policies.currentUtilization.toFixed(2)}%`);

    // Example 7: List all cached templates
    console.log('\n7. Cached templates:');
    updatedStats.entries.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.templateId}@${entry.version}`);
      console.log(`     Size: ${entry.formattedSize}`);
      console.log(`     Access count: ${entry.accessCount}`);
      console.log(`     Age: ${entry.formattedAge}`);
    });

    // Example 8: Test cache hit performance
    console.log('\n8. Testing cache hit performance...');
    const startTime = Date.now();
    await cacheManager.getCacheEntry('react-template', '1.0.0');
    const endTime = Date.now();
    console.log(`  Cache access time: ${endTime - startTime}ms`);

    // Example 9: Prune cache (dry run)
    console.log('\n9. Testing cache pruning (dry run)...');
    const pruneResult = await cacheManager.pruneCache({ dryRun: true });
    console.log(`  Would remove: ${pruneResult.removedEntries} entries`);
    console.log(`  Would keep: ${pruneResult.remainingEntries} entries`);

    // Example 10: Performance metrics
    console.log('\n10. Performance metrics:');
    const performanceMetrics = cacheManager.getPerformanceMetrics();
    console.log(`  Cache hit rate: ${performanceMetrics.cacheHitRate.toFixed(2)}%`);
    console.log(`  Average access time: ${performanceMetrics.averageAccessTime.toFixed(2)}ms`);
    console.log(`  Recent access times: ${performanceMetrics.recentAccessTimes.join(', ')}ms`);

    // Example 11: Clear specific cache entries
    console.log('\n11. Clearing specific cache entries...');
    const clearResult = await cacheManager.clearCache({
      preserve: ['react-template', 'vue-template']
    });
    console.log(`  Cleared: ${clearResult.clearedEntries} entries`);
    console.log(`  Preserved: ${clearResult.preservedEntries} entries`);

    // Example 12: Final statistics
    console.log('\n12. Final cache statistics:');
    const finalStats = await cacheManager.getCacheStats();
    console.log(`  Total entries: ${finalStats.basic.totalEntries}`);
    console.log(`  Total size: ${formatBytes(finalStats.basic.totalSize)}`);
    console.log(`  Total hits: ${finalStats.performance.hits}`);
    console.log(`  Total misses: ${finalStats.performance.misses}`);

    // Clean up
    console.log('\n13. Cleaning up...');
    await cacheManager.destroy();

    console.log('\n=== Example completed successfully! ===');

  } catch (error) {
    console.error('Error in cache manager example:', error);
  } finally {
    // Clean up test directory
    await fs.remove(testDir);
  }
}

// Helper function to create test template
async function createTestTemplate(templatePath, templateName = 'react-template') {
  await fs.ensureDir(templatePath);

  const packageJson = {
    name: templateName,
    version: '1.0.0',
    description: `${templateName} template`,
    main: 'index.js',
    dependencies: {
      'react': '^18.0.0',
      'react-dom': '^18.0.0'
    }
  };

  await fs.writeJSON(path.join(templatePath, 'package.json'), packageJson);
  await fs.writeFile(path.join(templatePath, 'README.md'), `# ${templateName}\n\nThis is a ${templateName}.`);
  await fs.writeFile(path.join(templatePath, 'index.js'), `console.log('Hello from ${templateName}!');`);

  // Create subdirectories
  await fs.ensureDir(path.join(templatePath, 'src'));
  await fs.writeFile(path.join(templatePath, 'src', 'App.js'), `// ${templateName} App component`);
  await fs.ensureDir(path.join(templatePath, 'public'));
  await fs.writeFile(path.join(templatePath, 'public', 'index.html'), '<!DOCTYPE html><html><head><title>Template</title></head><body></body></html>');
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) {return '0 B';}
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the example
if (require.main === module) {
  cacheManagerExample().catch(console.error);
}

module.exports = cacheManagerExample;
