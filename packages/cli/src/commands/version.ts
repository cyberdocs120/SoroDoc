import { Command } from 'commander';

export const versionCommand = new Command('version')
  .description('Manage contract documentation versions')
  .addCommand(
    new Command('tag')
      .description('Tag the current documentation version')
      .argument('<version>', 'Version tag (e.g. 1.0.0)')
      .action((versionTag: string) => {
        console.log(`Version tag — coming soon (tag: ${versionTag})`);
      }),
  )
  .addCommand(
    new Command('list')
      .description('List all documentation versions')
      .action(() => {
        console.log('Version list — coming soon');
      }),
  )
  .addCommand(
    new Command('diff')
      .description('Show diff between two contract versions')
      .argument('<version-a>', 'First version')
      .argument('<version-b>', 'Second version')
      .action((a: string, b: string) => {
        console.log(`Version diff — coming soon (${a} vs ${b})`);
      }),
  );
