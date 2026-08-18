import { type ContractABI, type FunctionSpec, type ErrorSpec, type DocOutput, type DocFunction, type SDKOutput } from '../types.js';

export interface ReactHooksOptions {
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

function indent(text: string, level: number): string {
  const prefix = '  '.repeat(level);
  return text.split('\n').map(l => l ? prefix + l : '').join('\n');
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

function generateUseContractCallHook(fn: FunctionSpec, abi: ContractABI, docFn?: DocFunction): string {
  const desc = docFn?.description || fn.docs || `${fn.name} — contract function.`;
  const hasParams = fn.params.length > 0;
  const returnType = fn.returns.kind === 'void' ? 'void' : sorobanToTS(fn.returns);
  const paramType = hasParams ? `${capitalize(fn.name)}Params` : 'void';

  const errorRefs = abi.errors.length > 0
    ? `\n * @throws {ContractError} — ${abi.errors.map(e => `${e.name} (code ${e.code})`).join(', ')}`
    : '';

  const jsdocParams = hasParams ? ` * @param params - ${desc.split('\n')[0]}\n` : '';

  return `/**
 * ${desc.split('\n').join('\n * ')}
 *
${jsdocParams}${errorRefs}
 * @returns Mutation result with the invoked function's return value
 */
export function use${capitalize(fn.name)}(config?: UseContractCallConfig) {
  return useContractCall<${returnType}, ${paramType}>({
    functionName: '${fn.name}',
    ...config,
  });
}`;
}

function generateUseContractQueryHook(fn: FunctionSpec, abi: ContractABI, docFn?: DocFunction): string {
  const desc = docFn?.description || fn.docs || `${fn.name} — read-only contract query.`;
  const hasParams = fn.params.length > 0;
  const returnType = fn.returns.kind === 'void' ? 'void' : sorobanToTS(fn.returns);
  const paramType = hasParams ? `${capitalize(fn.name)}Params` : 'void';

  return `/**
 * ${desc.split('\n').join('\n * ')}
 * Read-only query — does not submit a transaction.
 */
export function use${capitalize(fn.name)}Query(
  ${hasParams ? `params: ${paramType}` : ''}
  config?: UseContractQueryConfig
) {
  return useContractQuery<${returnType}>({
    functionName: '${fn.name}',
    ${hasParams ? 'params,' : ''}
    ...config,
  });
}`;
}

function generateHooksContent(abi: ContractABI, docOutput?: DocOutput, contractId?: string, network?: string): string {
  const docMap = new Map<string, DocFunction>();
  if (docOutput) {
    for (const fn of docOutput.functions) {
      docMap.set(fn.name, fn);
    }
  }

  const paramInterfaces = abi.functions
    .map(fn => generateParamInterface(fn, docMap.get(fn.name)))
    .filter(Boolean)
    .join('\n');

  const errorUnion = generateErrorUnion(abi.errors);

  const mutationHooks = abi.functions
    .map(fn => generateUseContractCallHook(fn, abi, docMap.get(fn.name)))
    .join('\n\n');

  const queryHooks = abi.functions
    .filter(fn => fn.returns.kind !== 'void')
    .map(fn => generateUseContractQueryHook(fn, abi, docMap.get(fn.name)))
    .join('\n\n');

  const networkConst = network === 'mainnet'
    ? `'Public Global Stellar Network ; September 2015'`
    : `'Test SDF Network ; September 2015'`;

  return `import { useCallback, useState } from 'react';
import { Contract, rpc } from '@stellar/stellar-sdk';

// -- Types --
${paramInterfaces}

// -- Errors --
${errorUnion}

// -- Configuration --
export interface UseContractCallConfig {
  contractId?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
}

export interface UseContractQueryConfig {
  contractId?: string;
  networkPassphrase?: string;
  rpcUrl?: string;
}

export interface ContractCallResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  invoke: (params?: Record<string, unknown>) => Promise<T | void>;
}

export interface ContractQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<T | void>;
}

// -- Provider Context --
export interface SorobanContractProviderProps {
  contractId: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  children: React.ReactNode;
}

const DEFAULT_RPC_URL = '${network === 'mainnet' ? 'https://soroban-rpc.mainnet.stellar.org' : 'https://soroban-rpc.testnet.stellar.org'}';
const DEFAULT_NETWORK = ${networkConst};

let _globalContractId = '${contractId || ''}';
let _globalNetwork = DEFAULT_NETWORK;
let _globalRpcUrl = DEFAULT_RPC_URL;

export function configureContract(opts: { contractId?: string; networkPassphrase?: string; rpcUrl?: string }) {
  if (opts.contractId) _globalContractId = opts.contractId;
  if (opts.networkPassphrase) _globalNetwork = opts.networkPassphrase;
  if (opts.rpcUrl) _globalRpcUrl = opts.rpcUrl;
}

// -- Hooks --
function resolveConfig(config?: UseContractCallConfig) {
  return {
    contractId: config?.contractId || _globalContractId,
    networkPassphrase: config?.networkPassphrase || _globalNetwork,
    rpcUrl: config?.rpcUrl || _globalRpcUrl,
  };
}

function useContractCall<R, P = void>(opts: { functionName: string } & UseContractCallConfig): ContractCallResult<R> {
  const [data, setData] = useState<R | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(async (params?: Record<string, unknown>): Promise<R | void> => {
    const cfg = resolveConfig(opts);
    setLoading(true);
    setError(null);
    try {
      const contract = new Contract(cfg.contractId);
      const server = new rpc.Server(cfg.rpcUrl);
      const tx = contract.call(opts.functionName, ...Object.values(params || {}));
      const result = await server.simulate(tx);
      setData(result as R);
      return result as R;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [opts.functionName, opts.contractId, opts.networkPassphrase, opts.rpcUrl]);

  return { data, loading, error, invoke };
}

function useContractQuery<R>(opts: { functionName: string; params?: Record<string, unknown> } & UseContractQueryConfig): ContractQueryResult<R> {
  const [data, setData] = useState<R | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuery = useCallback(async (): Promise<R | void> => {
    const cfg = resolveConfig(opts);
    setLoading(true);
    setError(null);
    try {
      const contract = new Contract(cfg.contractId);
      const server = new rpc.Server(cfg.rpcUrl);
      const tx = contract.call(opts.functionName, ...Object.values(opts.params || {}));
      const result = await server.simulate(tx);
      setData(result as R);
      return result as R;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [opts.functionName, opts.contractId, opts.networkPassphrase, opts.rpcUrl]);

  return { data, loading, error, refetch: fetchQuery };
}

// -- Generated Hooks --
${mutationHooks}

${queryHooks}
`;
}

export function generateReactHooks(opts: ReactHooksOptions): SDKOutput {
  const { abi, docOutput, packageName, version, network, contractId } = opts;

  const indexContent = generateHooksContent(abi, docOutput, contractId, network);

  const files = new Map<string, string>();
  files.set('hooks.tsx', indexContent);

  const pkgName = packageName || `@sorodoc/${abi.name.toLowerCase()}-react`;
  files.set('package.json', JSON.stringify({
    name: pkgName,
    version: version || '0.1.0',
    type: 'module',
    main: './dist/hooks.js',
    types: './dist/hooks.d.ts',
    files: ['dist'],
    scripts: { build: 'tsc', prepublishOnly: 'npm run build' },
    dependencies: {
      react: '^18.3.0',
      '@stellar/stellar-sdk': '^15.0.0',
    },
    peerDependencies: {
      react: '^18.0.0',
    },
    license: 'MIT',
  }, null, 2));

  files.set('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'Node16',
      moduleResolution: 'Node16',
      jsx: 'react-jsx',
      declaration: true,
      outDir: './dist',
      rootDir: '.',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['hooks.tsx'],
  }, null, 2));

