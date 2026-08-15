import { describe, it, expect, vi } from 'vitest';
import { StrKey } from '@stellar/stellar-sdk';
import {
  fetchContractWasm,
  isValidContractId,
  getRpcUrl,
  NETWORK_RPC_URLS,
} from '../src/net/index.js';

const VALID_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));

describe('isValidContractId', () => {
  it('accepts well-formed contract IDs', () => {
    expect(isValidContractId(VALID_CONTRACT_ID)).toBe(true);
  });

  it('rejects malformed contract IDs', () => {
    expect(isValidContractId('')).toBe(false);
    expect(isValidContractId('short')).toBe(false);
    expect(isValidContractId('SDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2V2EQO2KQPV7R6R6VU')).toBe(false);
    expect(isValidContractId('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2V2EQO2KQPV7R6R60VU')).toBe(false);
    expect(isValidContractId('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2V2EQO2KQPV7R6R69VU')).toBe(false);
  });
});

describe('getRpcUrl', () => {
  it('returns the testnet RPC URL by default', () => {
    expect(getRpcUrl()).toBe('https://soroban-rpc.testnet.stellar.org');
  });

  it('returns the mainnet RPC URL', () => {
    expect(getRpcUrl('mainnet')).toBe('https://soroban-rpc.mainnet.stellar.org');
    expect(NETWORK_RPC_URLS.mainnet).toBe('https://soroban-rpc.mainnet.stellar.org');
  });
});

describe('fetchContractWasm', () => {
  it('fetches the contract WASM through the injected server', async () => {
    const wasm = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
    const server = {
      getContractWasmByContractId: vi.fn().mockResolvedValue(wasm),
    };

    const result = await fetchContractWasm({ contractId: VALID_CONTRACT_ID, server });

    expect(result.equals(wasm)).toBe(true);
    expect(server.getContractWasmByContractId).toHaveBeenCalledWith(VALID_CONTRACT_ID);
  });

  it('rejects when no WASM is returned', async () => {
    const server = {
      getContractWasmByContractId: vi.fn().mockResolvedValue(Buffer.alloc(0)),
    };

    await expect(fetchContractWasm({ contractId: VALID_CONTRACT_ID, server })).rejects.toThrow(
      `No WASM found for contract ${VALID_CONTRACT_ID}`
    );
  });

  it('rejects invalid contract IDs before contacting the server', async () => {
    await expect(fetchContractWasm({ contractId: 'invalid', server: {} as never })).rejects.toThrow(
      'Invalid contract ID format'
    );
  });
});
