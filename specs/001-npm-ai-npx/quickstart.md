# Quick Start Guide: AI Project Initialization Template Tool

## Prerequisites

Before using the AI Project Initialization Template Tool, ensure you have the following installed:

- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher
- **Git**: Version 2.0 or higher
- **Network connectivity**: For downloading templates from npm registry

## Installation

### Global Installation (Recommended)

```bash
npm install -g @xagi/create-ai-project
```

### Using npx (No Installation Required)

```bash
npx @xagi/create-ai-project
```

## Basic Usage

### 1. List Available Templates

View all available project templates:

```bash
@xagi/create-ai-project list
```

**Expected Output:**
```
Available Templates:
┌─────────────────────────────────────────┬──────────────┬─────────────────┬────────────────────────────────┐
│ Name                                   │ Type          │ Version         │ Description                  │
├─────────────────────────────────────────┼──────────────┼─────────────────┼────────────────────────────────┤
│ @xagi/ai-template-react-next-app       │ react-next    │ 1.0.0          │ React Next.js application     │
│ @xagi/ai-template-node-api             │ node-api      │ 1.0.0          │ Node.js API server           │
│ @xagi/ai-template-vue-app              │ vue-app       │ 1.0.0          │ Vue.js application           │
│ @xagi/ai-template-custom-server        │ custom-server │ 1.0.0          │ Custom server template       │
└─────────────────────────────────────────┴──────────────┴─────────────────┴────────────────────────────────┘
```

### 2. Create a New Project

#### Interactive Mode

```bash
@xagi/create-ai-project create
```

**Interactive Flow:**
1. **Select Template**: Choose from available template types
2. **Project Name**: Enter your project name
3. **Target Directory**: Specify where to create the project
4. **Configuration**: Provide template-specific settings
5. **Review**: Confirm your choices before creation

#### Non-Interactive Mode

```bash
@xagi/create-ai-project create @xagi/ai-template-react-next-app --name my-app --path ./my-app
```

### 3. Advanced Configuration

#### Using Specific Template Version

```bash
@xagi/create-ai-project create @xagi/ai-template-react-next-app@1.0.0 --name my-app --path ./my-app
```

#### Using Private Registry

```bash
@xagi/create-ai-project create @xagi/ai-template-react-next-app --name my-app --path ./my-app --registry https://registry.mycompany.com
```

#### Custom Configuration

```bash
@xagi/create-ai-project create @xagi/ai-template-react-next-app \
  --name my-app \
  --path ./my-app \
  --config '{"typescript": true, "tailwind": true, "eslint": true}'
```

## Template-Specific Examples

### React Next.js Application

```bash
@xagi/create-ai-project create @xagi/ai-template-react-next-app \
  --name blog-app \
  --path ./blog-app \
  --config '{
    "typescript": true,
    "tailwind": true,
    "eslint": true,
    "prettier": true,
    "appDirectory": true,
    "srcDirectory": true,
    "importAlias": "@/*"
  }'
```

### Node.js API Server

```bash
@xagi/create-ai-project create @xagi/ai-template-node-api \
  --name user-service \
  --path ./user-service \
  --config '{
    "framework": "express",
    "typescript": true,
    "database": "postgresql",
    "authentication": "jwt",
    "testing": "jest",
    "docker": true
  }'
```

### Vue.js Application

```bash
@xagi/create-ai-project create @xagi/ai-template-vue-app \
  --name dashboard \
  --path ./dashboard \
  --config '{
    "typescript": true,
    "router": true,
    "pinia": true,
    "eslint": true,
    "prettier": true
  }'
```

### Custom Server

```bash
@xagi/create-ai-project create @xagi/ai-template-custom-server \
  --name my-custom-server \
  --path ./my-custom-server \
  --config '{
    "typescript": true,
    "framework": "express",
    "database": "postgresql",
    "testing": "jest",
    "docker": true
  }'
```

## Configuration Management

### CLI Configuration

Create a configuration file at `~/.xagi/create-ai-project/config.json`:

```json
{
  "defaultRegistry": "https://registry.npmjs.org",
  "cacheDir": "~/.xagi/create-ai-project/cache",
  "maxCacheSize": "1GB",
  "cacheTTL": "7d",
  "preferOffline": false,
  "defaults": {
    "typescript": true,
    "eslint": true
  }
}
```

### Environment Variables

```bash
export XAGI_REGISTRY_URL="https://registry.npmjs.org"
export XAGI_AUTH_TOKEN="your-auth-token"
export XAGI_CACHE_DIR="~/.xagi/cache"
export XAGI_LOG_LEVEL="info"
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   # Check directory permissions
   ls -la /path/to/project

   # Fix permissions
   chmod 755 /path/to/project
   ```

2. **Network Issues**
   ```bash
   # Check npm registry connectivity
   npm ping

   # Configure proxy if needed
   npm config set proxy http://proxy.company.com:8080
   ```

3. **Cache Issues**
   ```bash
   # Clear cache
   @xagi/create-ai-project cache clear

   # Reset npm cache
   npm cache clean --force
   ```

4. **Template Not Found**
   ```bash
   # Search for available templates
   @xagi/create-ai-project list --search react

   # Check template details
   @xagi/create-ai-project info @xagi/ai-template-react-next-app
   ```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
@xagi/create-ai-project --debug create my-app
```

### Log Files

Log files are stored at:
- Linux/macOS: `~/.xagi/create-ai-project/logs/`
- Windows: `%USERPROFILE%\.xagi\create-ai-project\logs\`

## Next Steps

After creating your project:

1. **Navigate to project directory**:
   ```bash
   cd ./my-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development**:
   ```bash
   npm run dev
   ```

4. **Review generated files**:
   - `README.md`: Project documentation
   - `package.json`: Dependencies and scripts
   - Configuration files specific to template type

## Getting Help

- **CLI Help**: `@xagi/create-ai-project --help`
- **Template Help**: `@xagi/create-ai-project info <template>`
- **Documentation**: Visit the project documentation site
- **Issues**: Report bugs on GitHub issues

## Tips for Best Results

1. **Use interactive mode** for first-time usage to explore all options
2. **Save common configurations** as JSON files for reuse
3. **Leverage template caching** for faster subsequent project creation
4. **Validate configuration** before creating large projects
5. **Use dry-run mode** to preview changes without creating files
6. **Keep templates updated** by regularly checking for new versions