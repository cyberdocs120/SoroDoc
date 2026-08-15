import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { xdr } from '@stellar/stellar-sdk';
import { resolveContracts, resolveOutDir, slugify, runGenerate } from '../src/commands/generate.js';

function makeInput(name: string, type: xdr.ScSpecTypeDef): xdr.ScSpecFunctionInputV0 {
  const input = new xdr.ScSpecFunctionInputV0();
  input.doc('');
  input.name(name);
  input.type(type);
  return input;
}

function makeFunc(name: string, inputs: xdr.ScSpecFunctionInputV0[], outputs: xdr.ScSpecTypeDef[]): xdr.ScSpecFunctionV0 {
  const func = new xdr.ScSpecFunctionV0();
  func.doc('');
  func.name(name);
  func.inputs(inputs);
  func.outputs(outputs);
  return func;
}

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

function makeTransferWasm(): Buffer {
  const entry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
    makeFunc('transfer', [
      makeInput('to', xdr.ScSpecTypeDef.scSpecTypeAddress()),
      makeInput('amount', xdr.ScSpecTypeDef.scSpecTypeI128()),
    ], [xdr.ScSpecTypeDef.scSpecTypeVoid()]),
  );
  return buildMinimalWasm([entry]);
}

describe('slugify', () => {
  it('converts names to lowercase slug paths', () => {
    expect(slugify('Token')).toBe('token');
    expect(slugify('My Awesome Contract')).toBe('my-awesome-contract');
    expect(slugify('ATOM-v2')).toBe('atom-v2');
  });
});

describe('resolveContracts', () => {
  it('builds a single target from CLI flags', () => {
    const targets = resolveContracts({ wasm: './token.wasm', name: 'Token' }, {}, undefined);
    expect(targets).toHaveLength(1);
    expect(targets[0]!.name).toBe('Token');
    expect(targets[0]!.wasm).toBe(path.resolve('./token.wasm'));
    expect(targets[0]!.network).toBe('testnet');
  });

  it('resolves config contract paths relative to the config file', () => {
    const configDir = '/tmp/some/project';
    const configPath = path.join(configDir, 'sorodoc.config.json');
    const config = {
      contracts: [
        { name: 'Token', wasm: './token.wasm', source: 'src/lib.rs' },
        { name: 'Escrow', wasm: '/abs/path/escrow.wasm' },
      ],
    };

    const targets = resolveContracts({}, config, configPath);

    expect(targets).toHaveLength(2);
    expect(targets[0]!.wasm).toBe(path.join(configDir, 'token.wasm'));
    expect(targets[0]!.source).toBe(path.join(configDir, 'src/lib.rs'));
    expect(targets[1]!.wasm).toBe('/abs/path/escrow.wasm');
  });

  it('picks the deployed contract ID and network from the config', () => {
    const config = {
      contracts: [
        { name: 'Token', deployedId: { mainnet: 'CMAINNET123456' } },
      ],
    };
    const targets = resolveContracts({}, config, undefined);
    expect(targets[0]!.contractId).toBe('CMAINNET123456');
    expect(targets[0]!.network).toBe('mainnet');
  });

  it('returns no targets when nothing is specified', () => {
    expect(resolveContracts({}, {}, undefined)).toHaveLength(0);
  });
});

describe('resolveOutDir', () => {
  it('resolves output dirs relative to the config file', () => {
    const configDir = '/tmp/proj';
    expect(resolveOutDir(undefined, 'site', path.join(configDir, 'sorodoc.config.json'))).toBe(path.join(configDir, 'site'));
    expect(resolveOutDir(undefined, '/abs/site', path.join(configDir, 'sorodoc.config.json'))).toBe('/abs/site');
  });

  it('defaults to ./docs', () => {
    expect(resolveOutDir(undefined, undefined, undefined)).toBe(path.resolve('./docs'));
    expect(resolveOutDir('./out', undefined, undefined)).toBe(path.resolve('./out'));
  });
});

describe('runGenerate (multi-contract)', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sorodoc-generate-'));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('generates docs for multiple config contracts into slug subdirectories with an index', async () => {
    const wasmPath = path.join(projectDir, 'token.wasm');
    fs.writeFileSync(wasmPath, makeTransferWasm());

    const configPath = path.join(projectDir, 'sorodoc.config.json');
    const config = {
      project: { name: 'My DeFi Suite', version: '1.0.0', description: 'Documentation for my contracts' },
      contracts: [
        { name: 'Token', wasm: './token.wasm' },
        { name: 'Escrow', wasm: './token.wasm' },
      ],
      ai: { enabled: false },
      output: { formats: ['markdown'], outputDir: 'docs' },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    await runGenerate({ config: configPath });

    const tokenIndex = path.join(projectDir, 'docs/token/markdown/index.md');
    const escrowIndex = path.join(projectDir, 'docs/escrow/markdown/index.md');
    const readme = path.join(projectDir, 'docs/README.md');

    expect(fs.existsSync(tokenIndex)).toBe(true);
    expect(fs.existsSync(escrowIndex)).toBe(true);
    expect(fs.readFileSync(tokenIndex, 'utf8')).toContain('# Token');
    expect(fs.existsSync(readme)).toBe(true);

    const readmeContent = fs.readFileSync(readme, 'utf8');
    expect(readmeContent).toContain('My DeFi Suite');
    expect(readmeContent).toContain('./token/markdown/index.md');
    expect(readmeContent).toContain('./escrow/markdown/index.md');
  });

  it('fails when no contracts are configured', async () => {
    const configPath = path.join(projectDir, 'sorodoc.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        project: { name: 'Empty', version: '1.0.0', description: 'no contracts' },
        contracts: [],
        ai: { enabled: false },
      }),
    );

    await expect(runGenerate({ config: configPath })).rejects.toThrow(/No contracts specified/);
  });
});
