import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import ora from 'ora';
import { parseContract } from '@sorodoc/core';

interface SDKOptions {
  wasm?: string;
  lang?: string;
  out?: string;
  packageName?: string;
}

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

  const parseSpinner = ora('Parsing contract ABI...').start();
  let abi;
  try {
    abi = parseContract({ wasm: fs.readFileSync(wasmPath), contractName: undefined });
  } catch (err) {
    parseSpinner.fail(`Failed to parse contract: ${err}`);
    process.exit(1);
  }
  parseSpinner.succeed(`Found ${abi.functions.length} functions, ${abi.events.length} events, ${abi.errors.length} errors`);

  const outputDir = path.resolve(opts.out || './sdk');
  const lang = opts.lang || 'ts';
  const pkgName = opts.packageName || `@sorodoc/${abi.name.toLowerCase()}-sdk`;

  const genSpinner = ora(`Generating ${lang} SDK...`).start();

  fs.mkdirSync(outputDir, { recursive: true });

  try {
    if (lang === 'ts') {
      const sdk = generateTypeScriptStub(abi, pkgName);
      for (const [filePath, content] of Object.entries(sdk)) {
        const fullPath = path.join(outputDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
      }
      genSpinner.succeed(`TypeScript SDK scaffold → ${outputDir}`);
    } else if (lang === 'py') {
      const sdk = generatePythonStub(abi, pkgName);
      for (const [filePath, content] of Object.entries(sdk)) {
        const fullPath = path.join(outputDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
      }
      genSpinner.succeed(`Python SDK scaffold → ${outputDir}`);
    } else if (lang === 'rs') {
      const sdk = generateRustStub(abi, pkgName);
      for (const [filePath, content] of Object.entries(sdk)) {
        const fullPath = path.join(outputDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
      }
      genSpinner.succeed(`Rust SDK scaffold → ${outputDir}`);
    } else {
      genSpinner.fail(`Unsupported language: ${lang} (use ts, py, rs)`);
      process.exit(1);
    }
  } catch (err) {
    genSpinner.fail(`SDK generation failed: ${err}`);
    process.exit(1);
  }

  console.log(`\n📦 Package: ${pkgName}`);
  console.log(`📁 Output:  ${outputDir}`);
  console.log(`\n⚠️  Full SDK generation with typed methods, JSDoc, and contract class coming in v0.2.0`);
}

function generateTypeScriptStub(abi: { name: string; functions: Array<{ name: string; params: Array<{ name: string }>; returns: unknown }>; errors: Array<{ code: number; name: string }> }, packageName: string): Record<string, string> {
  const fnInterfaceEntries = abi.functions.map(fn => {
    const params = fn.params.map(p => `  ${p.name}: unknown;`).join('\n');
    return `export interface ${fn.name.charAt(0).toUpperCase() + fn.name.slice(1)}Params {\n${params}\n}`;
  }).join('\n\n');

  const errorUnion = abi.errors.map(e => `  | { code: ${e.code}; message: '${e.name}' }`).join('\n');

  const methodEntries = abi.functions.map(fn => {
    const paramNames = fn.params.map(p => `${p.name}: ${fn.name.charAt(0).toUpperCase() + fn.name.slice(1)}Params['${p.name}']`).join(', ');
    return `  async ${fn.name}(${paramNames}): Promise<unknown> {\n    throw new Error('Not implemented');\n  }`;
  }).join('\n\n');

  return {
    'index.ts': `import { Contract, Networks, rpc } from '@stellar/stellar-sdk';\n\n${fnInterfaceEntries}\n\nexport type ContractError =\n${errorUnion};\n\nexport class ${abi.name}Contract {\n  private contract: Contract;\n  private rpcUrl: string;\n\n  constructor(opts: { contractId: string; networkPassphrase?: string; rpcUrl?: string }) {\n    this.rpcUrl = opts.rpcUrl || 'https://soroban-rpc.testnet.stellar.org';\n    this.contract = new Contract(opts.contractId);\n  }\n\n${methodEntries}\n}\n`,
    'package.json': JSON.stringify({ name: packageName, version: '0.1.0', type: 'module', main: './index.ts', dependencies: { '@stellar/stellar-sdk': '^15.0.0' } }, null, 2),
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'Node16', strict: true, esModuleInterop: true, skipLibCheck: true }, include: ['index.ts'] }, null, 2),
    'README.md': `# ${packageName}\n\nGenerated SDK for ${abi.name}.\n\n## Installation\n\n\`\`\`bash\nnpm install ${packageName}\n\`\`\`\n\n## Usage\n\n\`\`\`typescript\nimport { ${abi.name}Contract } from '${packageName}';\n\nconst contract = new ${abi.name}Contract({\n  contractId: 'YOUR_CONTRACT_ID',\n});\n\`\`\`\n`,
  };
}

function generatePythonStub(abi: { name: string; functions: Array<{ name: string; params: Array<{ name: string }> }> }, _packageName: string): Record<string, string> {
  const methodDefs = abi.functions.map(fn => {
    const params = fn.params.map(p => `        ${p.name}: Any`).join(',\n');
    return `    def ${fn.name}(\n${params}\n    ) -> Any:\n        raise NotImplementedError()`;
  }).join('\n\n');

  return {
    'sdk.py': `from dataclasses import dataclass\nfrom typing import Any\nfrom stellar_sdk import SorobanServer, Contract\n\nclass ${abi.name}Contract:\n    def __init__(self, contract_id: str, rpc_url: str = "https://soroban-rpc.testnet.stellar.org"):\n        self.contract_id = contract_id\n        self.server = SorobanServer(rpc_url)\n\n${methodDefs}\n`,
    'pyproject.toml': `[build-system]\nrequires = ["setuptools"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "${abi.name.toLowerCase()}-sdk"\nversion = "0.1.0"\ndependencies = ["stellar-sdk>=11.0.0"]\n`,
    'README.md': `# ${abi.name} SDK\n\nGenerated Python SDK for ${abi.name}.\n`,
  };
}

function generateRustStub(abi: { name: string; functions: Array<{ name: string }> }, _packageName: string): Record<string, string> {
  const stubMethods = abi.functions.map(fn => {
    return `    pub async fn ${fn.name}(&self) -> Result<(), soroban_sdk::Error> {\n        todo!()\n    }`;
  }).join('\n\n');

  return {
    'src/lib.rs': `use soroban_sdk::{Env, Address, BytesN};\n\npub struct ${abi.name}Contract {\n    pub contract_id: BytesN<32>,\n}\n\nimpl ${abi.name}Contract {\n    pub fn new(contract_id: BytesN<32>) -> Self {\n        Self { contract_id }\n    }\n\n${stubMethods}\n}\n`,
    'Cargo.toml': `[package]\nname = "${abi.name.toLowerCase()}-sdk"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nsoroban-sdk = "21.0.0"\ntokio = { version = "1", features = ["full"] }\n`,
    'README.md': `# ${abi.name.toLowerCase()} SDK\n\nGenerated Rust SDK for ${abi.name}.\n`,
  };
}

export const sdkCommand = new Command('sdk')
  .description('Generate SDK from a contract ABI')
  .option('--wasm <path>', 'Path to compiled WASM binary')
  .option('--lang <lang>', 'Target language (ts, py, rs)', 'ts')
  .option('-o, --out <path>', 'Output directory', './sdk')
  .option('--package-name <name>', 'Package name for the generated SDK')
  .action(async (opts) => {
    await runSDK(opts);
  });
