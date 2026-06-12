import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import ora from 'ora';
import { parseContract, DocEngine, type ContractABI, type AIPromptConfig } from '@sorodoc/core';
import { SDKGenerator } from '@sorodoc/sdk';

interface SDKOptions {
  wasm?: string;
  lang?: string;
  out?: string;
  packageName?: string;
  network?: string;
  contractId?: string;
  name?: string;
  config?: string;
}

function loadConfig(configPath?: string): Partial<{ ai: AIPromptConfig; output: { formats: string[]; sdks: string[]; outputDir: string } }> {
  if (!configPath) return {};
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) return {};
  try { return JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch { return {}; }
}

const LANG_MAP: Record<string, 'typescript' | 'python' | 'rust'> = {
  ts: 'typescript',
  py: 'python',
  rs: 'rust',
};

async function runSDK(opts: SDKOptions): Promise<void> {
  if (!opts.wasm) {
    console.error('Error: --wasm is required');
    process.exit(1);
  }

  const wasmPath = path.resolve(opts.wasm);
  if (!fs.existsSync(wasmPath)) {
    console.error(`Error: WASM file not found: ${wasmPath}`);
    process.exit(1);
  }

  const outputDir = path.resolve(opts.out || './sdk');
  const lang = LANG_MAP[opts.lang || 'ts'] || 'typescript';
  const pkgName = opts.packageName;

  // Phase 1: Parse ABI
  const parseSpinner = ora('Parsing contract ABI...').start();
  let abi: ContractABI;
  try {
    abi = parseContract({ wasm: fs.readFileSync(wasmPath), contractName: opts.name });
  } catch (err) {
    parseSpinner.fail(`Failed to parse contract: ${err}`);
    process.exit(1);
  }
  parseSpinner.succeed(`Found ${abi.functions.length} functions, ${abi.events.length} events, ${abi.errors.length} errors`);

  // Phase 2: AI enrichment (optional, if config has AI enabled)
  const config = loadConfig(opts.config);
  const aiConfig: AIPromptConfig = config.ai ?? {
    enabled: true,
    model: 'claude-sonnet-4-20250514',
    tone: 'technical',
    generateExamples: true,
    exampleLanguages: ['typescript', 'python', 'rust'],
  };

  let docOutput = undefined;
  if (aiConfig.enabled && process.env.ANTHROPIC_API_KEY) {
    const aiSpinner = ora('Running AI documentation engine...').start();
    try {
      const engine = new DocEngine();
      docOutput = await engine.generate(abi, aiConfig);
      aiSpinner.succeed(`Generated docs for ${docOutput.functions.length} functions`);
    } catch (err) {
      aiSpinner.warn(`AI docs unavailable: ${err}`);
    }
  }

  // Phase 3: Generate SDK
  const genSpinner = ora(`Generating ${lang} SDK...`).start();
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    const generator = new SDKGenerator({
      abi,
      docOutput,
      packageName: pkgName,
      network: opts.network || 'testnet',
      contractId: opts.contractId,
    });

    const result = generator.generate(lang);

    for (const [filePath, content] of result.files) {
      const fullPath = path.join(outputDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    }

    if (result.readme) {
      const readmePath = path.join(outputDir, 'README.md');
      fs.writeFileSync(readmePath, result.readme, 'utf8');
    }

    genSpinner.succeed(`Generated ${result.files.size} files → ${outputDir}`);
  } catch (err) {
    genSpinner.fail(`SDK generation failed: ${err}`);
    process.exit(1);
  }

  // Summary
  let totalSize = 0;
  const walkDir = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, entry.name);
      if (entry.isFile()) totalSize += fs.statSync(fp).size;
      else if (entry.isDirectory()) walkDir(fp);
    }
  };
  walkDir(outputDir);

  const sizeStr = totalSize > 1024 * 1024
    ? `${(totalSize / 1024 / 1024).toFixed(1)} MB`
    : `${(totalSize / 1024).toFixed(1)} KB`;

  console.log(`\n📦 Package: ${pkgName || `${abi.name.toLowerCase()}-sdk`}`);
  console.log(`📁 Output:  ${outputDir}  (${sizeStr})`);
}

export const sdkCommand = new Command('sdk')
  .description('Generate SDK from a contract ABI')
  .option('--wasm <path>', 'Path to compiled WASM binary')
  .option('--lang <lang>', 'Target language (ts, py, rs)', 'ts')
  .option('-o, --out <path>', 'Output directory', './sdk')
  .option('--package-name <name>', 'Package name for the generated SDK')
  .option('--network <network>', 'Network for SDK config (testnet|mainnet)', 'testnet')
  .option('-c, --contract-id <id>', 'Contract ID for the generated SDK')
  .option('-n, --name <name>', 'Contract name')
  .option('--config <path>', 'Path to sorodoc config file (for AI enrichment)')
  .action(async (opts: SDKOptions) => {
    await runSDK(opts);
  });
