import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chokidar from 'chokidar';
import ora, { type Ora } from 'ora';
import {
  parseContract,
  DocEngine,
  MarkdownRenderer,
  DocusaurusRenderer,
  OpenAPIRenderer,
  ConfigFileSchema,
  fetchContractWasm,
  getRpcUrl,
  type ContractABI,
  type DocOutput,
  type AIPromptConfig,
} from '@sorodoc/core';

function loadConfig(configPath?: string): any {
  if (!configPath) return {};
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const rawConfig = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const result = ConfigFileSchema.safeParse(rawConfig);
  if (!result.success) {
    const issues = result.error.issues.map((issue: any) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  return result.data;
}

export function resolveOutDir(flag?: string, outputSetting?: string, configPath?: string): string {
  if (flag) return path.resolve(flag);
  if (outputSetting) {
    if (path.isAbsolute(outputSetting)) return outputSetting;
    if (configPath) return path.resolve(path.dirname(configPath), outputSetting);
    return path.resolve(outputSetting);
  }
  if (configPath) return path.resolve(path.dirname(configPath));
  return path.resolve('./docs');
}

export interface ContractTarget {
  name: string;
  wasm?: string;
  source?: string;
  contractId?: string;
  network?: 'testnet' | 'mainnet';
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'contract';
}

export function resolveContracts(opts: GenerateOptions, config: any, configPath?: string): ContractTarget[] {
  const resolveRel = (p: string) =>
    path.isAbsolute(p) ? p : configPath ? path.resolve(path.dirname(configPath), p) : path.resolve(p);

  if (opts.wasm || opts.contract) {
    return [
      {
        name: opts.name || 'contract',
        wasm: opts.wasm ? resolveRel(opts.wasm) : undefined,
        source: opts.source ? resolveRel(opts.source) : undefined,
        contractId: opts.contract,
        network: opts.network === 'mainnet' ? 'mainnet' : 'testnet',
      },
    ];
  }

  if (config?.contracts?.length) {
    return config.contracts.map((c: any) => ({
      name: c.name,
      wasm: c.wasm ? resolveRel(c.wasm) : undefined,
      source: c.source ? resolveRel(c.source) : undefined,
      contractId: c.deployedId?.mainnet || c.deployedId?.testnet,
      network: c.deployedId?.mainnet && !c.deployedId?.testnet ? 'mainnet' : 'testnet',
    }));
  }

  return [];
}

interface GenerateOptions {
  wasm?: string;
  source?: string;
  name?: string;
  contract?: string;
  network?: string;
  out?: string;
  config?: string;
  watch?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatSize(dir: string): string {
  let total = 0;
  let count = 0;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, entry.name);
      if (entry.isFile()) {
        total += fs.statSync(fp).size;
        count++;
      } else if (entry.isDirectory()) {
        walk(fp);
      }
    }
  };
  try {
    walk(dir);
  } catch {
    return '0 files';
  }
  const size =
    total > 1024 * 1024
      ? `${(total / 1024 / 1024).toFixed(1)} MB`
      : `${(total / 1024).toFixed(1)} KB`;
  return `${count} files, ${size}`;
}

async function parseTarget(target: ContractTarget, parseSpinner: Ora): Promise<Buffer> {
  if (target.wasm) {
    if (!fs.existsSync(target.wasm)) {
      throw new Error(`WASM file not found: ${target.wasm}`);
    }
    return fs.readFileSync(target.wasm);
  }
  if (target.contractId) {
    parseSpinner.text = `Fetching contract ${target.contractId} from ${target.network}...`;
    return fetchContractWasm({
      contractId: target.contractId,
      network: target.network ?? 'testnet',
      rpcUrl: getRpcUrl(target.network ?? 'testnet'),
    });
  }
  throw new Error(`No WASM or contract ID specified for "${target.name}"`);
}

