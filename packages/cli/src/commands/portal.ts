import { Command } from 'commander';

export const portalCommand = new Command('portal')
  .description('Manage the SoroDoc hosted portal')
  .addCommand(
    new Command('deploy')
      .description('Deploy documentation to the SoroDoc portal')
      .option('-d, --dir <path>', 'Documentation directory to deploy', './docs')
      .option('--api-key <key>', 'API key for the portal')
      .action(async (opts) => {
        console.log('Portal deploy — coming soon');
        console.log(`  Directory: ${opts.dir}`);
        if (opts.apiKey) console.log('  API key: [hidden]');
      }),
  );
