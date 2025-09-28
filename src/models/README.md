# TemplateRegistry Model

The `TemplateRegistry` class provides a comprehensive interface for managing template registries with support for different registry types, authentication, caching, and synchronization.

## Features

- **Multiple Registry Types**: Support for public, private, and local registries
- **Authentication**: Built-in authentication support for private registries
- **Caching**: Configurable caching strategies for improved performance
- **Synchronization**: Automatic sync with remote registries
- **Validation**: Comprehensive input validation and error handling
- **Health Checks**: Monitor registry availability

## Usage

### Creating a Registry

```javascript
const TemplateRegistry = require('./registry');

// Public registry
const publicRegistry = new TemplateRegistry({
  name: 'Official Public Templates',
  url: 'https://templates.example.com',
  type: 'public',
  cachePolicy: 'aggressive'
});

// Private registry
const privateRegistry = new TemplateRegistry({
  name: 'Company Private Registry',
  url: 'https://internal.company.com/templates',
  type: 'private',
  authRequired: true,
  cachePolicy: 'conservative'
});

// Local registry
const localRegistry = new TemplateRegistry({
  name: 'Local Templates',
  url: 'file:///home/user/templates',
  type: 'local',
  cachePolicy: 'none'
});
```

### Working with Registries

```javascript
// Check availability
const isAvailable = await registry.isAvailable();

// Authenticate (if required)
if (registry.authRequired) {
  await registry.authenticate('your-auth-token');
}

// Get templates
const templates = await registry.getTemplates();

// Get filtered templates
const reactTemplates = await registry.getTemplates({
  filter: 'react'
});

// Synchronize registry
await registry.sync();

// Get registry info
const info = registry.getInfo();
```

### Cache Management

The model supports different caching strategies:

- `aggressive`: Cache for 5 minutes
- `conservative`: Cache for 24 hours
- `default`: Cache for 1 hour
- `none`: No caching

```javascript
// Force refresh templates
const freshTemplates = await registry.getTemplates({
  forceRefresh: true
});
```

### Serialization

```javascript
// Convert to JSON
const json = registry.toJSON();

// Create from JSON
const restoredRegistry = TemplateRegistry.fromJSON(json);
```

## API Reference

### Constructor

```javascript
new TemplateRegistry(config)
```

**Parameters:**
- `config.id` (string, optional): Unique registry identifier
- `config.name` (string, required): Registry name
- `config.url` (string, required): Registry URL
- `config.type` (string, required): Registry type (`public`, `private`, `local`)
- `config.authRequired` (boolean, optional): Whether authentication is required (default: `false`)
- `config.cachePolicy` (string, optional): Caching strategy (default: `default`)
- `config.lastSync` (Date, optional): Last synchronization timestamp
- `config.templateCount` (number, optional): Number of available templates (default: `0`)
- `config.status` (string, optional): Registry status (default: `active`)

### Methods

#### `sync()`

Synchronizes the registry with the remote source.

**Returns:** `Promise<Object>` - Synchronization result

**Throws:** Error if synchronization fails

#### `authenticate(token)`

Authenticates with the registry using the provided token.

**Parameters:**
- `token` (string): Authentication token

**Returns:** `Promise<Object>` - Authentication result

**Throws:** Error if authentication fails

#### `isAvailable()`

Checks if the registry is available and responding.

**Returns:** `Promise<boolean>` - Whether the registry is available

#### `getTemplates(options)`

Retrieves templates from the registry.

**Parameters:**
- `options.forceRefresh` (boolean, optional): Force refresh from registry (default: `false`)
- `options.filter` (string, optional): Filter templates by name or description

**Returns:** `Promise<Array>` - Array of templates

**Throws:** Error if template retrieval fails

#### `toJSON()`

Serializes the registry to a JSON object.

**Returns:** `Object` - JSON representation of the registry

#### `getInfo()`

Gets registry information and status.

**Returns:** `Object` - Registry information

### Static Methods

#### `TemplateRegistry.fromJSON(json)`

Creates a registry instance from a JSON object.

**Parameters:**
- `json` (Object): JSON representation of a registry

**Returns:** `TemplateRegistry` - Registry instance

## Error Handling

The model throws specific errors for various failure conditions:

- **Invalid Configuration**: Thrown when registry configuration is invalid
- **Authentication Failed**: Thrown when authentication fails
- **Synchronization Failed**: Thrown when sync fails
- **Network Error**: Thrown when network requests fail
- **Local Registry Sync**: Thrown when attempting to sync a local registry

## Examples

See `examples/registry-usage.js` for comprehensive usage examples.

## Testing

Run tests with:

```bash
npm test -- test/registry.test.js
```