function renderTarget(
  docOutput: DocOutput,
  abi: ContractABI,
  outputDir: string,
  target: ContractTarget,
  opts: GenerateOptions,
  config: any,
): string[] {
  const formats = config.output?.formats ?? ['markdown', 'docusaurus', 'openapi'];
  const results: string[] = [];
  const contractId = target.contractId || opts.contract;
  const network = target.network || opts.network;

  if (formats.includes('markdown')) {
    const mdRenderer = new MarkdownRenderer({
      outputDir,
      contractId,
      network,
    });
    mdRenderer.render(docOutput);
    results.push(`Markdown  →  ${path.join(outputDir, 'markdown')}`);
  }

  if (formats.includes('docusaurus')) {
    const dsRenderer = new DocusaurusRenderer({
      outputDir,
      contractId,
      network,
      projectName: opts.name || target.name || abi.name,
      tagline: `${abi.name} — Soroban Smart Contract`,
    });
    dsRenderer.render(docOutput);
    results.push(`Docusaurus  →  ${path.join(outputDir, 'docusaurus')}`);
  }

  if (formats.includes('openapi')) {
    const oaRenderer = new OpenAPIRenderer({
      outputDir,
      contractId,
      network,
    });
    oaRenderer.render(docOutput);
    results.push(`OpenAPI spec →  ${path.join(outputDir, 'openapi.yaml')}`);
  }

  return results;
}

async function generateContract(
  target: ContractTarget,
  opts: GenerateOptions,
  config: any,
  outputDir: string,
): Promise<{ abi: ContractABI; docOutput: DocOutput; results: string[] }> {
  // Phase 1: Parse contract ABI
  const parseSpinner: Ora = ora(`Parsing ${target.name}...`).start();
  let wasmBuffer: Buffer;
  let abi: ContractABI;
  try {
    wasmBuffer = await parseTarget(target, parseSpinner);
    abi = parseContract({
      wasm: wasmBuffer,
      source: target.source,
      contractName: target.name,
    });
  } catch (err) {
    parseSpinner.fail(`Failed to parse ${target.name}: ${err}`);
    throw err;
  }

  parseSpinner.succeed(
    `${target.name}: ${abi.functions.length} function${abi.functions.length !== 1 ? 's' : ''}, ${abi.events.length} event${abi.events.length !== 1 ? 's' : ''}, ${abi.errors.length} error code${abi.errors.length !== 1 ? 's' : ''}`,
  );

  // Phase 2: AI documentation engine
  const aiConfig: AIPromptConfig = config.ai ?? {
    enabled: true,
    model: 'claude-sonnet-4-20250514',
    tone: 'technical',
    generateExamples: true,
    exampleLanguages: ['typescript', 'python', 'rust'],
  };

  const aiSpinner: Ora = ora('Running AI documentation engine...').start();
  let docOutput: DocOutput;
  try {
    const engine = new DocEngine({
      onProgress: (phase, current, total) => {
        if (phase === 'functions') {
          aiSpinner.text = `Generating documentation for function ${current}/${total - 1}...`;
        } else if (phase === 'events') {
          aiSpinner.text = 'Documenting contract events...';
        } else if (phase === 'errors') {
          aiSpinner.text = 'Building error catalogue...';
        }
      },
    });
    docOutput = await engine.generate(abi, aiConfig);
  } catch (err) {
    aiSpinner.fail(`AI documentation failed: ${err}`);
    throw err;
  }

  aiSpinner.succeed(
    `Generated descriptions for ${docOutput.functions.length}/${abi.functions.length} functions, ${docOutput.errors.length} error catalogue entries, ${docOutput.events.length} events`,
  );

  // Phase 3: Render output
  const renderSpinner: Ora = ora('Rendering documentation...').start();
  let results: string[];
  try {
    results = renderTarget(docOutput, abi, outputDir, target, opts, config);
  } catch (err) {
    renderSpinner.fail(`Rendering failed: ${err}`);
    throw err;
  }
  renderSpinner.succeed(`Rendered ${results.length} format${results.length !== 1 ? 's' : ''}`);

  return { abi, docOutput, results };
}

