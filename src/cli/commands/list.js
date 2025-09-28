const { program } = require('commander');
const chalk = require('chalk');

const listCommand = program
  .createCommand('list')
  .alias('ls')
  .description('List available project templates')
  .option('-s, --search <term>', 'Search templates by name or keywords')
  .option('-t, --type <type>', 'Filter by template type (react-next, node-api, vue-app)')
  .option('-r, --registry <url>', 'Filter by registry')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    console.log(chalk.yellow('List command - Implementation needed'));
    console.log('Options:', options);
    // TODO: Implement template listing logic
  });

module.exports = listCommand;