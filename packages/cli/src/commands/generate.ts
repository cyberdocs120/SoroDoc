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
  type ContractABI,
  type DocOutput,
  type AIPromptConfig,
} from '@sorodoc/core';

function loadConfig(configPath?: string): Partial<{ ai: AIPromptConfig; output: { formats: string[]; sdks: string[]; outputDir: string } }> {
  if (!configPath) return {};
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    console.warn(`Config file not found: ${configPath}`);
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch {
    console.warn(`Invalid config file: ${configPath}`);
    return {};
  }
}

function resolveOutDir(flag?: string, configDir?: string): string {
  if (flag) return path.resolve(flag);
  if (configDir) return path.resolve(configDir);
  return path.resolve('./docs');
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
  try { walk(dir); } catch { return '0 files'; }
  const size = total > 1024 * 1024
    ? `${(total / 1024 / 1024).toFixed(1)} MB`
    : `${(total / 1024).toFixed(1)} KB`;
  return `${count} files, ${size}`;
}

async function runGenerate(opts: GenerateOptions): Promise<void> {
  const startTime = Date.now();
  const config = loadConfig(opts.config);
  const outputDir = resolveOutDir(opts.out, config.output?.outputDir);
  const formats = config.output?.formats ?? ['markdown', 'docusaurus', 'openapi'];
  const aiConfig: AIPromptConfig = config.ai ?? {
    enabled: true,
    model: 'claude-sonnet-4-20250514',
    tone: 'technical',
    generateExamples: true,
    exampleLanguages: ['typescript', 'python', 'rust'],
  };

  // Phase 1: Parse contract ABI
  const parseSpinner: Ora = ora('Parsing contract ABI...').start();

  if (!opts.wasm && !opts.contract) {
    parseSpinner.fail('Either --wasm or --contract is required');
    process.exit(1);
  }

  let wasmBuffer: Buffer | undefined;
  if (opts.wasm) {
    const wasmPath = path.resolve(opts.wasm);
    if (!fs.existsSync(wasmPath)) {
      parseSpinner.fail(`WASM file not found: ${wasmPath}`);
      process.exit(1);
    }
    wasmBuffer = fs.readFileSync(wasmPath);
  } else if (opts.contract) {
    parseSpinner.fail('Live contract fetching not yet implemented');
    process.exit(1);
  }

  let abi: ContractABI;
  try {
    abi = parseContract({
      wasm: wasmBuffer!,
      source: opts.source ? path.resolve(opts.source) : undefined,
      contractName: opts.name,
    });
  } catch (err) {
    parseSpinner.fail(`Failed to parse contract: ${err}`);
    process.exit(1);
  }

  parseSpinner.succeed(
    `Found ${abi.functions.length} function${abi.functions.length !== 1 ? 's' : ''}, ${abi.events.length} event${abi.events.length !== 1 ? 's' : ''}, ${abi.errors.length} error code${abi.errors.length !== 1 ? 's' : ''}`,
  );

  // Phase 2: AI documentation engine
  const aiSpinner: Ora = ora('Running AI documentation engine...').start();

  let docOutput: DocOutput;
  try {
    const engine = new DocEngine({
      onProgress: (phase, current, total) => {
        if (phase === 'functions') {
          aiSpinner.text = `Generating documentation for function ${current}/${total - 1}...`;
        }
      },
    });
    docOutput = await engine.generate(abi, aiConfig);
  } catch (err) {
    aiSpinner.fail(`AI documentation failed: ${err}`);
    process.exit(1);
  }

  aiSpinner.succeed(
    `Generated descriptions for ${docOutput.functions.length}/${abi.functions.length} functions, ${docOutput.errors.length} error catalogue entries, ${docOutput.events.length} events`,
  );

  // Phase 3: Render output
  const renderSpinner: Ora = ora('Rendering documentation...').start();

  const renderStart = Date.now();
  let renderedCount = 0;
  const results: string[] = [];

  try {
    if (formats.includes('markdown')) {
      const mdRenderer = new MarkdownRenderer({
        outputDir,
        contractId: opts.contract,
        network: opts.network,
      });
      const result = mdRenderer.render(docOutput);
      results.push(`Markdown  →  ${path.join(outputDir, 'markdown')}`);
      renderedCount++;
    }

    if (formats.includes('docusaurus')) {
      const dsRenderer = new DocusaurusRenderer({
        outputDir,
        contractId: opts.contract,
        network: opts.network,
        projectName: opts.name || abi.name,
        tagline: `${abi.name} — Soroban Smart Contract`,
      });
      const result = dsRenderer.render(docOutput);
      results.push(`Docusaurus  →  ${path.join(outputDir, 'docusaurus')}`);
      renderedCount++;
    }

    if (formats.includes('openapi')) {
      const oaRenderer = new OpenAPIRenderer({
        outputDir,
        contractId: opts.contract,
        network: opts.network,
      });
      const result = oaRenderer.render(docOutput);
      results.push(`OpenAPI spec →  ${path.join(outputDir, 'openapi.yaml')}`);
      renderedCount++;
    }
  } catch (err) {
    renderSpinner.fail(`Rendering failed: ${err}`);
    process.exit(1);
  }

  renderSpinner.succeed(`Rendered ${renderedCount} format${renderedCount !== 1 ? 's' : ''}`);

  // Summary
  const totalTime = Date.now() - startTime;
  for (const line of results) {
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
    await runGenerate(opts);

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
