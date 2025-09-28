const { program } = require('commander');
const chalk = require('chalk');

const infoCommand = program
  .createCommand('info')
  .description('Show detailed information about a template')
  .argument('<template>', 'Template name or package')
  .option('--json', 'Output in JSON format')
  .option('--versions', 'Show available versions')
  .option('--dependencies', 'Show template dependencies')
  .action(async (template, options) => {
    console.log(chalk.yellow('Info command - Implementation needed'));
    console.log('Template:', template);
    console.log('Options:', options);
    // TODO: Implement template info logic
  });

module.exports = infoCommand;