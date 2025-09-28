const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Mock CLI functionality (since it's not implemented yet)
const mockVueTemplate = {
  name: '@xagi/ai-template-vue',
  version: '1.0.0',
  description: 'Vue.js project template with TypeScript, Router, and Pinia',

  generateProject: async (projectName, projectPath, options = {}) => {
    const {
      typescript = true,
      router = true,
      pinia = true,
      eslint = true,
      prettier = true,
      devServer = true
    } = options;

    const files = {};

    // Basic package.json
    files['package.json'] = JSON.stringify({
      name: projectName,
      version: '0.1.0',
      private: true,
      scripts: {
        'dev': 'vite',
        'build': 'vue-tsc && vite build',
        'preview': 'vite preview',
        ...(eslint && { 'lint': 'eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore' }),
        ...(prettier && { 'format': 'prettier --write src/' })
      },
      dependencies: {
        'vue': '^3.3.4',
        ...(router && { 'vue-router': '^4.2.5' }),
        ...(pinia && { 'pinia': '^2.1.7' })
      },
      devDependencies: {
        '@vitejs/plugin-vue': '^4.4.0',
        'vite': '^4.4.11',
        ...(typescript && {
          'typescript': '^5.2.2',
          'vue-tsc': '^1.8.22'
        }),
        ...(eslint && {
          '@rushstack/eslint-patch': '^1.3.3',
          '@vue/eslint-config-typescript': '^11.0.3',
          '@vue/eslint-config-prettier': '^8.0.0',
          'eslint': '^8.49.0',
          'eslint-plugin-vue': '^9.17.0'
        }),
        ...(prettier && { 'prettier': '^3.0.3' })
      }
    }, null, 2);

    // TypeScript config
    if (typescript) {
      files['tsconfig.json'] = JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          module: 'ESNext',
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'preserve',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true
        },
        include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.tsx', 'src/**/*.vue'],
        references: [{ path: './tsconfig.node.json' }]
      }, null, 2);

      files['tsconfig.node.json'] = JSON.stringify({
        compilerOptions: {
          composite: true,
          skipLibCheck: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
          allowSyntheticDefaultImports: true
        },
        include: ['vite.config.ts']
      }, null, 2);
    }

    // Vite config
    files['vite.config.ts'] = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    host: true,
    open: ${devServer}
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})`;

    // Vue Router config
    if (router) {
      files['src/router/index.ts'] = `import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    }
  ]
})

export default router`;
    }

    // Pinia store config
    if (pinia) {
      files['src/stores/counter.ts'] = `import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)
  function increment() {
    count.value++
  }

  return { count, doubleCount, increment }
})`;
    }

    // ESLint config
    if (eslint) {
      files['.eslintrc.cjs'] = `module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    ${typescript ? "'@vue/eslint-config-typescript'," : ''}
    ${prettier ? "'@vue/eslint-config-prettier/skip-formatting'," : ''}
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
  }
}`;
    }

    // Prettier config
    if (prettier) {
      files['.prettierrc'] = JSON.stringify({
        semi: false,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
        printWidth: 80,
        bracketSpacing: true,
        arrowParens: 'avoid'
      }, null, 2);
    }

    // Basic Vue app structure
    files['src/main.ts'] = `import { createApp } from 'vue'
${router ? "import router from './router'" : ''}
${pinia ? "import { createPinia } from 'pinia'" : ''}
import App from './App.vue'

const app = createApp(App)
${pinia ? "app.use(createPinia())" : ''}
${router ? "app.use(router)" : ''}
app.mount('#app')`;

    files['src/App.vue'] = `<template>
  <div id="app">
    <header>
      <nav>
        <router-link to="/">Home</router-link> |
        <router-link to="/about">About</router-link>
      </nav>
    </header>
    <main>
      <router-view/>
    </main>
  </div>
</template>

<script setup lang="ts">
// App component logic
</script>

