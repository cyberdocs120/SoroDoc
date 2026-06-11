#!/usr/bin/env node
import { Command } from 'commander';
import { generateCommand } from './commands/generate.js';
import { sdkCommand } from './commands/sdk.js';
import { serveCommand } from './commands/serve.js';
import { studioCommand } from './commands/studio.js';
import { versionCommand } from './commands/version.js';
import { portalCommand } from './commands/portal.js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('sorodoc')
  .description('Soroban smart contract documentation generator')
  .version(version, '--version', 'Show version');

program.addCommand(generateCommand);
program.addCommand(sdkCommand);
program.addCommand(serveCommand);
program.addCommand(studioCommand);
program.addCommand(versionCommand);
program.addCommand(portalCommand);

program.parse(process.argv);
