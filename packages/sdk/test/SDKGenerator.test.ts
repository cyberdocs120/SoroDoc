import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { xdr } from '@stellar/stellar-sdk';
import { SDKGenerator, SoroDoc, type SDKLanguage } from '../src/index.js';

const { mockFetchContractWasm } = vi.hoisted(() => ({ mockFetchContractWasm: vi.fn() }));

vi.mock('@sorodoc/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sorodoc/core')>();
  return {
    ...actual,
    fetchContractWasm: mockFetchContractWasm,
  };
});

function makeABI() {
  return {
    name: 'Token',
    version: '1.0.0',
    functions: [
      {
        name: 'transfer',
        params: [
          { name: 'to', type: { kind: 'address' } },
          { name: 'amount', type: { kind: 'i128' } },
        ],
        returns: { kind: 'void' },
        docs: 'Transfers tokens.',
      },
    ],
    events: [],
    errors: [],
    types: [],
  };
}

// ---------------------------------------------------------------------------
// WASM builder (contractspec custom section)
// ---------------------------------------------------------------------------

function encodeLEB128(value: number): Buffer {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return Buffer.from(bytes);
}

function makeInput(name: string, type: xdr.ScSpecTypeDef): xdr.ScSpecFunctionInputV0 {
  const input = new xdr.ScSpecFunctionInputV0();
  input.doc('');
  input.name(name);
  input.type(type);
  return input;
}

function makeFunc(name: string): xdr.ScSpecFunctionV0 {
  const func = new xdr.ScSpecFunctionV0();
  func.doc('');
  func.name(name);
  func.inputs([
    makeInput('to', xdr.ScSpecTypeDef.scSpecTypeAddress()),
    makeInput('amount', xdr.ScSpecTypeDef.scSpecTypeI128()),
  ]);
  func.outputs([xdr.ScSpecTypeDef.scSpecTypeVoid()]);
  return func;
}

function buildMinimalWasm(specEntries: xdr.ScSpecEntry[]): Buffer {
  const specData = Buffer.concat(specEntries.map((e) => e.toXDR()));
  const nameBuf = Buffer.from('contractspecv0', 'utf8');
  const nameLen = encodeLEB128(nameBuf.length);
  const sectionLen = encodeLEB128(nameLen.length + nameBuf.length + specData.length);
  const sectionId = Buffer.from([0x00]);
  const magic = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
  const version = Buffer.from([0x01, 0x00, 0x00, 0x00]);
  return Buffer.concat([magic, version, sectionId, sectionLen, nameLen, nameBuf, specData]);
}

// ---------------------------------------------------------------------------
// SDKGenerator
// ---------------------------------------------------------------------------

describe('SDKGenerator', () => {
  const abi = makeABI();

  it('generates a TypeScript SDK by default', () => {
    const generator = new SDKGenerator({ abi, language: 'typescript' });

    const output = generator.generate();

    expect(output).toBeDefined();
    expect(output.files).toBeInstanceOf(Map);
    expect(output.files.has('index.ts')).toBe(true);
    expect(output.files.get('index.ts')).toContain('export class TokenContract');
  });

  it('generates a Python SDK', () => {
    const generator = new SDKGenerator({ abi, language: 'python' });

    const output = generator.generate('python');

    expect(output.files).toBeInstanceOf(Map);
    expect(output.files.has('contract.py')).toBe(true);
    expect(output.files.get('contract.py')).toContain('class TokenContract:');
  });

  it('generates a Rust client', () => {
    const generator = new SDKGenerator({ abi, language: 'rust' });

    const output = generator.generate('rust');

    expect(output.files).toBeInstanceOf(Map);
    expect(output.files.has('src/lib.rs')).toBe(true);
    expect(output.files.get('src/lib.rs')).toContain('pub struct TokenClient');
  });

  it('generates React hooks', () => {
    const generator = new SDKGenerator({ abi, language: 'react' });

    const output = generator.generate('react');

    expect(output.files).toBeInstanceOf(Map);
    expect(output.files.has('hooks.tsx')).toBe(true);
    expect(output.files.get('hooks.tsx')).toContain('useTransfer');
    expect(output.files.get('hooks.tsx')).toContain('useContractCall');
  });

  it('applies the provided package name', () => {
    const generator = new SDKGenerator({ abi, packageName: '@custom/token-sdk' });

    const output = generator.generate('typescript');

    expect(output.files.get('package.json')).toContain('@custom/token-sdk');
  });

  it('throws on unsupported languages', () => {
    const generator = new SDKGenerator({ abi, language: 'typescript' });

    expect(() => generator.generate('go' as SDKLanguage)).toThrow('Unsupported language: go');
  });
});