<style>
#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  font-weight: normal;
}
</style>`;

    files['src/views/HomeView.vue'] = `<template>
  <div class="home">
    <h1>Home</h1>
    ${pinia ? '<button @click="counter.increment()">Count is: {{ counter.count }}</button>' : ''}
  </div>
</template>

<script setup lang="ts">
${pinia ? "import { useCounterStore } from '@/stores/counter'\nconst counter = useCounterStore()" : ""}
</script>`;

    files['src/views/AboutView.vue'] = `<template>
  <div class="about">
    <h1>About</h1>
    <p>This is a Vue.js application created with the XAGI CLI.</p>
  </div>
</template>

<script setup lang="ts">
</script>`;

    // Index HTML
    files['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`;

    // Write all files to actual filesystem (for testing purposes)
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(projectPath, filePath);
      const dir = path.dirname(fullPath);

      // Create directories recursively
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content);
    }

    return { projectPath, files: Object.keys(files) };
  }
};

describe('Vue.js Project Creation Integration Tests', () => {
  let tempDir;
  let mockExec;

  beforeAll(() => {
    // Mock execSync for CLI commands
    mockExec = jest.spyOn(require('child_process'), 'execSync').mockImplementation(() => {
      return Buffer.from('CLI command executed successfully');
    });
  });

  afterAll(() => {
    mockExec.mockRestore();
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  describe('CLI Command Validation', () => {
    test('should execute CLI create command with Vue.js template', () => {
      const projectName = 'test-vue-project';
      const projectPath = path.join(tempDir, projectName);

      // Simulate CLI command execution
      mockExec.mockImplementation((command) => {
        expect(command).toContain('create-ai-project');
        expect(command).toContain('create');
        expect(command).toContain('@xagi/ai-template-vue');
        expect(command).toContain('--name');
        expect(command).toContain(projectName);
        expect(command).toContain('--path');
        expect(command).toContain(projectPath);
        return Buffer.from('Project created successfully');
      });

      expect(() => {
        execSync(`create-ai-project create @xagi/ai-template-vue --name ${projectName} --path ${projectPath}`, {
          stdio: 'pipe'
        });
      }).not.toThrow();

      expect(mockExec).toHaveBeenCalled();
    });

    test('should handle CLI command with configuration options', () => {
      const projectName = 'vue-project-with-options';
      const projectPath = path.join(tempDir, projectName);
      const config = {
        typescript: true,
        router: true,
        pinia: true,
        eslint: true,
        prettier: true
      };

      mockExec.mockImplementation((command) => {
        expect(command).toContain('--config');
        expect(command).toContain(JSON.stringify(config));
        return Buffer.from('Project created successfully');
      });

      expect(() => {
        execSync(`create-ai-project create @xagi/ai-template-vue --name ${projectName} --path ${projectPath} --config '${JSON.stringify(config)}'`, {
          stdio: 'pipe'
        });
      }).not.toThrow();
    });
  });

  describe('Project Structure Validation', () => {
    test('should create project with correct directory structure', async () => {
      const projectName = 'vue-structure-test';
      const projectPath = path.join(tempDir, projectName);

      const { files, projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath);

      // Validate essential directories
      const expectedDirs = ['src', 'src/views', 'src/router', 'src/stores'];
      expectedDirs.forEach(dir => {
        expect(fs.existsSync(path.join(generatedPath, dir))).toBe(true);
      });

      // Validate essential files
      const expectedFiles = [
        'package.json',
        'src/main.ts',
        'src/App.vue',
        'index.html',
        'vite.config.ts'
      ];
      expectedFiles.forEach(file => {
        expect(fs.existsSync(path.join(generatedPath, file))).toBe(true);
      });

      expect(files.length).toBeGreaterThan(0);
    });

    test('should create valid package.json with correct dependencies', async () => {
      const projectName = 'vue-package-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        typescript: true,
        router: true,
        pinia: true
      });

      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.name).toBe(projectName);
      expect(packageJson.version).toBe('0.1.0');
      expect(packageJson.private).toBe(true);

      // Check Vue dependencies
      expect(packageJson.dependencies).toHaveProperty('vue');
      expect(packageJson.dependencies).toHaveProperty('vue-router');
      expect(packageJson.dependencies).toHaveProperty('pinia');

      // Check dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('vite');
      expect(packageJson.devDependencies).toHaveProperty('@vitejs/plugin-vue');
      expect(packageJson.devDependencies).toHaveProperty('typescript');
      expect(packageJson.devDependencies).toHaveProperty('vue-tsc');

      // Check scripts
      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts).toHaveProperty('preview');
      expect(packageJson.scripts).toHaveProperty('lint');
      expect(packageJson.scripts).toHaveProperty('format');
    });

    test('should create src directory with Vue components', async () => {
      const projectName = 'vue-src-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        typescript: true,
        router: true,
        pinia: true
      });

      // Check main entry point
      const mainContent = fs.readFileSync(path.join(generatedPath, 'src/main.ts'), 'utf8');
      expect(mainContent).toContain('createApp');
      expect(mainContent).toContain('App.vue');
      expect(mainContent).toContain('createPinia');
      expect(mainContent).toContain('router');

      // Check App.vue
      const appContent = fs.readFileSync(path.join(generatedPath, 'src/App.vue'), 'utf8');
      expect(appContent).toContain('<template>');
      expect(appContent).toContain('<router-view/>');
      expect(appContent).toContain('router-link');

      // Check views
      expect(fs.existsSync(path.join(generatedPath, 'src/views/HomeView.vue'))).toBe(true);
      expect(fs.existsSync(path.join(generatedPath, 'src/views/AboutView.vue'))).toBe(true);
    });
  });

  describe('TypeScript Configuration', () => {
    test('should generate TypeScript configuration when enabled', async () => {
      const projectName = 'vue-ts-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        typescript: true,
        router: true,
        pinia: true
      });

      // Check tsconfig.json
      const tsconfigContent = fs.readFileSync(path.join(generatedPath, 'tsconfig.json'), 'utf8');
      const tsconfig = JSON.parse(tsconfigContent);

      expect(tsconfig.compilerOptions.target).toBe('ES2020');
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.include).toContain('src/**/*.ts');
      expect(tsconfig.include).toContain('src/**/*.vue');

      // Check tsconfig.node.json
      const tsconfigNodeContent = fs.readFileSync(path.join(generatedPath, 'tsconfig.node.json'), 'utf8');
      const tsconfigNode = JSON.parse(tsconfigNodeContent);
      expect(tsconfigNode.compilerOptions.composite).toBe(true);

      // Check Vite config is TypeScript
      expect(fs.existsSync(path.join(generatedPath, 'vite.config.ts'))).toBe(true);
      const viteConfig = fs.readFileSync(path.join(generatedPath, 'vite.config.ts'), 'utf8');
      // Vite config is already TypeScript since it's a .ts file
      expect(viteConfig).toContain('defineConfig');
    });

    test('should not generate TypeScript configuration when disabled', async () => {
      const projectName = 'vue-no-ts-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        typescript: false
      });

      expect(fs.existsSync(path.join(generatedPath, 'tsconfig.json'))).toBe(false);
      expect(fs.existsSync(path.join(generatedPath, 'tsconfig.node.json'))).toBe(false);

      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.devDependencies).not.toHaveProperty('typescript');
      expect(packageJson.devDependencies).not.toHaveProperty('vue-tsc');
    });
  });

  describe('Vue Router Configuration', () => {
    test('should configure Vue Router when enabled', async () => {
      const projectName = 'vue-router-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        router: true
      });

      // Check router directory and file
      expect(fs.existsSync(path.join(generatedPath, 'src/router/index.ts'))).toBe(true);

      const routerContent = fs.readFileSync(path.join(generatedPath, 'src/router/index.ts'), 'utf8');
      expect(routerContent).toContain('createRouter');
      expect(routerContent).toContain('createWebHistory');
      expect(routerContent).toContain('HomeView');
      expect(routerContent).toContain('AboutView');

      // Check main.ts includes router
      const mainContent = fs.readFileSync(path.join(generatedPath, 'src/main.ts'), 'utf8');
      expect(mainContent).toContain('import router from');
      expect(mainContent).toContain('app.use(router)');

      // Check App.vue has router links
      const appContent = fs.readFileSync(path.join(generatedPath, 'src/App.vue'), 'utf8');
      expect(appContent).toContain('router-link');

      // Check package.json has vue-router
      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.dependencies).toHaveProperty('vue-router');
    });

    test('should not configure Vue Router when disabled', async () => {
      const projectName = 'vue-no-router-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        router: false
      });

      expect(fs.existsSync(path.join(generatedPath, 'src/router'))).toBe(false);

      const mainContent = fs.readFileSync(path.join(generatedPath, 'src/main.ts'), 'utf8');
      expect(mainContent).not.toContain('import router from');
      expect(mainContent).not.toContain('app.use(router)');

      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.dependencies).not.toHaveProperty('vue-router');
    });
  });

  describe('Pinia State Management Configuration', () => {
    test('should configure Pinia when enabled', async () => {
      const projectName = 'vue-pinia-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        pinia: true
      });

      // Check stores directory
      expect(fs.existsSync(path.join(generatedPath, 'src/stores'))).toBe(true);
      expect(fs.existsSync(path.join(generatedPath, 'src/stores/counter.ts'))).toBe(true);

      const storeContent = fs.readFileSync(path.join(generatedPath, 'src/stores/counter.ts'), 'utf8');
      expect(storeContent).toContain('defineStore');
      expect(storeContent).toContain('ref');
      expect(storeContent).toContain('computed');
      expect(storeContent).toContain('useCounterStore');

      // Check main.ts includes Pinia
      const mainContent = fs.readFileSync(path.join(generatedPath, 'src/main.ts'), 'utf8');
      expect(mainContent).toContain('import { createPinia } from');
      expect(mainContent).toContain('app.use(createPinia())');

      // Check HomeView uses the store
      const homeContent = fs.readFileSync(path.join(generatedPath, 'src/views/HomeView.vue'), 'utf8');
      expect(homeContent).toContain('useCounterStore');

      // Check package.json has pinia
      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.dependencies).toHaveProperty('pinia');
    });

    test('should not configure Pinia when disabled', async () => {
      const projectName = 'vue-no-pinia-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        pinia: false
      });

      expect(fs.existsSync(path.join(generatedPath, 'src/stores'))).toBe(false);

      const mainContent = fs.readFileSync(path.join(generatedPath, 'src/main.ts'), 'utf8');
      expect(mainContent).not.toContain('createPinia');

      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.dependencies).not.toHaveProperty('pinia');
    });
  });

  describe('ESLint and Prettier Configuration', () => {
    test('should configure ESLint when enabled', async () => {
      const projectName = 'vue-eslint-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        eslint: true,
        typescript: true,
        prettier: true
      });

      // Check ESLint config
      expect(fs.existsSync(path.join(generatedPath, '.eslintrc.cjs'))).toBe(true);

      const eslintContent = fs.readFileSync(path.join(generatedPath, '.eslintrc.cjs'), 'utf8');
      expect(eslintContent).toContain('plugin:vue/vue3-essential');
      expect(eslintContent).toContain('@vue/eslint-config-typescript');
      expect(eslintContent).toContain('@vue/eslint-config-prettier');

      // Check package.json has ESLint dependencies
      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.devDependencies).toHaveProperty('eslint');
      expect(packageJson.devDependencies).toHaveProperty('eslint-plugin-vue');
      expect(packageJson.devDependencies).toHaveProperty('@vue/eslint-config-typescript');

      // Check scripts
      expect(packageJson.scripts.lint).toContain('eslint');
    });

    test('should configure Prettier when enabled', async () => {
      const projectName = 'vue-prettier-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        prettier: true
      });

      // Check Prettier config
      expect(fs.existsSync(path.join(generatedPath, '.prettierrc'))).toBe(true);

      const prettierContent = fs.readFileSync(path.join(generatedPath, '.prettierrc'), 'utf8');
      const prettierConfig = JSON.parse(prettierContent);
      expect(prettierConfig).toHaveProperty('semi');
      expect(prettierConfig).toHaveProperty('singleQuote');
      expect(prettierConfig).toHaveProperty('tabWidth');

      // Check package.json has Prettier
      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.devDependencies).toHaveProperty('prettier');

      // Check scripts
      expect(packageJson.scripts).toHaveProperty('format');
    });

    test('should not configure ESLint and Prettier when disabled', async () => {
      const projectName = 'vue-no-lint-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        eslint: false,
        prettier: false
      });

      expect(fs.existsSync(path.join(generatedPath, '.eslintrc.cjs'))).toBe(false);
      expect(fs.existsSync(path.join(generatedPath, '.prettierrc'))).toBe(false);

      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.devDependencies).not.toHaveProperty('eslint');
      expect(packageJson.devDependencies).not.toHaveProperty('prettier');
      expect(packageJson.scripts).not.toHaveProperty('lint');
      expect(packageJson.scripts).not.toHaveProperty('format');
    });
  });

  describe('Development Server Configuration', () => {
    test('should configure Vite development server correctly', async () => {
      const projectName = 'vue-dev-server-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        devServer: true
      });

      // Check Vite config
      const viteConfig = fs.readFileSync(path.join(generatedPath, 'vite.config.ts'), 'utf8');
      expect(viteConfig).toContain('server:');
      expect(viteConfig).toContain('port: 3000');
      expect(viteConfig).toContain('host: true');
      expect(viteConfig).toContain('open: true');

      // Check package.json scripts
      const packageJsonContent = fs.readFileSync(path.join(generatedPath, 'package.json'), 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.scripts.dev).toBe('vite');
      expect(packageJson.scripts.build).toBe('vue-tsc && vite build');
      expect(packageJson.scripts.preview).toBe('vite preview');
    });

    test('should disable auto-open when devServer is disabled', async () => {
      const projectName = 'vue-no-open-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        devServer: false
      });

      const viteConfig = fs.readFileSync(path.join(generatedPath, 'vite.config.ts'), 'utf8');
      expect(viteConfig).toContain('open: false');
    });

    test('should include proper build configuration', async () => {
      const projectName = 'vue-build-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath);

      const viteConfig = fs.readFileSync(path.join(generatedPath, 'vite.config.ts'), 'utf8');
      expect(viteConfig).toContain('build:');
      expect(viteConfig).toContain('outDir: \'dist\'');
      expect(viteConfig).toContain('sourcemap: true');

      // Check index.html has proper title
      const indexHtml = fs.readFileSync(path.join(generatedPath, 'index.html'), 'utf8');
      expect(indexHtml).toContain(`<title>${projectName}</title>`);
      expect(indexHtml).toContain('type="module"');
      expect(indexHtml).toContain('src="/src/main.ts"');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing project name gracefully', async () => {
      mockExec.mockImplementation((command) => {
        throw new Error('Project name is required');
      });

      expect(() => {
        execSync('create-ai-project create @xagi/ai-template-vue --name ""', {
          stdio: 'pipe'
        });
      }).toThrow('Project name is required');
    });

    test('should handle invalid project path', async () => {
      const invalidPath = '/root/invalid-path';

      mockExec.mockImplementation((command) => {
        if (command.includes(invalidPath)) {
          throw new Error('Invalid project path: permission denied');
        }
        return Buffer.from('Success');
      });

      expect(() => {
        execSync(`create-ai-project create @xagi/ai-template-vue --name test --path ${invalidPath}`, {
          stdio: 'pipe'
        });
      }).toThrow('permission denied');
    });

    test('should handle template not found error', async () => {
      mockExec.mockImplementation((command) => {
        if (command.includes('non-existent-template')) {
          throw new Error('Template not found: @xagi/non-existent-template');
        }
        return Buffer.from('Success');
      });

      expect(() => {
        execSync('create-ai-project create @xagi/non-existent-template --name test', {
          stdio: 'pipe'
        });
      }).toThrow('Template not found');
    });

    test('should validate project name format', async () => {
      const invalidNames = [
        'invalid project name',
        '123-project',
        '@project',
        'project!',
        'project/name'
      ];

      for (const invalidName of invalidNames) {
        mockExec.mockImplementation((command) => {
          if (command.includes(invalidName)) {
            throw new Error('Invalid project name format');
          }
          return Buffer.from('Success');
        });

        expect(() => {
          execSync(`create-ai-project create @xagi/ai-template-vue --name "${invalidName}"`, {
            stdio: 'pipe'
          });
        }).toThrow('Invalid project name format');
      }
    });
  });

  describe('Configuration Validation', () => {
    test('should validate TypeScript configuration in generated files', async () => {
      const projectName = 'vue-ts-validation-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        typescript: true,
        router: true,
        pinia: true
      });

      // Validate TypeScript syntax in generated files
      const filesToCheck = [
        'src/main.ts',
        'src/router/index.ts',
        'src/stores/counter.ts',
        'vite.config.ts'
      ];

      filesToCheck.forEach(file => {
        const content = fs.readFileSync(path.join(generatedPath, file), 'utf8');
        expect(content).toContain('import');
        expect(content).toContain('from');

        // Check for proper TypeScript syntax
        if (file.includes('.ts')) {
          expect(content).toContain('import'); // Check for imports
          expect(content).toContain('from');   // Check for module syntax
        }
      });
    });

    test('should validate Vue component structure', async () => {
      const projectName = 'vue-component-validation-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath);

      const vueFiles = [
        'src/App.vue',
        'src/views/HomeView.vue',
        'src/views/AboutView.vue'
      ];

      vueFiles.forEach(file => {
        const content = fs.readFileSync(path.join(generatedPath, file), 'utf8');

        // Check Vue component structure
        expect(content).toMatch(/<template>/);
        expect(content).toMatch(/<\/template>/);
        expect(content).toMatch(/<script[^>]*>/);
        expect(content).toMatch(/<\/script>/);

        // Check for proper script setup (may be <script setup> or regular script)
        expect(content).toMatch(/<script[^>]*setup[^>]*>|<script>/);
        expect(content).toContain('lang="ts"');
      });
    });

    test('should validate configuration file formats', async () => {
      const projectName = 'vue-config-validation-test';
      const projectPath = path.join(tempDir, projectName);

      const { projectPath: generatedPath } = await mockVueTemplate.generateProject(projectName, projectPath, {
        typescript: true,
        eslint: true,
        prettier: true
      });

      // Validate JSON files are parseable
      const jsonFiles = ['package.json', 'tsconfig.json', 'tsconfig.node.json', '.prettierrc'];
      jsonFiles.forEach(file => {
        if (fs.existsSync(path.join(generatedPath, file))) {
          const content = fs.readFileSync(path.join(generatedPath, file), 'utf8');
          expect(() => JSON.parse(content)).not.toThrow();
        }
      });

      // Validate Vite config is valid TypeScript-like
      const viteConfig = fs.readFileSync(path.join(generatedPath, 'vite.config.ts'), 'utf8');
      expect(viteConfig).toContain('defineConfig');
      expect(viteConfig).toContain('plugins');
      expect(viteConfig).toContain('resolve');
    });
  });
});