  const readme = `# ${abi.name} React Hooks

${abi.name} — Soroban Smart Contract React Hooks

**Package:** \`${pkgName}\`
${contractId ? `**Contract ID:** \`${contractId}\`` : ''}
${network ? `**Network:** ${network}` : ''}

## Installation

\`\`\`bash
npm install ${pkgName}
\`\`\`

## Quick Start

\`\`\`tsx
import { configureContract, use${abi.functions[0] ? capitalize(abi.functions[0].name) : 'Transfer'} } from '${pkgName}';

// Configure once at the app root
configureContract({ contractId: '${contractId || 'YOUR_CONTRACT_ID'}' });

// Use in components
function TransferButton() {
  const { invoke, loading } = use${abi.functions[0] ? capitalize(abi.functions[0].name) : 'Transfer'}();

  return (
    <button onClick={() => invoke({ from: '...', to: '...', amount: BigInt(100) })} disabled={loading}>
      {loading ? 'Sending...' : 'Transfer'}
    </button>
  );
}
\`\`\`

## Available Hooks

${abi.functions.map(f => `- \`use${capitalize(f.name)}\` — ${f.docs || f.name}`).join('\n')}

${abi.errors.length > 0 ? `## Errors\n\n${abi.errors.map(e => `- \`${e.name}\` (code ${e.code})`).join('\n')}` : ''}

---

*Generated by SoroDoc*
`;

  return { files, packageJson: { name: pkgName, version: version || '0.1.0' }, readme };
}
