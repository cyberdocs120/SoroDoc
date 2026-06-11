import { Command } from 'commander';

export const sdkCommand = new Command('sdk')
  .description('Generate SDK from a contract ABI')
  .option('--wasm <path>', 'Path to compiled WASM binary')
  .option('--lang <lang>', 'Target language (ts, rs, py)', 'ts')
  .option('-o, --out <path>', 'Output directory', './sdk')
  .option('--package-name <name>', 'Package name for the generated SDK')
  .action(async (opts) => {
    console.log('SDK generation — coming soon');
    console.log(`  WASM: ${opts.wasm}`);
    console.log(`  Language: ${opts.lang}`);
    console.log(`  Output: ${opts.out}`);
    if (opts.packageName) console.log(`  Package: ${opts.packageName}`);
  });
