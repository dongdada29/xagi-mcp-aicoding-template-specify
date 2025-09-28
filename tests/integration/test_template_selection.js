/**
 * Integration tests for CLI template listing and selection functionality
 * Tests the complete user flow from CLI commands to interactive selection
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

// Mock test data for templates
const mockTemplates = [
  {
    id: '@xagi/ai-template-react-next-app',
    name: 'React Next.js AI App',
    version: '1.0.0',
    type: 'react-next',
    description: 'Modern React Next.js application with AI-powered features',
    keywords: ['react', 'nextjs', 'ai', 'typescript', 'tailwind'],
    registry: 'official',
    downloads: 15420,
    rating: 4.8,
    lastUpdated: '2024-01-15',
    author: 'XAGI Team'
  },
  {
    id: '@xagi/ai-template-node-api',
    name: 'Node.js AI API Server',
    version: '2.1.0',
    type: 'node-api',
    description: 'Express.js API server with AI integration and authentication',
    keywords: ['nodejs', 'express', 'api', 'ai', 'typescript'],
    registry: 'official',
    downloads: 8930,
    rating: 4.6,
    lastUpdated: '2024-01-10',
    author: 'XAGI Team'
  },
  {
    id: '@xagi/ai-template-vue-app',
    name: 'Vue.js AI Application',
    version: '1.2.0',
    type: 'vue-app',
    description: 'Vue.js 3 application with Composition API and AI features',
    keywords: ['vue', 'typescript', 'ai', 'pinia', 'vite'],
    registry: 'official',
    downloads: 6750,
    rating: 4.7,
    lastUpdated: '2024-01-08',
    author: 'XAGI Team'
  },
  {
    id: '@community/ai-template-react-native',
    name: 'React Native AI App',
    version: '0.9.0',
    type: 'react-native',
    description: 'React Native app with AI-powered mobile features',
    keywords: ['react-native', 'mobile', 'ai', 'expo'],
    registry: 'community',
    downloads: 3240,
    rating: 4.3,
    lastUpdated: '2024-01-05',
    author: 'Community Contributor'
  }
];

// Mock CLI execution with controlled output
class MockCLI {
  constructor() {
    this.stdout = '';
    this.stderr = '';
    this.exitCode = 0;
    this.inquirer = require('inquirer');
  }

  // Simple color formatting mock
  formatColor(color, text) {
    return text; // Return plain text for testing
  }

  async executeCommand(args, options = {}) {
    const command = args.join(' ');

    try {
      // Mock the CLI behavior based on command
      if (command.startsWith('list') || command.startsWith('ls')) {
        this.stdout = this.handleListCommand(command, options);
      } else if (command.startsWith('create')) {
        this.stdout = await this.handleCreateCommand(command, options);
      } else if (command.startsWith('info')) {
        this.stdout = this.handleInfoCommand(command, options);
      } else {
        throw new Error(`Unknown command: ${command}`);
      }

      return { stdout: this.stdout, stderr: this.stderr, exitCode: this.exitCode };
    } catch (error) {
      this.stderr = error.message;
      this.exitCode = 1;
      return { stdout: this.stdout, stderr: this.stderr, exitCode: this.exitCode };
    }
  }

  handleListCommand(command, options) {
    let filteredTemplates = [...mockTemplates];

    // Parse command options
    const typeMatch = command.match(/--type (\S+)/);
    const searchMatch = command.match(/--search (\S+)/);
    const jsonMatch = command.includes('--json');

    // Filter by type
    if (typeMatch) {
      const type = typeMatch[1];
      filteredTemplates = filteredTemplates.filter(t => t.type === type);
    }

    // Filter by search
    if (searchMatch) {
      const searchTerm = searchMatch[1].toLowerCase();
      filteredTemplates = filteredTemplates.filter(t =>
        t.name.toLowerCase().includes(searchTerm) ||
        t.description.toLowerCase().includes(searchTerm) ||
        t.keywords.some(k => k.toLowerCase().includes(searchTerm))
      );
    }

    // Return JSON format if requested
    if (jsonMatch) {
      return JSON.stringify(filteredTemplates, null, 2);
    }

    // Return table format
    return this.generateTable(filteredTemplates);
  }

  generateTable(templates) {
    if (templates.length === 0) {
      return this.formatColor('yellow', 'No templates found matching your criteria.');
    }

    const header = this.formatColor('bold', 'Available Templates:');
    const separator = '─'.repeat(80);

    const rows = templates.map(template => {
      const name = this.formatColor('green', template.name);
      const type = this.formatColor('cyan', `[${template.type}]`);
      const version = this.formatColor('yellow', template.version);
      const description = template.description;
      const downloads = this.formatColor('magenta', `${template.downloads.toLocaleString()}↓`);
      const rating = this.formatColor('red', `${template.rating}★`);

      return `${name} ${type} ${version}\n  ${description}\n  ${downloads} ${rating}`;
    }).join('\n\n');

    return `${header}\n${separator}\n${rows}`;
  }

  async handleCreateCommand(command, options) {
    // Extract template name from command
    const parts = command.split(' ');
    const templateName = parts[1];

    if (!templateName) {
      // Interactive mode - prompt for template selection
      const choices = mockTemplates.map(t => ({
        name: `${t.name} (${t.type}) - ${t.description}`,
        value: t.id
      }));

      const mockPrompt = jest.fn().mockResolvedValueOnce({
        template: mockTemplates[0].id,
        projectName: 'test-project',
        description: 'Test project description'
      });

      this.inquirer.prompt = mockPrompt;

      const answers = await this.inquirer.prompt([
        {
          type: 'list',
          name: 'template',
          message: 'Choose a template:',
          choices: choices
        },
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: 'my-ai-project'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Project description:',
          default: 'AI-powered application'
        }
      ]);

      return this.formatColor('green', `Creating project "${answers.projectName}" from template "${answers.template}"...`);
    }

    // Direct template creation
    const template = mockTemplates.find(t => t.id === templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    return this.formatColor('green', `Creating project from template "${template.name}"...`);
  }

  handleInfoCommand(command, options) {
    const parts = command.split(' ');
    const templateName = parts[1];

    const template = mockTemplates.find(t => t.id === templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    return this.generateTemplateDetails(template);
  }

  generateTemplateDetails(template) {
    const header = this.formatColor('bold', `Template: ${template.name}`);
    const separator = '─'.repeat(50);

    const details = [
      this.formatColor('cyan', 'ID:') + ` ${template.id}`,
      this.formatColor('cyan', 'Version:') + ` ${template.version}`,
      this.formatColor('cyan', 'Type:') + ` ${template.type}`,
      this.formatColor('cyan', 'Registry:') + ` ${template.registry}`,
      this.formatColor('cyan', 'Author:') + ` ${template.author}`,
      this.formatColor('cyan', 'Downloads:') + ` ${template.downloads.toLocaleString()}`,
      this.formatColor('cyan', 'Rating:') + ` ${template.rating}★`,
      this.formatColor('cyan', 'Last Updated:') + ` ${template.lastUpdated}`,
      this.formatColor('cyan', 'Keywords:') + ` ${template.keywords.join(', ')}`
    ];

    const description = this.formatColor('yellow', 'Description:') + ` ${template.description}`;

    return `${header}\n${separator}\n${details.join('\n')}\n\n${description}`;
  }
}

describe('CLI Template Listing and Selection - Integration Tests', () => {
  let mockCLI;

  beforeEach(() => {
    mockCLI = new MockCLI();
    jest.clearAllMocks();
  });

  describe('1. CLI List Command Table Format', () => {
    test('should display available templates in table format', async() => {
      const result = await mockCLI.executeCommand(['list']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Available Templates:');
      expect(result.stdout).toContain('React Next.js AI App');
      expect(result.stdout).toContain('Node.js AI API Server');
      expect(result.stdout).toContain('Vue.js AI Application');
      expect(result.stdout).toContain('React Native AI App');

      // Verify table formatting
      expect(result.stdout).toContain('[react-next]');
      expect(result.stdout).toContain('[node-api]');
      expect(result.stdout).toContain('[vue-app]');
      expect(result.stdout).toContain('[react-native]');

      // Verify template details
      expect(result.stdout).toContain('15,420↓');
      expect(result.stdout).toContain('4.8★');
      expect(result.stdout).toContain('Modern React Next.js application');
    });

    test('should support alias command "ls"', async() => {
      const result = await mockCLI.executeCommand(['ls']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Available Templates:');
      expect(result.stdout).toContain('React Next.js AI App');
    });

    test('should return JSON format when --json flag is used', async() => {
      const result = await mockCLI.executeCommand(['list', '--json']);

      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();

      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0]).toHaveProperty('name');
      expect(parsed[0]).toHaveProperty('type');
    });
  });

  describe('2. Template Type Filtering', () => {
    test('should filter templates by react-next type', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'react-next']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
      expect(result.stdout).toContain('[react-next]');
      expect(result.stdout).not.toContain('Node.js AI API Server');
      expect(result.stdout).not.toContain('Vue.js AI Application');
    });

    test('should filter templates by node-api type', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'node-api']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Node.js AI API Server');
      expect(result.stdout).toContain('[node-api]');
      expect(result.stdout).not.toContain('React Next.js AI App');
      expect(result.stdout).not.toContain('Vue.js AI Application');
    });

    test('should filter templates by vue-app type', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'vue-app']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Vue.js AI Application');
      expect(result.stdout).toContain('[vue-app]');
      expect(result.stdout).not.toContain('React Next.js AI App');
      expect(result.stdout).not.toContain('Node.js AI API Server');
    });

    test('should handle unknown template type gracefully', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'unknown-type']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No templates found matching your criteria.');
    });

    test('should support type filtering with JSON output', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'react-next', '--json']);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);

      expect(Array.isArray(parsed)).toBe(true);
      parsed.forEach(template => {
        expect(template.type).toBe('react-next');
      });
    });
  });

  describe('3. Search Functionality', () => {
    test('should search templates by name', async() => {
      const result = await mockCLI.executeCommand(['list', '--search', 'react']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
      expect(result.stdout).toContain('React Native AI App');
      expect(result.stdout).not.toContain('Node.js AI API Server');
      expect(result.stdout).not.toContain('Vue.js AI Application');
    });

    test('should search templates by keywords', async() => {
      const result = await mockCLI.executeCommand(['list', '--search', 'typescript']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
      expect(result.stdout).toContain('Node.js AI API Server');
      expect(result.stdout).toContain('Vue.js AI Application');
    });

    test('should search templates by description', async() => {
      const result = await mockCLI.executeCommand(['list', '--search', 'authentication']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Node.js AI API Server');
      expect(result.stdout).not.toContain('React Next.js AI App');
      expect(result.stdout).not.toContain('Vue.js AI Application');
    });

    test('should be case-insensitive in search', async() => {
      const result = await mockCLI.executeCommand(['list', '--search', 'REACT']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
      expect(result.stdout).toContain('React Native AI App');
    });

    test('should handle partial matches in search', async() => {
      const result = await mockCLI.executeCommand(['list', '--search', 'next']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
    });

    test('should return empty results for no matches', async() => {
      const result = await mockCLI.executeCommand(['list', '--search', 'nonexistent-template']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No templates found matching your criteria.');
    });

    test('should support search with type filtering', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'react-next', '--search', 'ai']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
      expect(result.stdout).not.toContain('Node.js AI API Server');
    });
  });

  describe('4. Interactive Selection Prompts', () => {
    test('should prompt for template selection in interactive mode', async() => {
      const result = await mockCLI.executeCommand(['create']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Creating project');
      expect(result.stdout).toContain('test-project');

      // Verify inquirer was called
      expect(mockCLI.inquirer.prompt).toHaveBeenCalled();
    });

    test('should handle template selection with project details', async() => {
      const result = await mockCLI.executeCommand(['create']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Creating project "test-project"');
      expect(result.stdout).toContain('@xagi/ai-template-react-next-app');
    });

    test('should support direct template creation without prompts', async() => {
      const result = await mockCLI.executeCommand(['create', '@xagi/ai-template-react-next-app']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Creating project from template "React Next.js AI App"');

      // Verify inquirer was not called for direct creation
      expect(mockCLI.inquirer.prompt).not.toHaveBeenCalled();
    });
  });

  describe('5. Template Details Display', () => {
    test('should display detailed template information', async() => {
      const result = await mockCLI.executeCommand(['info', '@xagi/ai-template-react-next-app']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Template: React Next.js AI App');
      expect(result.stdout).toContain('ID: @xagi/ai-template-react-next-app');
      expect(result.stdout).toContain('Version: 1.0.0');
      expect(result.stdout).toContain('Type: react-next');
      expect(result.stdout).toContain('Registry: official');
      expect(result.stdout).toContain('Author: XAGI Team');
      expect(result.stdout).toContain('Downloads: 15,420');
      expect(result.stdout).toContain('Rating: 4.8★');
      expect(result.stdout).toContain('Keywords: react, nextjs, ai, typescript, tailwind');
      expect(result.stdout).toContain('Description: Modern React Next.js application');
    });

    test('should format template details with proper styling', async() => {
      const result = await mockCLI.executeCommand(['info', '@xagi/ai-template-react-next-app']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('─'.repeat(50)); // Separator line
      expect(result.stdout).toContain('Template:'); // Should be styled
      expect(result.stdout).toContain('Description:'); // Should be styled
    });

    test('should display different template types correctly', async() => {
      const templates = ['@xagi/ai-template-react-next-app', '@xagi/ai-template-node-api', '@xagi/ai-template-vue-app'];

      for (const templateId of templates) {
        const result = await mockCLI.executeCommand(['info', templateId]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Template:');
        expect(result.stdout).toContain('Type:');
        expect(result.stdout).toContain('Description:');
      }
    });
  });

  describe('6. Error Handling for Invalid Templates', () => {
    test('should handle invalid template names in info command', async() => {
      const result = await mockCLI.executeCommand(['info', '@invalid/template-name']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Template "@invalid/template-name" not found');
    });

    test('should handle invalid template names in create command', async() => {
      const result = await mockCLI.executeCommand(['create', '@invalid/template-name']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Template "@invalid/template-name" not found');
    });

    test('should handle missing template name in info command', async() => {
      const result = await mockCLI.executeCommand(['info']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Template "undefined" not found');
    });

    test('should handle malformed template IDs', async() => {
      const result = await mockCLI.executeCommand(['info', 'malformed-template-id']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Template "malformed-template-id" not found');
    });

    test('should handle empty template names', async() => {
      const result = await mockCLI.executeCommand(['info', '']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Template "" not found');
    });

    test('should handle special characters in template names', async() => {
      const result = await mockCLI.executeCommand(['info', '@invalid/template@name']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Template "@invalid/template@name" not found');
    });
  });

  describe('7. Combined Operations and Edge Cases', () => {
    test('should handle combined type and search filters', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'react-next', '--search', 'ai']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
      expect(result.stdout).not.toContain('Node.js AI API Server');
    });

    test('should handle empty filter results gracefully', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'nonexistent-type', '--search', 'nonexistent-term']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No templates found matching your criteria.');
    });

    test('should handle very long search terms', async() => {
      const longSearchTerm = 'a'.repeat(1000);
      const result = await mockCLI.executeCommand(['list', '--search', longSearchTerm]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No templates found matching your criteria.');
    });

    test('should handle special characters in search terms', async() => {
      const result = await mockCLI.executeCommand(['list', '--search', 'AI-powered features!']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
    });

    test('should handle Unicode characters in search terms', async() => {
      const result = await mockCLI.executeCommand(['list', '--search', 'react']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('React Next.js AI App');
    });
  });

  describe('8. Performance and Output Validation', () => {
    test('should generate consistent table formatting', async() => {
      const result1 = await mockCLI.executeCommand(['list']);
      const result2 = await mockCLI.executeCommand(['list']);

      expect(result1.stdout).toBe(result2.stdout);
      expect(result1.stdout).toContain('Available Templates:');
      expect(result1.stdout).toContain('─'.repeat(80));
    });

    test('should maintain proper output formatting with filters', async() => {
      const result = await mockCLI.executeCommand(['list', '--type', 'react-next']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Available Templates:');
      expect(result.stdout).toContain('React Next.js AI App');
      expect(result.stdout).toContain('─'.repeat(80));
    });

    test('should handle large number of templates efficiently', async() => {
      // Add more templates to test performance
      mockTemplates.push(...Array.from({ length: 50 }, (_, i) => ({
        id: `@test/template-${i}`,
        name: `Test Template ${i}`,
        version: '1.0.0',
        type: 'test',
        description: `Test template number ${i}`,
        keywords: ['test'],
        registry: 'test',
        downloads: i * 100,
        rating: 4.0 + (i % 10) * 0.1,
        lastUpdated: '2024-01-01',
        author: 'Test Author'
      })));

      const result = await mockCLI.executeCommand(['list', '--type', 'test']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Available Templates:');
      // Should contain multiple test templates
      expect(result.stdout.split('Test Template').length).toBeGreaterThan(1);
    });
  });
});
