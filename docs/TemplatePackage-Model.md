# TemplatePackage Model

The `TemplatePackage` class represents a template package with all required attributes and validation logic. Template packages follow the naming convention `@xagi/ai-template-{type}`.

## Overview

The TemplatePackage model provides:

- **Data Structure**: Complete representation of template packages with all required attributes
- **Validation**: Comprehensive validation for template structure, naming conventions, and data integrity
- **Version Compatibility**: Support for CLI version compatibility checking
- **Schema Validation**: JSON Schema-based template configuration validation
- **Serialization**: Easy conversion to/from JSON format

## Installation

The TemplatePackage model is part of the main package and can be imported as:

```javascript
const TemplatePackage = require('../src/models/template');
```

## Class Definition

### Constructor

```javascript
new TemplatePackage(data)
```

**Parameters:**
- `data` (Object): Template package data with the following properties:
  - `id` (string): Unique identifier (npm package name) - **Required**
  - `name` (string): Human-readable template name - **Required**
  - `version` (string): Semantic version string (default: "1.0.0")
  - `description` (string): Template description (default: "")
  - `type` (string): Template type - **Required**
  - `author` (string): Template author/maintainer (default: "")
  - `keywords` (Array<string>): Search keywords for discovery (default: [])
  - `dependencies` (Object): Template-specific dependencies (default: {})
  - `devDependencies` (Object): Development dependencies (default: {})
  - `configSchema` (Object): JSON Schema for template configuration (default: {})
  - `supportedVersions` (Array<string>): Compatible CLI versions (default: ["^1.0.0"])
  - `createdAt` (string): Creation timestamp (default: current time)
  - `updatedAt` (string): Last update timestamp (default: current time)
  - `downloadCount` (number): Download count (default: 0)

**Example:**
```javascript
const templateData = {
  id: '@xagi/ai-template-react-next',
  name: 'React Next.js Template',
  version: '1.0.0',
  description: 'A comprehensive React and Next.js template',
  type: 'react-next',
  author: 'XAGI Team',
  keywords: ['react', 'nextjs', 'typescript'],
  dependencies: {
    react: '^18.0.0',
    'next': '^13.0.0'
  }
};

const template = new TemplatePackage(templateData);
```

## Supported Template Types

The model supports the following template types:

- `react-next`: React with Next.js applications
- `node-api`: Node.js API/server applications
- `vue-app`: Vue.js applications

## Methods

### validate()

Validates the template package structure and naming convention.

**Returns:** Object with validation results:
- `isValid` (boolean): Whether the template is valid
- `errors` (Array<string>): Array of error messages
- `warnings` (Array<string>): Array of warning messages

**Example:**
```javascript
const result = template.validate();
if (result.isValid) {
  console.log('Template is valid');
} else {
  console.error('Validation errors:', result.errors);
}
```

### isCompatible(version)

Checks if the template is compatible with a given CLI version.

**Parameters:**
- `version` (string): CLI version to check

**Returns:** `boolean` - True if compatible

**Example:**
```javascript
if (template.isCompatible('1.0.0')) {
  console.log('Template is compatible with CLI version 1.0.0');
}
```

### getConfig()

Returns the template configuration schema with metadata.

**Returns:** Object containing the configuration schema with added metadata

**Example:**
```javascript
const configSchema = template.getConfig();
console.log(configSchema._metadata.templateId); // @xagi/ai-template-react-next
```

### validateConfig(config)

Validates configuration data against the template's JSON Schema.

**Parameters:**
- `config` (Object): Configuration to validate

**Returns:** Object with validation results:
- `isValid` (boolean): Whether the configuration is valid
- `errors` (Array<string>): Array of error messages
- `validatedConfig` (Object|null): Validated configuration or null if invalid

**Example:**
```javascript
const userConfig = {
  useTypescript: true,
  useTailwind: false
};

const result = template.validateConfig(userConfig);
if (result.isValid) {
  console.log('Configuration is valid');
} else {
  console.error('Configuration errors:', result.errors);
}
```

### toJSON()

Serializes the template package to a JSON object.

**Returns:** Object representation of the template

**Example:**
```javascript
const json = template.toJSON();
console.log(json.name); // "React Next.js Template"
```

### update(updates)

Updates template metadata with validation.

**Parameters:**
- `updates` (Object): Updates to apply

**Returns:** Validation result object from `validate()`

**Example:**
```javascript
const result = template.update({
  name: 'Updated Template Name',
  version: '1.1.0'
});
```

### incrementDownloadCount()

Increments the download count and updates the timestamp.

**Example:**
```javascript
template.incrementDownloadCount();
console.log(template.downloadCount); // Incremented value
```

