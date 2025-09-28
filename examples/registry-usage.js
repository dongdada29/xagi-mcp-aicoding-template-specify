/**
 * Example usage of the TemplateRegistry model
 */

const TemplateRegistry = require('../src/models/registry');

// Example 1: Create a public registry
const publicRegistry = new TemplateRegistry({
  name: 'Official Public Templates',
  url: 'https://templates.example.com',
  type: 'public',
  cachePolicy: 'aggressive'
});

console.log('Public Registry:', publicRegistry.getInfo());

// Example 2: Create a private registry
const privateRegistry = new TemplateRegistry({
  name: 'Company Private Registry',
  url: 'https://internal.company.com/templates',
  type: 'private',
  authRequired: true,
  cachePolicy: 'conservative'
});

console.log('Private Registry:', privateRegistry.getInfo());

// Example 3: Create a local registry
const localRegistry = new TemplateRegistry({
  name: 'Local Templates',
  url: 'file:///home/user/templates',
  type: 'local',
  cachePolicy: 'none'
});

console.log('Local Registry:', localRegistry.getInfo());

// Example 4: Working with registries
async function demonstrateRegistryUsage() {
  try {
    // Check if registry is available
    const isAvailable = await publicRegistry.isAvailable();
    console.log('Registry available:', isAvailable);

    if (isAvailable) {
      // Get templates
      const templates = await publicRegistry.getTemplates();
      console.log(`Found ${templates.length} templates`);

      // Filter templates
      const filtered = await publicRegistry.getTemplates({
        filter: 'react'
      });
      console.log(`Found ${filtered.length} React templates`);
    }

    // Authenticate with private registry
    if (privateRegistry.authRequired) {
      const authResult = await privateRegistry.authenticate('your-auth-token');
      console.log('Authentication result:', authResult);
    }

    // Synchronize registry
    const syncResult = await publicRegistry.sync();
    console.log('Sync result:', syncResult);

  } catch (error) {
    console.error('Registry operation failed:', error.message);
  }
}

// Uncomment to run the demonstration
// demonstrateRegistryUsage();

// Example 5: JSON serialization
const registryJson = publicRegistry.toJSON();
console.log('JSON representation:', registryJson);

// Create registry from JSON
const restoredRegistry = TemplateRegistry.fromJSON(registryJson);
console.log('Restored registry:', restoredRegistry.getInfo());