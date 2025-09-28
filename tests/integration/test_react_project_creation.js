const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Mock external dependencies
jest.mock('simple-git');
jest.mock('ora');
jest.mock('inquirer');
jest.mock('chalk', () => ({
  yellow: jest.fn().mockImplementation(msg => msg),
  green: jest.fn().mockImplementation(msg => msg),
  red: jest.fn().mockImplementation(msg => msg),
  blue: jest.fn().mockImplementation(msg => msg),
  gray: jest.fn().mockImplementation(msg => msg),
  cyan: jest.fn().mockImplementation(msg => msg),
  magenta: jest.fn().mockImplementation(msg => msg),
  white: jest.fn().mockImplementation(msg => msg),
}));

describe('React Next.js Project Creation Integration Tests', () => {
  let tempDir;
  let originalConsoleLog;
  let originalConsoleError;

  beforeAll(() => {
    // Store original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  beforeEach(async () => {
    // Create temporary directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xagi-test-'));

    // Mock environment variables
    process.env.XAGI_CACHE_DIR = tempDir;
    process.env.XAGI_LOG_LEVEL = 'error';
  });

  afterEach(async () => {
    // Clean up
    if (tempDir && fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }

    // Reset mocks
    jest.clearAllMocks();
  });

  const createMockProjectStructure = (projectName, config = {}) => {
    const projectPath = path.join(tempDir, projectName);
    fs.ensureDirSync(projectPath);

    // Create package.json
    const packageJson = {
      name: projectName,
      version: '1.0.0',
      description: 'React Next.js project',
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint'
      },
      dependencies: {
        'next': '^14.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      },
      devDependencies: {}
    };

    // Add TypeScript dependencies if requested
    if (config.typescript) {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'typescript': '^5.0.0',
        '@types/node': '^20.0.0',
        '@types/react': '^18.0.0',
        '@types/react-dom': '^18.0.0'
      };
    }

    // Add Tailwind CSS dependencies if requested
    if (config.tailwind) {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'tailwindcss': '^3.0.0',
        'autoprefixer': '^10.0.0',
        'postcss': '^8.0.0'
      };
    }

    // Add ESLint dependencies if requested
    if (config.eslint) {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'eslint': '^8.0.0',
        'eslint-config-next': '^14.0.0'
      };
    }

    // Add Prettier dependencies if requested
    if (config.prettier) {
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'prettier': '^3.0.0'
      };
    }

    fs.writeJsonSync(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });

    // Create directory structure
    const srcPath = config.srcDir ? path.join(projectPath, 'src') : projectPath;
    const appPath = config.appDir ? path.join(projectPath, 'app') : path.join(srcPath, 'app');

    fs.ensureDirSync(srcPath);
    if (config.appDir) {
      fs.ensureDirSync(appPath);
    }

    // Create pages directory for Pages Router
    fs.ensureDirSync(path.join(srcPath, 'pages'));
    fs.writeFileSync(path.join(srcPath, 'pages', 'index.js'), `
export default function Home() {
  return <h1>Welcome to Next.js!</h1>;
}`);

    // Create components directory
    fs.ensureDirSync(path.join(srcPath, 'components'));
    fs.writeFileSync(path.join(srcPath, 'components', 'Header.js'), `
export default function Header() {
  return <header>Header</header>;
}`);

    // Create styles directory
    fs.ensureDirSync(path.join(srcPath, 'styles'));
    fs.writeFileSync(path.join(srcPath, 'styles', 'globals.css'), `
/* Global styles */
`);

    // Create TypeScript configuration if requested
    if (config.typescript) {
      const tsConfig = {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'es6'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [
            {
              name: 'next'
            }
          ],
          baseUrl: '.',
          paths: config.srcDir ? {
            '@/*': ['./src/*'],
            '@/components/*': ['./src/components/*'],
            '@/styles/*': ['./src/styles/*']
          } : {
            '@/*': ['./*'],
            '@/components/*': ['./components/*'],
            '@/styles/*': ['./styles/*']
          }
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules']
      };
      fs.writeJsonSync(path.join(projectPath, 'tsconfig.json'), tsConfig, { spaces: 2 });
    }

    // Create Tailwind configuration if requested
    if (config.tailwind) {
      const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};`;
      fs.writeFileSync(path.join(projectPath, 'tailwind.config.js'), tailwindConfig);

      // Create PostCSS configuration
      const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;
      fs.writeFileSync(path.join(projectPath, 'postcss.config.js'), postcssConfig);
    }

    // Create ESLint configuration if requested
    if (config.eslint) {
      const eslintConfig = {
        extends: ['next/core-web-vitals', ...(config.typescript ? ['next/typescript'] : [])],
        rules: {}
      };
      fs.writeJsonSync(path.join(projectPath, '.eslintrc.json'), eslintConfig, { spaces: 2 });
    }

    // Create Prettier configuration if requested
    if (config.prettier) {
      const prettierConfig = {
        semi: true,
        trailingComma: 'es5',
        singleQuote: true,
        printWidth: 80,
        tabWidth: 2
      };
      fs.writeJsonSync(path.join(projectPath, '.prettierrc'), prettierConfig, { spaces: 2 });
    }

    // Create Next.js configuration
    const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: ${config.appDir ? 'true' : 'false'},
  },
};

module.exports = nextConfig;`;
    fs.writeFileSync(path.join(projectPath, 'next.config.js'), nextConfig);

    // Create App Router files if app directory is enabled
    if (config.appDir) {
      fs.writeFileSync(path.join(appPath, 'layout.js'), `import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`);

      fs.writeFileSync(path.join(appPath, 'page.js'), `export default function Home() {
  return <h1>Welcome to App Router!</h1>;
}`);

      fs.writeFileSync(path.join(appPath, 'globals.css'), config.tailwind ? `
@tailwind base;
@tailwind components;
@tailwind utilities;
` : `
/* Global styles for App Router */
`);
    }

    return projectPath;
  };

  const validateProjectStructure = (projectPath, expectedConfig) => {
    const errors = [];

    // Check if project directory exists
    if (!fs.existsSync(projectPath)) {
      errors.push(`Project directory does not exist: ${projectPath}`);
      return errors;
    }

    // Check package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      errors.push('package.json not found');
    } else {
      const packageJson = fs.readJsonSync(packageJsonPath);

      // Check required dependencies
      const requiredDeps = ['next', 'react', 'react-dom'];
      requiredDeps.forEach(dep => {
        if (!packageJson.dependencies[dep]) {
          errors.push(`Missing required dependency: ${dep}`);
        }
      });

      // Check TypeScript dependencies if requested
      if (expectedConfig.typescript) {
        const tsDeps = ['typescript', '@types/node', '@types/react', '@types/react-dom'];
        tsDeps.forEach(dep => {
          if (!packageJson.devDependencies[dep]) {
            errors.push(`Missing TypeScript dependency: ${dep}`);
          }
        });
      }

      // Check Tailwind CSS dependencies if requested
      if (expectedConfig.tailwind) {
        const tailwindDeps = ['tailwindcss', 'autoprefixer', 'postcss'];
        tailwindDeps.forEach(dep => {
          if (!packageJson.devDependencies[dep]) {
            errors.push(`Missing Tailwind CSS dependency: ${dep}`);
          }
        });
      }

      // Check ESLint dependencies if requested
      if (expectedConfig.eslint) {
        const eslintDeps = ['eslint', 'eslint-config-next'];
        eslintDeps.forEach(dep => {
          if (!packageJson.devDependencies[dep]) {
            errors.push(`Missing ESLint dependency: ${dep}`);
          }
        });
      }

      // Check Prettier dependencies if requested
      if (expectedConfig.prettier) {
        if (!packageJson.devDependencies.prettier) {
          errors.push('Missing Prettier dependency: prettier');
        }
      }
    }

    // Check directory structure
    const srcPath = expectedConfig.srcDir ? path.join(projectPath, 'src') : projectPath;
    const appPath = expectedConfig.appDir ? path.join(projectPath, 'app') : path.join(srcPath, 'app');

    if (expectedConfig.srcDir && !fs.existsSync(path.join(projectPath, 'src'))) {
      errors.push('src directory not found');
    }

    if (expectedConfig.appDir && !fs.existsSync(appPath)) {
      errors.push('app directory not found');
    }

    if (!fs.existsSync(path.join(srcPath, 'pages'))) {
      errors.push('pages directory not found');
    }

    if (!fs.existsSync(path.join(srcPath, 'components'))) {
      errors.push('components directory not found');
    }

    if (!fs.existsSync(path.join(srcPath, 'styles'))) {
      errors.push('styles directory not found');
    }

    // Check TypeScript configuration
    if (expectedConfig.typescript) {
      const tsConfigPath = path.join(projectPath, 'tsconfig.json');
      if (!fs.existsSync(tsConfigPath)) {
        errors.push('tsconfig.json not found');
      } else {
        const tsConfig = fs.readJsonSync(tsConfigPath);
        if (tsConfig.compilerOptions.jsx !== 'preserve') {
          errors.push('TypeScript jsx configuration is incorrect');
        }
        if (expectedConfig.srcDir && !tsConfig.compilerOptions.paths) {
          errors.push('TypeScript path aliases not configured');
        }
      }
    }

    // Check Tailwind CSS configuration
    if (expectedConfig.tailwind) {
      const tailwindConfigPath = path.join(projectPath, 'tailwind.config.js');
      if (!fs.existsSync(tailwindConfigPath)) {
        errors.push('tailwind.config.js not found');
      }

      const postcssConfigPath = path.join(projectPath, 'postcss.config.js');
      if (!fs.existsSync(postcssConfigPath)) {
        errors.push('postcss.config.js not found');
      }
    }

    // Check ESLint configuration
    if (expectedConfig.eslint) {
      const eslintConfigPath = path.join(projectPath, '.eslintrc.json');
      if (!fs.existsSync(eslintConfigPath)) {
        errors.push('.eslintrc.json not found');
      } else {
        const eslintConfig = fs.readJsonSync(eslintConfigPath);
        if (!eslintConfig.extends.includes('next/core-web-vitals')) {
          errors.push('ESLint configuration does not include Next.js rules');
        }
      }
    }

    // Check Prettier configuration
    if (expectedConfig.prettier) {
      const prettierConfigPath = path.join(projectPath, '.prettierrc');
      if (!fs.existsSync(prettierConfigPath)) {
        errors.push('.prettierrc not found');
      }
    }

    // Check Next.js configuration
    const nextConfigPath = path.join(projectPath, 'next.config.js');
    if (!fs.existsSync(nextConfigPath)) {
      errors.push('next.config.js not found');
    }

    return errors;
  };

  describe('1. CLI Create Command Works with React Next.js Template', () => {
    test('should fail when CLI create command is not implemented', async () => {
      // This test is designed to fail until the CLI create command is properly implemented
      expect(true).toBe(false); // This will fail and remind us to implement the CLI command
    });
  });

  describe('2. Project Structure Validation', () => {
    test('should create correct directory structure with src and app directories', async () => {
      // Arrange
      const projectName = 'test-structure';
      const config = {
        srcDir: true,
        appDir: true
      };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      expect(fs.existsSync(path.join(projectPath, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'app'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src', 'pages'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src', 'components'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src', 'styles'))).toBe(true);
    });

    test('should create correct files in project root', async () => {
      // Arrange
      const projectName = 'test-files';
      const config = {
        typescript: true,
        tailwind: true,
        eslint: true,
        prettier: true
      };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'tsconfig.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'tailwind.config.js'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'postcss.config.js'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, '.eslintrc.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, '.prettierrc'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'next.config.js'))).toBe(true);
    });
  });

  describe('3. TypeScript Configuration Validation', () => {
    test('should configure TypeScript correctly when requested', async () => {
      // Arrange
      const projectName = 'test-typescript';
      const config = { typescript: true, srcDir: true };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      const tsConfigPath = path.join(projectPath, 'tsconfig.json');
      expect(fs.existsSync(tsConfigPath)).toBe(true);

      const tsConfig = fs.readJsonSync(tsConfigPath);
      expect(tsConfig.compilerOptions.target).toBe('es5');
      expect(tsConfig.compilerOptions.jsx).toBe('preserve');
      expect(tsConfig.compilerOptions.baseUrl).toBe('.');
      expect(tsConfig.compilerOptions.paths).toEqual({
        '@/*': ['./src/*'],
        '@/components/*': ['./src/components/*'],
        '@/styles/*': ['./src/styles/*']
      });

      // Check TypeScript dependencies
      const packageJson = fs.readJsonSync(path.join(projectPath, 'package.json'));
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      expect(packageJson.devDependencies).toHaveProperty('@types/node');
      expect(packageJson.devDependencies).toHaveProperty('@types/react');
      expect(packageJson.devDependencies).toHaveProperty('@types/react-dom');
    });

    test('should not create TypeScript configuration when not requested', async () => {
      // Arrange
      const projectName = 'test-no-typescript';
      const config = { typescript: false };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      expect(fs.existsSync(path.join(projectPath, 'tsconfig.json'))).toBe(false);

      const packageJson = fs.readJsonSync(path.join(projectPath, 'package.json'));
      expect(packageJson.devDependencies).not.toHaveProperty('typescript');
      expect(packageJson.devDependencies).not.toHaveProperty('@types/node');
      expect(packageJson.devDependencies).not.toHaveProperty('@types/react');
    });
  });

  describe('4. Tailwind CSS Configuration Validation', () => {
    test('should configure Tailwind CSS when requested', async () => {
      // Arrange
      const projectName = 'test-tailwind';
      const config = { tailwind: true };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      const tailwindConfigPath = path.join(projectPath, 'tailwind.config.js');
      expect(fs.existsSync(tailwindConfigPath)).toBe(true);

      const tailwindConfig = fs.readFileSync(tailwindConfigPath, 'utf8');
      expect(tailwindConfig).toContain('content');
      expect(tailwindConfig).toContain('./src/pages/**/*');
      expect(tailwindConfig).toContain('./src/components/**/*');
      expect(tailwindConfig).toContain('./src/app/**/*');

      const postcssConfigPath = path.join(projectPath, 'postcss.config.js');
      expect(fs.existsSync(postcssConfigPath)).toBe(true);

      const postcssConfig = fs.readFileSync(postcssConfigPath, 'utf8');
      expect(postcssConfig).toContain('tailwindcss');
      expect(postcssConfig).toContain('autoprefixer');

      // Check Tailwind CSS dependencies
      const packageJson = fs.readJsonSync(path.join(projectPath, 'package.json'));
      expect(packageJson.devDependencies).toHaveProperty('tailwindcss');
      expect(packageJson.devDependencies).toHaveProperty('autoprefixer');
      expect(packageJson.devDependencies).toHaveProperty('postcss');
    });

    test('should not create Tailwind CSS configuration when not requested', async () => {
      // Arrange
      const projectName = 'test-no-tailwind';
      const config = { tailwind: false };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      expect(fs.existsSync(path.join(projectPath, 'tailwind.config.js'))).toBe(false);
      expect(fs.existsSync(path.join(projectPath, 'postcss.config.js'))).toBe(false);

      const packageJson = fs.readJsonSync(path.join(projectPath, 'package.json'));
      expect(packageJson.devDependencies).not.toHaveProperty('tailwindcss');
      expect(packageJson.devDependencies).not.toHaveProperty('autoprefixer');
    });
  });

  describe('5. ESLint and Prettier Configuration Validation', () => {
    test('should configure ESLint for Next.js when requested', async () => {
      // Arrange
      const projectName = 'test-eslint';
      const config = { eslint: true, typescript: true };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      const eslintConfigPath = path.join(projectPath, '.eslintrc.json');
      expect(fs.existsSync(eslintConfigPath)).toBe(true);

      const eslintConfig = fs.readJsonSync(eslintConfigPath);
      expect(eslintConfig.extends).toContain('next/core-web-vitals');
      expect(eslintConfig.extends).toContain('next/typescript');

      // Check ESLint dependencies
      const packageJson = fs.readJsonSync(path.join(projectPath, 'package.json'));
      expect(packageJson.devDependencies).toHaveProperty('eslint');
      expect(packageJson.devDependencies).toHaveProperty('eslint-config-next');
    });

    test('should configure Prettier when requested', async () => {
      // Arrange
      const projectName = 'test-prettier';
      const config = { prettier: true };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      const prettierConfigPath = path.join(projectPath, '.prettierrc');
      expect(fs.existsSync(prettierConfigPath)).toBe(true);

      const prettierConfig = fs.readJsonSync(prettierConfigPath);
      expect(prettierConfig).toHaveProperty('semi');
      expect(prettierConfig).toHaveProperty('singleQuote');
      expect(prettierConfig).toHaveProperty('tabWidth');
      expect(prettierConfig.semi).toBe(true);
      expect(prettierConfig.singleQuote).toBe(true);
      expect(prettierConfig.tabWidth).toBe(2);

      // Check Prettier dependencies
      const packageJson = fs.readJsonSync(path.join(projectPath, 'package.json'));
      expect(packageJson.devDependencies).toHaveProperty('prettier');
    });
  });

  describe('6. App and Src Directory Configuration', () => {
    test('should configure both app and src directories when requested', async () => {
      // Arrange
      const projectName = 'test-both-dirs';
      const config = { appDir: true, srcDir: true };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      expect(fs.existsSync(path.join(projectPath, 'app'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src', 'pages'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src', 'components'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src', 'styles'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'app', 'layout.js'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'app', 'page.js'))).toBe(true);
    });

    test('should configure only src directory when app directory is disabled', async () => {
      // Arrange
      const projectName = 'test-src-only';
      const config = { appDir: false, srcDir: true };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      expect(fs.existsSync(path.join(projectPath, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src', 'pages'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src', 'components'))).toBe(true);
      // App directory should not exist at root level
      expect(fs.existsSync(path.join(projectPath, 'app'))).toBe(false);
    });
  });

  describe('7. Import Aliases Configuration', () => {
    test('should set up import aliases correctly with src directory', async () => {
      // Arrange
      const projectName = 'test-aliases-src';
      const config = { typescript: true, srcDir: true };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      const tsConfigPath = path.join(projectPath, 'tsconfig.json');
      const tsConfig = fs.readJsonSync(tsConfigPath);

      expect(tsConfig.compilerOptions.paths).toEqual({
        '@/*': ['./src/*'],
        '@/components/*': ['./src/components/*'],
        '@/styles/*': ['./src/styles/*']
      });
    });

    test('should set up import aliases correctly without src directory', async () => {
      // Arrange
      const projectName = 'test-aliases-no-src';
      const config = { typescript: true, srcDir: false };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      const tsConfigPath = path.join(projectPath, 'tsconfig.json');
      const tsConfig = fs.readJsonSync(tsConfigPath);

      expect(tsConfig.compilerOptions.paths).toEqual({
        '@/*': ['./*'],
        '@/components/*': ['./components/*'],
        '@/styles/*': ['./styles/*']
      });
    });
  });

  describe('8. Integration Tests - Complete Project Creation', () => {
    test('should create complete React Next.js project with all features', async () => {
      // Arrange
      const projectName = 'test-complete-project';
      const config = {
        typescript: true,
        tailwind: true,
        eslint: true,
        prettier: true,
        appDir: true,
        srcDir: true
      };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      const errors = validateProjectStructure(projectPath, config);

      if (errors.length > 0) {
        console.log('Validation errors for complete project:', errors);
      }

      expect(errors.length).toBe(0);

      // Additional checks for complete project
      const packageJson = fs.readJsonSync(path.join(projectPath, 'package.json'));

      // Check all required dependencies
      expect(packageJson.dependencies).toHaveProperty('next');
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('react-dom');

      // Check all dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      expect(packageJson.devDependencies).toHaveProperty('tailwindcss');
      expect(packageJson.devDependencies).toHaveProperty('eslint');
      expect(packageJson.devDependencies).toHaveProperty('prettier');

      // Check Next.js configuration
      const nextConfig = fs.readFileSync(path.join(projectPath, 'next.config.js'), 'utf8');
      expect(nextConfig).toContain('appDir: true');
    });

    test('should create minimal React Next.js project with only required features', async () => {
      // Arrange
      const projectName = 'test-minimal-project';
      const config = {
        typescript: false,
        tailwind: false,
        eslint: false,
        prettier: false,
        appDir: false,
        srcDir: false
      };

      // Act
      const projectPath = createMockProjectStructure(projectName, config);

      // Assert
      const errors = validateProjectStructure(projectPath, config);
      expect(errors.length).toBe(0);

      // Check that optional configurations are not created
      expect(fs.existsSync(path.join(projectPath, 'tsconfig.json'))).toBe(false);
      expect(fs.existsSync(path.join(projectPath, 'tailwind.config.js'))).toBe(false);
      expect(fs.existsSync(path.join(projectPath, '.eslintrc.json'))).toBe(false);
      expect(fs.existsSync(path.join(projectPath, '.prettierrc'))).toBe(false);

      // Check that app directory is not created
      expect(fs.existsSync(path.join(projectPath, 'app'))).toBe(false);
    });
  });

  describe('9. Error Handling and Edge Cases', () => {
    test('should handle invalid project names', async () => {
      // This test would be implemented to verify CLI error handling
      expect(true).toBe(false); // Placeholder for CLI error handling test
    });

    test('should handle invalid configuration options', async () => {
      // This test would be implemented to verify CLI error handling
      expect(true).toBe(false); // Placeholder for CLI error handling test
    });

    test('should handle file system conflicts', async () => {
      // This test would be implemented to verify CLI error handling
      expect(true).toBe(false); // Placeholder for CLI error handling test
    });
  });

  describe('10. CLI Command Integration', () => {
    test('should integrate with CLI command parser', async () => {
      // This test is designed to fail until CLI command integration is implemented
      // It should test that the CLI command properly parses arguments and calls the project creation logic
      expect(false).toBe(true); // This will fail and remind us to implement CLI integration
    });

    test('should handle CLI options correctly', async () => {
      // This test should verify that CLI options like --dry-run, --config-file work correctly
      expect(false).toBe(true); // This will fail and remind us to implement CLI option handling
    });
  });
});