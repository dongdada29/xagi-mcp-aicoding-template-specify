const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const table = require('table');
const CacheManager = require('../../core/cache-manager');

const cacheCommand = program
  .createCommand('cache')
  .description('Manage template cache')
  .addCommand(
    program
      .createCommand('list')
      .alias('ls')
      .description('List cached templates')
      .option('--json', 'Output in JSON format')
      .option('--size', 'Show cache sizes')
      .action(async(options) => {
        const spinner = ora('Loading cache information...').start();

        try {
          const cacheManager = new CacheManager();
          const cacheStats = await cacheManager.getCacheStats();
          const cacheEntries = await cacheManager.listCacheEntries();

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify({
              stats: cacheStats,
              entries: cacheEntries
            }, null, 2));
          } else {
            console.log(chalk.bold.blue('\n📦 Cache Information'));
            console.log(chalk.gray('━'.repeat(30)));

            // Display cache statistics
            console.log(chalk.bold('Cache Statistics:'));
            console.log(`  Total entries: ${chalk.cyan(cacheStats.totalEntries)}`);
            console.log(`  Total size: ${chalk.cyan(cacheManager.formatBytes(cacheStats.totalSize))}`);
            console.log(`  Cache location: ${chalk.gray(cacheStats.cachePath)}`);
            console.log(`  Last pruned: ${chalk.gray(cacheStats.lastPruned ? new Date(cacheStats.lastPruned).toLocaleDateString() : 'Never')}`);

            if (cacheEntries.length > 0) {
              console.log(chalk.bold('\nCached Templates:'));

              const tableData = [
                [chalk.bold('Template'), chalk.bold('Version'), chalk.bold('Type'), options.size ? chalk.bold('Size') : chalk.bold('Accessed')]
              ];

              cacheEntries.forEach(entry => {
                tableData.push([
                  chalk.green(entry.name),
                  chalk.magenta(entry.version || 'latest'),
                  chalk.cyan(entry.type),
                  options.size ? chalk.yellow(cacheManager.formatBytes(entry.size || 0)) : chalk.gray(new Date(entry.lastAccessed).toLocaleDateString())
                ]);
              });

              console.log(table.table(tableData, {
                border: table.getBorderCharacters('void'),
                columns: {
                  0: { width: 30, wrapWord: true },
                  1: { width: 15, wrapWord: true },
                  2: { width: 10, wrapWord: true },
                  3: { width: 20, wrapWord: true }
                }
              }));
            } else {
              console.log(chalk.yellow('\nNo cached templates found.'));
            }
          }
        } catch (error) {
          spinner.fail(chalk.red('Failed to load cache information'));
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    program
      .createCommand('clear')
      .description('Clear template cache')
      .option('--template <name>', 'Clear specific template cache')
      .option('--force', 'Force clear without confirmation')
      .action(async(options) => {
        const spinner = ora('Clearing cache...').start();

        try {
          const cacheManager = new CacheManager();

          // Confirm before clearing unless --force is used
          if (!options.force) {
            spinner.stop();

            const message = options.template
              ? `Clear cache for template "${options.template}"?`
              : 'Clear all cached templates?';

            const { confirmed } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirmed',
                message: message,
                default: false
              }
            ]);

            if (!confirmed) {
              console.log(chalk.yellow('Cache clearing cancelled.'));
              return;
            }

            spinner.start('Clearing cache...');
          }

          let result;
          if (options.template) {
            result = await cacheManager.clearCacheEntry(options.template);
          } else {
            result = await cacheManager.clearAllCache();
          }

          spinner.succeed(chalk.green('Cache cleared successfully!'));

          if (options.template) {
            console.log(chalk.blue(`Cleared cache for template: ${options.template}`));
          } else {
            console.log(chalk.blue(`Cleared ${result.clearedCount} cache entries`));
            console.log(chalk.blue(`Freed ${cacheManager.formatBytes(result.freedSpace)}`));
          }
        } catch (error) {
          spinner.fail(chalk.red('Failed to clear cache'));
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    program
      .createCommand('prune')
      .description('Remove expired or invalid cache entries')
      .option('--dry-run', 'Preview what would be removed')
      .action(async(options) => {
        const spinner = ora('Pruning cache...').start();

        try {
          const cacheManager = new CacheManager();

          const result = await cacheManager.pruneCache({
            dryRun: options.dryRun,
            removeExpired: true,
            removeInvalid: true
          });

          spinner.stop();

          if (options.dryRun) {
            console.log(chalk.bold.yellow('\n🔍 Cache Prune Preview'));
            console.log(chalk.gray('━'.repeat(25)));

            console.log(chalk.bold('Entries to be removed:'));
            if (result.entries.length > 0) {
              result.entries.forEach(entry => {
                const reason = entry.reason === 'expired' ? chalk.red('expired') : chalk.red('invalid');
                console.log(`  ${chalk.green(entry.name)} - ${reason} (${cacheManager.formatBytes(entry.size || 0)})`);
              });
            } else {
              console.log(chalk.yellow('No entries need to be removed.'));
            }

            console.log(chalk.bold('\nSummary:'));
            console.log(`  Entries to remove: ${chalk.cyan(result.removedCount)}`);
            console.log(`  Space to free: ${chalk.cyan(cacheManager.formatBytes(result.freedSpace))}`);
          } else {
            console.log(chalk.bold.green('\n✅ Cache Pruned'));
            console.log(chalk.gray('━'.repeat(25)));

            console.log(chalk.bold('Removed entries:'));
            if (result.entries.length > 0) {
              result.entries.forEach(entry => {
                const reason = entry.reason === 'expired' ? chalk.red('expired') : chalk.red('invalid');
                console.log(`  ${chalk.green(entry.name)} - ${reason} (${cacheManager.formatBytes(entry.size || 0)})`);
              });
            }

            console.log(chalk.bold('\nSummary:'));
            console.log(`  Removed entries: ${chalk.cyan(result.removedCount)}`);
            console.log(`  Freed space: ${chalk.cyan(cacheManager.formatBytes(result.freedSpace))}`);
            console.log(`  Cache efficiency: ${chalk.cyan(`${result.efficiency}%`)}`);
          }
        } catch (error) {
          spinner.fail(chalk.red('Failed to prune cache'));
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      })
  );

module.exports = cacheCommand;
