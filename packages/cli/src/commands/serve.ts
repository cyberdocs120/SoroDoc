import { Command } from 'commander';

export const serveCommand = new Command('serve')
  .description('Serve generated documentation locally')
  .option('-d, --dir <path>', 'Documentation directory to serve', './docs')
  .option('-p, --port <port>', 'Port to serve on', '3000')
  .action(async (opts) => {
    console.log('Documentation server — coming soon');
    console.log(`  Directory: ${opts.dir}`);
    console.log(`  Port: ${opts.port}`);
  });
