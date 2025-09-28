# @xagi/create-ai-project

> AI Project Initialization Template Tool - CLI for creating standardized project structures

## Features

- 🚀 **Fast Project Creation**: Create new projects from templates in seconds
- 📦 **Multiple Templates**: Support for React, Vue, Node.js, Python, and more
- 🔒 **Private Registry Support**: Work with private npm registries and authentication
- ✅ **Template Validation**: Comprehensive validation and security scanning
- 📊 **Progress Indicators**: Visual feedback for long-running operations
- ⚡ **Performance Optimized**: <200ms CLI response time, <50MB memory usage
- 🧪 **Comprehensive Testing**: Full unit test coverage for all components
- 🔧 **Configuration Management**: Flexible configuration system with validation
- 📈 **Performance Monitoring**: Built-in performance and memory monitoring
- 🎯 **CLI Interface**: Intuitive command-line interface with multiple commands

## Installation

```bash
# Install globally
npm install -g @xagi/create-ai-project

# Or use npx
npx @xagi/create-ai-project
```

## Quick Start

```bash
# Show help
create-ai-project --help

# List available templates
create-ai-project list

# Create a new project interactively
create-ai-project create

# Create a React Next.js project
create-ai-project create @xagi/ai-template-react-next-app

# Create with custom options
create-ai-project create @xagi/ai-template-react-next-app --name my-project --path ./my-project
```

## Commands

### Project Management

```bash
# List available templates
create-ai-project list

# Create a new project
create-ai-project create [template] [options]

# Show template information
create-ai-project info <template-id>

# Validate a template
create-ai-project validate template <template-id>
```

### Cache Management

```bash
# Clear template cache
create-ai-project cache clear

# Show cache statistics
create-ai-project cache list

# Remove expired cache entries
create-ai-project cache prune
```

### Configuration

```bash
# Show configuration
create-ai-project config get <key>

# Set configuration value
create-ai-project config set <key> <value>

# Reset configuration to defaults
create-ai-project config reset
```

### Private Registries

```bash
# Add private registry interactively
create-ai-project registry add

# List configured registries
create-ai-project registry list

# Test registry connectivity
create-ai-project registry test <registry-id>

# Search packages in registry
create-ai-project registry search <registry-id> <query>

# Remove registry
create-ai-project registry remove <registry-id>
```

## Supported Templates

### Frontend Frameworks
- **React Next.js**: `@xagi/ai-template-react-next-app`
- **Vue.js**: `@xagi/ai-template-vue-app`
- **Angular**: `@xagi/ai-template-angular-app`
- **Svelte**: `@xagi/ai-template-svelte-app`

### Backend Frameworks
- **Node.js/Express**: `@xagi/ai-template-node-express`
- **Python FastAPI**: `@xagi/ai-template-python-fastapi`
- **Python Django**: `@xagi/ai-template-python-django`
- **Python Flask**: `@xagi/ai-template-python-flask`
- **Spring Boot**: `@xagi/ai-template-spring-boot`
- **.NET**: `@xagi/ai-template-dotnet`
- **Go**: `@xagi/ai-template-go`
- **Rust**: `@xagi/ai-template-rust`

### Libraries & Packages
- **Python Library**: `@xagi/ai-template-python-lib`
- **NPM Package**: `@xagi/ai-template-npm-package`

### Advanced Architectures
- **Monorepo**: `@xagi/ai-template-monorepo`
- **Microservice**: `@xagi/ai-template-microservice`

## Configuration

The tool uses a comprehensive configuration system with validation. Configuration is stored in `~/.xagi/create-ai-project/config.json`.

### Example Configuration

```json
{
  "general": {
    "defaultTemplateType": "react-next",
    "defaultRegistry": "npm",
    "autoInstall": true,
    "autoGit": true
  },
  "cache": {
    "enabled": true,
    "ttl": 86400000,
    "maxSize": 5368709120,
    "maxEntries": 100
  },
  "security": {
    "enableValidation": true,
    "enableSecurityScan": true,
    "allowUnsignedTemplates": false
  },
  "performance": {
    "enableMonitoring": true,
    "enableMemoryOptimization": true,
    "parallelDownloads": 3
  }
}
```

## Private Registry Support

The tool supports private npm registries with multiple authentication methods:

### Token Authentication
```bash
create-ai-project registry add \
  --id "private-registry" \
  --url "https://registry.example.com" \
  --auth-type "token" \
  --token "your-auth-token"
```

### Basic Authentication
```bash
create-ai-project registry add \
  --id "private-registry" \
  --url "https://registry.example.com" \
  --auth-type "basic" \
  --username "your-username" \
  --password "your-password"
```

## Environment Variables

```bash
# Enable debug mode
DEBUG=create-ai-project

# Enable performance monitoring
DEBUG_PERFORMANCE=1

# Enable memory monitoring
DEBUG_MEMORY=1

# Custom configuration path
XAGI_CONFIG_PATH=/path/to/config.json

# Custom cache directory
XAGI_CACHE_DIR=/path/to/cache
```

## Development

### Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0

### Setup
```bash
# Clone repository
git clone https://github.com/xagi/create-ai-project.git
cd create-ai-project

# Install dependencies
npm install

# Run tests
npm test

# Run with development options
npm run dev
```

### Testing
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Performance

The CLI is optimized for performance:

- **Response Time**: <200ms for CLI commands
- **Memory Usage**: <50MB during operation
- **Lazy Loading**: Commands and dependencies are loaded on demand
- **Caching**: Intelligent caching for templates and registry data
- **Monitoring**: Built-in performance and memory monitoring

## Security

- **Template Validation**: Comprehensive validation of template packages
- **Security Scanning**: Automatic scanning for security issues
- **Dependency Validation**: Check for known vulnerabilities
- **Secure Storage**: Encrypted storage of sensitive credentials
- **Access Control**: Configurable access controls for registries

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Architecture

The tool is built with a modular architecture:

```
src/
├── cli/                    # CLI interface and commands
├── core/                   # Core services and managers
├── models/                 # Data models
├── services/               # Business logic services
└── utils/                  # Utility functions
```

### Core Components

- **TemplateManager**: Manages template operations
- **RegistryManager**: Handles private registry operations
- **CacheManager**: Manages template caching
- **ConfigManager**: Handles configuration management
- **ErrorHandler**: Centralized error handling
- **PerformanceMonitor**: Performance monitoring
- **MemoryMonitor**: Memory usage optimization

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/xagi/create-ai-project/wiki)
- 🐛 [Issue Tracker](https://github.com/xagi/create-ai-project/issues)
- 💬 [Discussions](https://github.com/xagi/create-ai-project/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details about changes in each version.

## Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js)
- Templates powered by [npm](https://www.npmjs.com/)
- Security scanning with custom validators
- Performance optimized with monitoring tools

---

**Made with ❤️ by XAGI Team**