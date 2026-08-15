import { rpc } from '@stellar/stellar-sdk';

export const NETWORK_RPC_URLS = {
  testnet: 'https://soroban-rpc.testnet.stellar.org',
  mainnet: 'https://soroban-rpc.mainnet.stellar.org',
} as const;

export type SorobanNetwork = keyof typeof NETWORK_RPC_URLS;

export function getRpcUrl(network: SorobanNetwork = 'testnet'): string {
  return NETWORK_RPC_URLS[network];
}

export interface RpcWasmClient {
  getContractWasmByContractId(contractId: string): Promise<Buffer>;
}

export interface FetchContractWasmOptions {
  contractId: string;
  network?: SorobanNetwork;
  rpcUrl?: string;
  server?: RpcWasmClient;
}

export function isValidContractId(contractId: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(contractId);
}

/**
 * Fetch the WASM binary of a deployed Soroban contract via Soroban RPC.
 * Uses getContractWasmByContractId, which reads the contract code ledger
 * entry for the contract's installed WASM.
 */
export async function fetchContractWasm(options: FetchContractWasmOptions): Promise<Buffer> {
  const { contractId } = options;
  if (!contractId) {
    throw new Error('contractId is required');
  }
  if (!isValidContractId(contractId)) {
    throw new Error(`Invalid contract ID format: ${contractId}. Expected a 56-character Stellar contract ID (C...)`);
  }

  const server = options.server ?? new rpc.Server(options.rpcUrl ?? getRpcUrl(options.network));
  const wasm = await server.getContractWasmByContractId(contractId);

  if (!wasm || wasm.length === 0) {
    throw new Error(`No WASM found for contract ${contractId}`);
  }
  return wasm;
}