## Static Methods

### fromPackageJson(packageData)

Creates a TemplatePackage instance from package.json data.

**Parameters:**
- `packageData` (Object): Package.json data

**Returns:** TemplatePackage instance

**Example:**
```javascript
const packageData = require('./package.json');
const template = TemplatePackage.fromPackageJson(packageData);
```

### getTemplateType(packageName)

Extracts the template type from a package name.

**Parameters:**
- `packageName` (string): Package name to parse

**Returns:** `string|null` - Template type or null if not a template package

**Example:**
```javascript
const type = TemplatePackage.getTemplateType('@xagi/ai-template-react-next');
console.log(type); // "react-next"
```

## Naming Convention Validation

The model enforces the `@xagi/ai-template-{type}` naming convention:

- Must start with `@xagi/ai-template-`
- The suffix must be a valid template type (`react-next`, `node-api`, `vue-app`)
- The type in the package name must match the `type` property

## Error Handling

The model provides comprehensive error handling with:

- **Required Field Validation**: Ensures all required fields are present
- **Type Validation**: Validates data types for all fields
- **Semantic Version Validation**: Ensures versions follow semantic versioning
- **Dependency Validation**: Validates dependency version formats
- **Schema Validation**: Validates JSON Schema structures
- **Timestamp Validation**: Ensures timestamps are valid dates

## Examples

### Basic Usage

```javascript
const TemplatePackage = require('../src/models/template');

// Create a new template
const template = new TemplatePackage({
  id: '@xagi/ai-template-react-next',
  name: 'React Next.js Template',
  version: '1.0.0',
  description: 'A comprehensive React and Next.js template',
  type: 'react-next',
  author: 'XAGI Team'
});

// Validate the template
const validation = template.validate();
if (!validation.isValid) {
  console.error('Template validation failed:', validation.errors);
  return;
}

// Check compatibility
if (template.isCompatible('1.0.0')) {
  console.log('Template is compatible with current CLI version');
}

// Get configuration schema
const config = template.getConfig();
console.log('Template configuration schema:', config);
```

### Advanced Usage with Configuration Schema

```javascript
const template = new TemplatePackage({
  id: '@xagi/ai-template-node-api',
  name: 'Node.js API Template',
  version: '2.0.0',
  type: 'node-api',
  configSchema: {
    type: 'object',
    properties: {
      port: {
        type: 'number',
        minimum: 1024,
        maximum: 65535,
        default: 3000
      },
      useDatabase: {
        type: 'boolean',
        default: false
      },
      databaseType: {
        type: 'string',
        enum: ['mongodb', 'postgresql', 'mysql'],
        default: 'mongodb'
      }
    },
    required: ['port']
  }
});

// Validate user configuration
const userConfig = {
  port: 8080,
  useDatabase: true,
  databaseType: 'postgresql'
};

const configValidation = template.validateConfig(userConfig);
if (configValidation.isValid) {
  console.log('Configuration is valid and can be used');
} else {
  console.error('Invalid configuration:', configValidation.errors);
}
```

### Creating from package.json

```javascript
const fs = require('fs');
const TemplatePackage = require('../src/models/template');

// Read package.json
const packageData = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// Create template from package.json
const template = TemplatePackage.fromPackageJson(packageData);

console.log(`Template: ${template.name} (${template.type})`);
console.log(`Version: ${template.version}`);
console.log(`Downloads: ${template.downloadCount}`);
```

## Testing

The TemplatePackage model includes comprehensive tests covering:

- Constructor behavior and default values
- Validation of all template attributes
- Naming convention enforcement
- Version compatibility checking
- Configuration schema validation
- JSON serialization
- Error handling and edge cases

Run tests with:
```bash
npm test tests/models/template.test.js
```

## Dependencies

- `ajv`: JSON Schema validation
- `semver`: Semantic version parsing and comparison

## Best Practices

1. **Always Validate**: Always call `validate()` after creating or updating templates
2. **Use Semantic Versions**: Follow semantic versioning for template versions
3. **Provide Schemas**: Include JSON Schema for configuration when possible
4. **Handle Errors**: Always check validation results before using templates
5. **Version Compatibility**: Specify supported CLI versions for better compatibility management
6. **Naming Convention**: Always use the `@xagi/ai-template-{type}` naming convention

## File Structure

```
src/
├── models/
│   └── template.js          # TemplatePackage model implementation
├── utils/
│   └── validation.js        # Validation utilities
tests/
├── models/
│   └── template.test.js     # TemplatePackage model tests
docs/
└── TemplatePackage-Model.md # This documentation
```