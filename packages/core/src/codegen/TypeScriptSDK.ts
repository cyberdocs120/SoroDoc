import { type ContractABI, type FunctionSpec, type ErrorSpec, type TypeDefinition, type DocOutput, type DocFunction, type SDKOutput } from '../types.js';

export interface TypeScriptSDKOptions {
  abi: ContractABI;
  docOutput?: DocOutput;
  packageName: string;
  version?: string;
  network?: string;
  contractId?: string;
}

function sorobanToTS(type: { kind: string; name?: string; element?: unknown; key?: unknown; value?: unknown; inner?: unknown; ok?: unknown; len?: number; fields?: Array<{ name: string; type: unknown }>; variants?: Array<{ name: string }> }): string {
  switch (type.kind) {
    case 'val': return 'string';
    case 'address': return 'string';
    case 'bool': return 'boolean';
    case 'void': return 'void';
    case 'error': return 'string';
    case 'i32': return 'number';
    case 'i64': return 'number';
    case 'i128': return 'bigint';
    case 'i256': return 'bigint';
    case 'u32': return 'number';
    case 'u64': return 'number';
    case 'u128': return 'bigint';
    case 'u256': return 'bigint';
    case 'symbol': return 'string';
    case 'string': return 'string';
    case 'timepoint': return 'bigint';
    case 'duration': return 'bigint';
    case 'muxedAddress': return 'string';
    case 'bytes': return `string${type.len !== undefined ? ` /* length: ${type.len} */` : ''}`;
    case 'vec': return `Array<${sorobanToTS(type.element as any)}>`;
    case 'map': return `Map<${sorobanToTS(type.key as any)}, ${sorobanToTS(type.value as any)}>`;
    case 'option': return `${sorobanToTS(type.inner as any)} | null`;
    case 'result': return `${sorobanToTS(type.ok as any)}`;
    case 'struct': return type.name || 'Record<string, unknown>';
    case 'enum': return type.name || 'string';
    case 'union': return type.name || 'unknown';
    case 'tuple': return 'string /* tuple */';
    case 'udt': return type.name || 'string';
    default: return 'unknown';
  }
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function generateParamInterface(fn: FunctionSpec, docFn?: DocFunction): string {
  if (fn.params.length === 0) return '';

  const fields = fn.params.map(p => {
    const tsType = sorobanToTS(p.type);
    const docComment = docFn?.params.find(dp => dp.name === p.name)?.description || p.docs || '';
    const docs = docComment ? `  /** ${docComment} */\n` : '';
    return `${docs}  ${p.name}: ${tsType};`;
  }).join('\n');

  return `\nexport interface ${capitalize(fn.name)}Params {\n${fields}\n}`;
}

function generateErrorUnion(errors: ErrorSpec[]): string {
  if (errors.length === 0) return 'export type ContractError = never;';
  const entries = errors.map(e => `  | { code: ${e.code}; message: '${e.name}' }`);
  return `export type ContractError =\n${entries.join('\n')};`;
}

function indent(text: string, level: number): string {
  const prefix = '  '.repeat(level);
  return text.split('\n').map(l => l ? prefix + l : '').join('\n');
}

function generateMethods(abi: ContractABI, docOutput?: DocOutput, contractId?: string, network?: string): string {
  const docMap = new Map<string, DocFunction>();
  if (docOutput) {
    for (const fn of docOutput.functions) {
      docMap.set(fn.name, fn);
    }
  }

  return abi.functions.map(fn => {
    const docFn = docMap.get(fn.name);
    const desc = docFn?.description || fn.docs || `${fn.name} — contract function.`;
    const paramNames = fn.params.length > 0 ? `params: ${capitalize(fn.name)}Params` : '';
    const returnType = fn.returns.kind === 'void' ? 'Promise<void>' : `Promise<${sorobanToTS(fn.returns)}>`;

    const jsdocParams: string[] = [];
    if (fn.params.length > 0) {
      jsdocParams.push(` * @param params - ${desc.split('\n')[0]}`);
    }
    for (const err of abi.errors) {
      jsdocParams.push(` * @throws {ContractError} code ${err.code} — ${err.message || err.name}`);
    }

    const examples = docFn?.examples?.filter(ex => ex.language === 'typescript') || [];
    const exampleTags = examples.length > 0
      ? ` *\n${examples.map(ex => ` * @example\n${indent(`// ${ex.code.replace(/`/g, '\\`')}`, 1)}`).join('\n')}`
      : '';

    const jsdoc = `  /**\n   * ${desc.split('\n').join('\n   * ')}\n   *\n${jsdocParams.join('\n')}\n${exampleTags}\n   */`;

    const paramsCall = fn.params.length > 0 ? 'params' : '';
    return `${jsdoc}\n  async ${fn.name}(${paramNames}): ${returnType} {\n    const tx = this.contract.call(\n      '${fn.name}',\n      ${fn.params.length > 0 ? `...Object.values(params)` : '...[]'}\n    );\n    return this.server.simulate(tx) as ${returnType};\n  }`;
  }).join('\n\n');
}

function generateTypeImports(abi: ContractABI): string {
  const structs = abi.types.filter(t => t.type.kind === 'struct' || t.type.kind === 'enum');
  return structs.length > 0 ? `\n${structs.map(t => `// Type definition: ${t.name} — ${t.docs || ''}`).join('\n')}\n` : '';
}

export function generateTypeScriptSDK(opts: TypeScriptSDKOptions): SDKOutput {
  const { abi, docOutput, packageName, version, network, contractId } = opts;

  const paramInterfaces = abi.functions.map(fn => generateParamInterface(fn, docOutput?.functions.find(df => df.name === fn.name))).filter(Boolean).join('\n');
  const errorUnion = generateErrorUnion(abi.errors);
  const methods = generateMethods(abi, docOutput, contractId, network);
  const typeImports = generateTypeImports(abi);

  const networkConst = network === 'mainnet'
    ? `'Public Global Stellar Network ; September 2015'`
    : `'Test SDF Network ; September 2015'`;

  const indexContent = `import { Contract, rpc } from '@stellar/stellar-sdk';

// -- Contract types --
${paramInterfaces}

// -- Error types --
${errorUnion}
${typeImports}
// -- Contract client --
export class ${abi.name}Contract {
  private contract: Contract;
  private server: rpc.Server;

  constructor(contractId: string, networkPassphrase: string = ${networkConst}, rpcUrl: string = '${network === 'mainnet' ? 'https://soroban-rpc.mainnet.stellar.org' : 'https://soroban-rpc.testnet.stellar.org'}') {
    this.contract = new Contract(contractId);
    this.server = new rpc.Server(rpcUrl);
  }

${indent(methods, 1)}
}
`;

  const files = new Map<string, string>();
  files.set('index.ts', indexContent);

  const pkgName = packageName || `@sorodoc/${abi.name.toLowerCase()}-sdk`;
  files.set('package.json', JSON.stringify({
    name: pkgName,
    version: version || '0.1.0',
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    files: ['dist'],
    scripts: { build: 'tsc', prepublishOnly: 'npm run build' },
    dependencies: { '@stellar/stellar-sdk': '^15.0.0' },
    license: 'MIT',
  }, null, 2));

  files.set('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'Node16',
      moduleResolution: 'Node16',
      declaration: true,
      outDir: './dist',
      rootDir: '.',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['index.ts'],
  }, null, 2));

  const readme = `# ${abi.name} SDK

${abi.name} — Soroban Smart Contract SDK

**Package:** \`${pkgName}\`
${contractId ? `**Contract ID:** \`${contractId}\`` : ''}
${network ? `**Network:** ${network}` : ''}

## Installation

\`\`\`bash
npm install ${pkgName}
\`\`\`

## Quick Start

\`\`\`typescript
import { ${abi.name}Contract, ContractError } from '${pkgName}';

const contract = new ${abi.name}Contract(
  '${contractId || 'YOUR_CONTRACT_ID'}',
);

${abi.functions.length > 0 && abi.functions[0] ? `const result = await contract.${abi.functions[0].name}(${abi.functions[0].params.length > 0 && abi.functions[0] ? `{\n  ${(abi.functions[0] as any).params.map((p: { name: string; type: { kind: string } }) => `${p.name}: /* ${p.type.kind} */`).join(',\n  ')},\n}` : '/* ... */'});` : ''}
\`\`\`

## Functions

${abi.functions.map(f => `- \`${f.name}\`${f.params.length > 0 ? `(${f.params.map(p => `${p.name}: ${p.type.kind}`).join(', ')})` : '()'} → \`${f.returns.kind}\``).join('\n')}

## Errors

${abi.errors.map(e => `- \`${e.name}\` (code ${e.code})`).join('\n') || '*No contract errors defined*'}

---

*Generated by SoroDoc*
`;

  return { files, packageJson: { name: pkgName, version: version || '0.1.0' }, readme };
}
