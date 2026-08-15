import { describe, it, expect } from 'vitest';
import { xdr } from '@stellar/stellar-sdk';
import { parseContract } from '../src/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Reuse helpers from ABIParser.test.ts (or copy them here if they are not exported)
// For now, I'll copy the minimal needed ones.

function makeInput(name: string, type: xdr.ScSpecTypeDef): xdr.ScSpecFunctionInputV0 {
  const input = new xdr.ScSpecFunctionInputV0();
  input.doc('');
  input.name(name);
  input.type(type);
  return input;
}

function makeFunc(
  name: string,
  inputs: xdr.ScSpecFunctionInputV0[],
  outputs: xdr.ScSpecTypeDef[],
): xdr.ScSpecFunctionV0 {
  const func = new xdr.ScSpecFunctionV0();
  func.doc('');
  func.name(name);
  func.inputs(inputs);
  func.outputs(outputs);
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

describe('Integration: parseContract', () => {
  it('combines ABI data and source documentation', () => {
    // 1. Prepare WASM
    const entry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      makeFunc('transfer', [
        makeInput('to', xdr.ScSpecTypeDef.scSpecTypeAddress()),
        makeInput('amount', xdr.ScSpecTypeDef.scSpecTypeI128()),
      ], [xdr.ScSpecTypeDef.scSpecTypeVoid()]),
    );
    const wasm = buildMinimalWasm([entry]);

    // 2. Prepare Source
    const sourceContent = `
/// Transfers tokens to a recipient.
/// @sorodoc:category Finance
/// @sorodoc:since 1.0.0
/// @sorodoc:example-highlight
pub fn transfer(e: Env, to: Address, amount: i128) {
    // implementation
}
`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sorodoc-test-'));
    const sourcePath = path.join(tmpDir, 'lib.rs');
    fs.writeFileSync(sourcePath, sourceContent);

    try {
      const result = parseContract({
        wasm,
        source: sourcePath,
        contractName: 'TestContract'
      });

      expect(result.name).toBe('TestContract');
      expect(result.functions).toHaveLength(1);
      const fn = result.functions[0]!;
      expect(fn.name).toBe('transfer');
      expect(fn.docs).toBe('Transfers tokens to a recipient.');
      expect(fn.category).toBe('Finance');
      expect(fn.since).toBe('1.0.0');
      expect(fn.isHighlighted).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('enriches events and errors from source doc comments', () => {
    const funcEntry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      makeFunc('transfer', [
        makeInput('to', xdr.ScSpecTypeDef.scSpecTypeAddress()),
        makeInput('amount', xdr.ScSpecTypeDef.scSpecTypeI128()),
      ], [xdr.ScSpecTypeDef.scSpecTypeVoid()]),
    );

    const eventParam = new xdr.ScSpecEventParamV0();
    eventParam.doc('');
    eventParam.name('amount');
    eventParam.type(xdr.ScSpecTypeDef.scSpecTypeI128());
    eventParam.location(xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationData());
    const event = new xdr.ScSpecEventV0();
    event.doc('');
    event.lib('');
    event.name('Transfer');
    event.prefixTopics([Buffer.from('transfer', 'utf8')]);
    event.params([eventParam]);
    event.dataFormat(xdr.ScSpecEventDataFormat.scSpecEventDataFormatVec());
    const eventEntry = xdr.ScSpecEntry.scSpecEntryEventV0(event);

    const errorEnum = new xdr.ScSpecUdtErrorEnumV0();
    errorEnum.doc('');
    errorEnum.lib('');
    errorEnum.name('ContractError');
    const ec = new xdr.ScSpecUdtErrorEnumCaseV0();
    ec.doc('');
    ec.name('InsufficientBalance');
    ec.value(1);
    errorEnum.cases([ec]);
    const errorEntry = xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(errorEnum);

    const wasm = buildMinimalWasm([funcEntry, eventEntry, errorEntry]);
    const sourceContent = `
/// Transfers tokens to a recipient.
/// @sorodoc:event Transfer
/// @sorodoc:event-description Emitted when tokens move between accounts.
pub fn transfer(e: Env, to: Address, amount: i128) {
    // implementation
}

#[contracterror]
pub enum ContractError {
    /// The sender does not have enough balance to complete the transfer.
    InsufficientBalance,
}
`;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sorodoc-test-'));
    const sourcePath = path.join(tmpDir, 'lib.rs');
    fs.writeFileSync(sourcePath, sourceContent);

    try {
      const result = parseContract({ wasm, source: sourcePath, contractName: 'TestContract' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.name).toBe('Transfer');
      expect(result.events[0]!.description).toBe(
        'Emitted when tokens move between accounts.',
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.name).toBe('InsufficientBalance');
      expect(result.errors[0]!.description).toBe(
        'The sender does not have enough balance to complete the transfer.',
      );
      expect(result.errors[0]!.message).toBe(
        'The sender does not have enough balance to complete the transfer.',
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
