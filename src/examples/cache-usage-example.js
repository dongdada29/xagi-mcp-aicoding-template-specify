/**
 * CacheStore Usage Example
 *
 * This example demonstrates how to use the CacheStore model
 * for managing cached template packages.
 */

const CacheStore = require('../models/cache');
const fs = require('fs-extra');
const path = require('path');

async function cacheExample() {
  console.log('=== CacheStore Usage Example ===\n');

  // Example 1: Create a new cache entry
  console.log('1. Creating a new cache entry...');
  const cacheDir = path.join(process.cwd(), '.cache', 'my-template-1.0.0');
  await fs.ensureDir(cacheDir);

  // Create some mock template files
  await fs.writeFile(path.join(cacheDir, 'package.json'), JSON.stringify({
    name: 'my-template',
    version: '1.0.0',
    description: 'Example template'
  }, null, 2));

  await fs.writeFile(path.join(cacheDir, 'README.md'), '# My Template\n\nThis is an example template.');
  await fs.ensureDir(path.join(cacheDir, 'src'));
  await fs.writeFile(path.join(cacheDir, 'src', 'index.js'), 'console.log("Hello from template!");');

  // Create cache entry
  const cacheEntry = new CacheStore({
    id: 'cache-123',
    templateId: 'my-template',
    version: '1.0.0',
    path: cacheDir
  });

  console.log('Cache entry created:', {
    id: cacheEntry.id,
    templateId: cacheEntry.templateId,
    version: cacheEntry.version,
    path: cacheEntry.path
  });

  // Example 2: Validate cache entry
  console.log('\n2. Validating cache entry...');
  try {
    const isValid = await cacheEntry.validate();
    console.log('Cache entry is valid:', isValid);
    console.log('Cache entry size:', await cacheEntry.getSize(), 'bytes');
    console.log('Formatted size:', cacheEntry.getFormattedSize());
  } catch (error) {
    console.error('Validation failed:', error.message);
  }

  // Example 3: Update access information
  console.log('\n3. Updating access information...');
  await cacheEntry.touch();
  console.log('Access count:', cacheEntry.accessCount);
  console.log('Last accessed:', cacheEntry.lastAccessed.toISOString());

  // Example 4: Check expiration
  console.log('\n4. Checking expiration...');
  const ttl = 24 * 60 * 60 * 1000; // 24 hours
  console.log('Is expired (24h TTL):', cacheEntry.isExpired(ttl));

  // Example 5: JSON serialization
  console.log('\n5. JSON serialization...');
  const json = cacheEntry.toJSON();
  console.log('JSON representation:', JSON.stringify(json, null, 2));

  // Example 6: Create from JSON
  console.log('\n6. Creating from JSON...');
  const restoredCache = CacheStore.fromJSON(json);
  console.log('Restored cache entry:', {
    id: restoredCache.id,
    templateId: restoredCache.templateId,
    version: restoredCache.version
  });

  // Example 7: Calculate checksum
  console.log('\n7. Calculating checksum...');
  const checksum = await cacheEntry.calculateChecksum();
  console.log('Checksum:', checksum);

  // Set checksum and validate with checksum
  cacheEntry.checksum = checksum;
  const isValidWithChecksum = await cacheEntry.validate();
  console.log('Validation with checksum:', isValidWithChecksum);

  // Example 8: Human-readable age
  console.log('\n8. Cache age...');
  console.log('Created:', cacheEntry.createdAt.toISOString());
  console.log('Age:', cacheEntry.getFormattedAge());

  // Example 9: Cleanup (optional)
  console.log('\n9. Cleanup...');
  console.log('Removing cache entry...');
  try {
    await cacheEntry.remove();
    console.log('Cache entry removed successfully');
  } catch (error) {
    console.error('Failed to remove cache entry:', error.message);
  }

  console.log('\n=== Example completed ===');
}

// Run the example
if (require.main === module) {
  cacheExample().catch(console.error);
}

module.exports = cacheExample;
