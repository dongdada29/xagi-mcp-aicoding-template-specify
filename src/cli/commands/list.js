const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const table = require('table');
const TemplateManager = require('../../core/template-manager');
const CacheManager = require('../../core/cache-manager');

const listCommand = program
  .createCommand('list')
  .alias('ls')
  .description('List available project templates')
  .option('-s, --search <term>', 'Search templates by name or keywords')
  .option('-t, --type <type>', 'Filter by template type (react-next, node-api, vue-app)')
  .option('-r, --registry <url>', 'Filter by registry')
  .option('--json', 'Output in JSON format')
  .action(async(options) => {
    const spinner = ora('Loading available templates...').start();

    try {
      const templateManager = new TemplateManager();
      const cacheManager = new CacheManager();

      let templates = await templateManager.listTemplates(options);

      // Apply filters
      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        templates = templates.filter(template =>
          template.name.toLowerCase().includes(searchTerm) ||
          template.description.toLowerCase().includes(searchTerm) ||
          template.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm))
        );
      }

      if (options.type) {
        templates = templates.filter(template =>
          template.type === options.type ||
          template.tags.includes(options.type)
        );
      }

      if (options.registry) {
        templates = templates.filter(template =>
          template.registry === options.registry
        );
      }

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(templates, null, 2));
      } else {
        if (templates.length === 0) {
          console.log(chalk.yellow('No templates found matching your criteria.'));
          return;
        }

        // Create table for display
        const tableData = [
          [chalk.bold('Name'), chalk.bold('Type'), chalk.bold('Version'), chalk.bold('Registry'), chalk.bold('Description')]
        ];

        templates.forEach(template => {
          tableData.push([
            chalk.green(template.name),
            chalk.cyan(template.type || 'unknown'),
            chalk.magenta(template.version || 'latest'),
            chalk.blue(template.registry || 'npm'),
            template.description || 'No description available'
          ]);
        });

        console.log(table.table(tableData, {
          border: table.getBorderCharacters('void'),
          columns: {
            0: { width: 30, wrapWord: true },
            1: { width: 15, wrapWord: true },
            2: { width: 10, wrapWord: true },
            3: { width: 20, wrapWord: true },
            4: { width: 40, wrapWord: true }
          }
        }));

        console.log(chalk.gray(`\nFound ${templates.length} template${templates.length !== 1 ? 's' : ''}`));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to list templates'));
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

module.exports = listCommand;