// ---------------------------------------------------------------------------
// SoroDoc
// ---------------------------------------------------------------------------

describe('SoroDoc', () => {
  const wasm = buildMinimalWasm([
    xdr.ScSpecEntry.scSpecEntryFunctionV0(makeFunc('transfer')),
  ]);

  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sorodoc-sdk-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates docs and requested SDKs', async () => {
    const sorodoc = new SoroDoc();

    const result = await sorodoc.generate({
      wasm,
      contractName: 'Token',
      options: { sdks: ['typescript', 'python'] },
    });

    expect(result.functions).toHaveLength(1);
    expect(result.functions[0]!.name).toBe('transfer');
    expect(Object.keys(result.sdk)).toEqual(['typescript', 'python']);
  });

  it('returns an empty sdk map when no SDKs requested', async () => {
    const sorodoc = new SoroDoc();

    const result = await sorodoc.generate({
      wasm,
      contractName: 'Token',
    });

    expect(result.sdk).toEqual({});
  });

  it('returns AI documentation output and markdown', async () => {
    const sorodoc = new SoroDoc();

    const result = await sorodoc.generate({
      wasm,
      contractName: 'Token',
    });

    expect(result.docs.contractName).toBe('Token');
    expect(result.docs.overview).toContain('Soroban');
    expect(result.docs.functions).toHaveLength(1);
    expect(result.docs.markdown).toContain('# Token');
    expect(result.markdownFiles.has('index.md')).toBe(true);
    expect(result.markdownFiles.has('functions/transfer.md')).toBe(true);
  });

  it('returns an OpenAPI 3.1 spec', async () => {
    const sorodoc = new SoroDoc();

    const result = await sorodoc.generate({
      wasm,
      contractName: 'Token',
    });

    expect(result.openapi).not.toBeNull();
    expect(result.openapi!['openapi']).toBe('3.1.0');
    expect(result.openapi!['paths']).toHaveProperty('/invoke/transfer');
  });

  it('skips the OpenAPI spec when openapi is disabled', async () => {
    const sorodoc = new SoroDoc();

    const result = await sorodoc.generate({
      wasm,
      contractName: 'Token',
      options: { openapi: false },
    });

    expect(result.openapi).toBeNull();
  });

  it('writeTo writes markdown, SDKs, and openapi to a directory', async () => {
    const sorodoc = new SoroDoc();

    const result = await sorodoc.generate({
      wasm,
      contractName: 'Token',
      options: { sdks: ['typescript'] },
    });

    await result.writeTo(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'markdown/index.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'markdown/functions/transfer.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'sdk/typescript/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'sdk/typescript/README.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'openapi.json'))).toBe(true);
  });

  it('fetches a deployed contract via Soroban RPC and generates docs', async () => {
    mockFetchContractWasm.mockResolvedValue(wasm);
    const sorodoc = new SoroDoc();

    const result = await sorodoc.generateFromDeployed({
      contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2V2EQO2KQPV7R6R6VU',
      network: 'testnet',
      contractName: 'Token',
      options: { sdks: ['typescript'] },
    });

    expect(mockFetchContractWasm).toHaveBeenCalledWith({
      contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2V2EQO2KQPV7R6R6VU',
      network: 'testnet',
      rpcUrl: undefined,
    });
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0]!.name).toBe('transfer');
    expect(Object.keys(result.sdk)).toEqual(['typescript']);
  });

  it('propagates errors from the Soroban RPC fetch', async () => {
    mockFetchContractWasm.mockRejectedValue(new Error('No WASM found for contract'));
    const sorodoc = new SoroDoc();

    await expect(
      sorodoc.generateFromDeployed({
        contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2V2EQO2KQPV7R6R6VU',
        network: 'testnet',
        contractName: 'Token',
      })
    ).rejects.toThrow('No WASM found for contract');
  });
});
