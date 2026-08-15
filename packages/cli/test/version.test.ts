import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { xdr } from '@stellar/stellar-sdk';
import {
  tagVersion,
  listVersions,
  findVersion,
  diffVersions,
  fmtSignature,
  getVersionsDir,
} from '../src/commands/version.js';

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

function makeBalanceWasm(): Buffer {
  const entry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
    makeFunc('balance', [], [xdr.ScSpecTypeDef.scSpecTypeI128()]),
  );
  return buildMinimalWasm([entry]);
}

describe('version tagging', () => {
  let homeDir: string;

  beforeEach(() => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sorodoc-versions-'));
    process.env.SORODOC_HOME = homeDir;
  });

  afterEach(() => {
    fs.rmSync(homeDir, { recursive: true, force: true });
    delete process.env.SORODOC_HOME;
  });

  it('tags a version from a WASM binary capturing the real ABI', () => {
    const wasmPath = path.join(homeDir, 'token.wasm');
    fs.writeFileSync(wasmPath, makeTransferWasm());

    const meta = tagVersion('1.0.0', { wasm: wasmPath, name: 'Token' });

    expect(meta.functions).toBe(1);
    expect(meta.events).toBe(0);
    expect(meta.errors).toBe(0);
    expect(meta.functionNames).toEqual(['transfer']);
    expect(meta.functionSigs['transfer']).toBe('transfer(to: address, amount: i128) → void');
    expect(meta.contractId).toBeUndefined();

    const file = path.join(getVersionsDir(), '1.0.0.json');
    expect(fs.existsSync(file)).toBe(true);
  });

  it('tags an empty version when no wasm is given', () => {
    const meta = tagVersion('0.0.1');
    expect(meta.functions).toBe(0);
    expect(meta.functionNames).toEqual([]);
  });

  it('rejects duplicate version tags', () => {
    tagVersion('1.0.0');
    expect(() => tagVersion('1.0.0')).toThrow(/already exists/);
  });

  it('throws when the wasm file is missing', () => {
    expect(() => tagVersion('1.0.0', { wasm: path.join(homeDir, 'nope.wasm') })).toThrow(/WASM file not found/);
  });

  it('lists versions newest first', () => {
    tagVersion('1.0.0', { wasm: (() => { const p = path.join(homeDir, 'a.wasm'); fs.writeFileSync(p, makeTransferWasm()); return p; })() });
    tagVersion('2.0.0', { wasm: (() => { const p = path.join(homeDir, 'b.wasm'); fs.writeFileSync(p, makeBalanceWasm()); return p; })() });

    const versions = listVersions();
    expect(versions).toHaveLength(2);
    expect(versions[0]!.name).toBe('2.0.0');
  });

  it('diffs function signatures across versions', () => {
    const aPath = path.join(homeDir, 'a.wasm');
    const bPath = path.join(homeDir, 'b.wasm');
    fs.writeFileSync(aPath, makeTransferWasm());
    fs.writeFileSync(bPath, makeBalanceWasm());

    tagVersion('1.0.0', { wasm: aPath });
    tagVersion('2.0.0', { wasm: bPath });

    const diff = diffVersions('1.0.0', '2.0.0');
    expect(diff.removed).toEqual(['transfer']);
    expect(diff.added).toEqual(['balance']);
    expect(diff.changed).toEqual([]);
  });

  it('detects signature changes for a modified function', () => {
    const aPath = path.join(homeDir, 'a.wasm');
    fs.writeFileSync(aPath, makeTransferWasm());
    tagVersion('1.0.0', { wasm: aPath });

    const changedWasm = buildMinimalWasm([
      xdr.ScSpecEntry.scSpecEntryFunctionV0(
        makeFunc('transfer', [
          makeInput('to', xdr.ScSpecTypeDef.scSpecTypeAddress()),
          makeInput('amount', xdr.ScSpecTypeDef.scSpecTypeI128()),
          makeInput('memo', xdr.ScSpecTypeDef.scSpecTypeString()),
        ], [xdr.ScSpecTypeDef.scSpecTypeVoid()]),
      ),
    ]);
    const bPath = path.join(homeDir, 'b.wasm');
    fs.writeFileSync(bPath, changedWasm);
    tagVersion('2.0.0', { wasm: bPath });

    const diff = diffVersions('1.0.0', '2.0.0');
    expect(diff.changed).toEqual(['transfer']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('throws when diffing unknown versions', () => {
    expect(() => diffVersions('1.0.0', '2.0.0')).toThrow('Version "1.0.0" not found');
  });

  it('formats signatures for display', () => {
    const sig = fmtSignature({
      name: 'transfer',
      params: [
        { name: 'to', type: { kind: 'address' } },
        { name: 'amount', type: { kind: 'i128' } },
      ],
      returns: { kind: 'void' },
    });
    expect(sig).toBe('transfer(to: address, amount: i128) → void');
  });

  it('finds a version by name', () => {
    tagVersion('3.0.0');
    const found = findVersion('3.0.0');
    expect(found?.name).toBe('3.0.0');
    expect(findVersion('missing')).toBeUndefined();
  });
});
