import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

interface StudioOptions {
  port: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_DIR = path.resolve(__dirname, '../../../packages/studio');

export const studioCommand = new Command('studio')
  .description('Launch the SoroDoc web studio')
  .option('-p, --port <port>', 'Port to run the studio on', '5173')
  .action(async (opts: StudioOptions) => {
    const port = parseInt(opts.port, 10);

    if (!fs.existsSync(path.join(STUDIO_DIR, 'package.json'))) {
      console.warn(`Warning: Studio directory not found at expected location: ${STUDIO_DIR}`);
    }

    console.log(`\n  🎨 Starting SoroDoc Studio...\n`);
    console.log(`  Local:   http://localhost:${port}`);
    console.log(`  \n  Press Ctrl+C to stop\n`);

    const child = spawn('npx', ['vite', '--port', String(port), '--host'], {
      cwd: STUDIO_DIR,
      stdio: 'inherit',
      env: { ...process.env, VITE_PORT: String(port) },
    });

    child.on('error', (err) => {
      console.error(`Failed to start studio: ${err.message}`);
      console.error(`Make sure dependencies are installed in ${STUDIO_DIR}`);
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });

    process.on('SIGINT', () => {
      child.kill('SIGINT');
      process.exit(0);
    });
  });