function writeIndex(config: any, targets: ContractTarget[], outputDir: string): void {
  const lines: string[] = [];
  const projectName = config.project?.name ?? 'SoroDoc';
  const description = config.project?.description ?? 'Generated Soroban smart contract documentation';
  lines.push(`# ${projectName}`);
  lines.push('');
  lines.push(description);
  lines.push('');
  lines.push(`Generated on ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('## Contracts');
  lines.push('');
  for (const target of targets) {
    lines.push(`- [${target.name}](./${slugify(target.name)}/markdown/index.md)`);
  }
  lines.push('');
  fs.writeFileSync(path.join(outputDir, 'README.md'), lines.join('\n'), 'utf8');
}

export async function runGenerate(opts: GenerateOptions): Promise<void> {
  const startTime = Date.now();
  const config = loadConfig(opts.config);
  const outputDir = resolveOutDir(opts.out, config.output?.outputDir, opts.config);
  const targets = resolveContracts(opts, config, opts.config);

  if (targets.length === 0) {
    throw new Error('No contracts specified. Use --wasm, --contract, or configure contracts in sorodoc.config.json.');
  }

  const singleFlagTarget = opts.wasm || opts.contract;
  const allResults: string[] = [];
  const renderedDirs: Array<{ name: string; dir: string }> = [];

  console.log('');
  for (const target of targets) {
    console.log(`  📦 Generating documentation for "${target.name}"`);
    const targetOutDir = singleFlagTarget
      ? outputDir
      : path.join(outputDir, slugify(target.name));
    const { results } = await generateContract(target, opts, config, targetOutDir);
    for (const line of results) allResults.push(line);
    renderedDirs.push({ name: target.name, dir: targetOutDir });
  }

  if (!singleFlagTarget) {
    writeIndex(config, targets, outputDir);
    allResults.push(`Index  →  ${path.join(outputDir, 'README.md')}`);
  }

  // Summary
  const totalTime = Date.now() - startTime;
  for (const line of allResults) {
    console.log(`   ✅ ${line}`);
  }
  console.log('');
  console.log(`⏱  Completed in ${formatDuration(totalTime)}`);
  console.log(`📁 Output: ${outputDir}  (${formatSize(outputDir)})`);
}

export const generateCommand = new Command('generate')
  .description('Generate documentation for a Soroban smart contract')
  .option('--wasm <path>', 'Path to compiled WASM binary')
  .option('--source <path>', 'Path to Rust source file for doc enrichment')
  .option('-n, --name <name>', 'Contract name')
  .option('-c, --contract <id>', 'Deployed contract ID (live ABI fetch)')
  .option('--network <network>', 'Network for live fetch: testnet|mainnet', 'testnet')
  .option('-o, --out <path>', 'Output directory')
  .option('--config <path>', 'Path to sorodoc config file')
  .option('--watch', 'Watch mode — regenerate on file changes')
  .action(async (opts) => {
    try {
      await runGenerate(opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }

    if (opts.watch) {
      const watchPaths: string[] = [];
      if (opts.wasm) watchPaths.push(path.resolve(opts.wasm));
      if (opts.source) watchPaths.push(path.resolve(opts.source));

      if (watchPaths.length === 0) {
        console.warn('No files to watch. Specify --wasm and/or --source for watch mode.');
        return;
      }

      console.log(`\n👀 Watching ${watchPaths.join(', ')} for changes...\n`);
      const watcher = chokidar.watch(watchPaths, { ignoreInitial: true });
      watcher.on('change', async (changedPath) => {
        console.log(`\n📝 File changed: ${changedPath}`);
        console.log('🔄 Regenerating...\n');
        try {
          await runGenerate(opts);
          console.log(`\n👀 Still watching ${watchPaths.join(', ')}...\n`);
        } catch {
          console.error('Regeneration failed');
        }
      });
    }
  });
