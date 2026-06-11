import { Command } from 'commander';

export const studioCommand = new Command('studio')
  .description('Launch the SoroDoc web studio')
  .option('-p, --port <port>', 'Port to run the studio on', '5173')
  .action(async (opts) => {
    console.log('Web Studio — coming soon');
    console.log(`  Port: ${opts.port}`);
  });
