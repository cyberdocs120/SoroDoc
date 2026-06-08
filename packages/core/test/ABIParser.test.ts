import { describe, it, expect } from 'vitest';
import { xdr } from '@stellar/stellar-sdk';
import { ABIParser } from '../src/parser/ABIParser.js';

// ---------------------------------------------------------------------------
// XDR construction helpers
// ---------------------------------------------------------------------------

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

function makeEventParam(
  name: string,
  type: xdr.ScSpecTypeDef,
  location: xdr.ScSpecEventParamLocationV0,
): xdr.ScSpecEventParamV0 {
  const p = new xdr.ScSpecEventParamV0();
  p.doc('');
  p.name(name);
  p.type(type);
  p.location(location);
  return p;
}

function makeEvent(
  name: string,
  prefixTopics: Buffer[],
  params: xdr.ScSpecEventParamV0[],
): xdr.ScSpecEventV0 {
  const event = new xdr.ScSpecEventV0();
  event.doc('');
  event.lib('');
  event.name(name);
  event.prefixTopics(prefixTopics);
  event.params(params);
  event.dataFormat(xdr.ScSpecEventDataFormat.scSpecEventDataFormatVec());
  return event;
}

function makeErrorEnum(name: string, cases: Array<{ name: string; value: number }>): xdr.ScSpecUdtErrorEnumV0 {
  const ee = new xdr.ScSpecUdtErrorEnumV0();
  ee.doc('');
  ee.lib('');
  ee.name(name);
  ee.cases(
    cases.map((c) => {
      const ec = new xdr.ScSpecUdtErrorEnumCaseV0();
      ec.doc('');
      ec.name(c.name);
      ec.value(c.value);
      return ec;
    }),
  );
  return ee;
}

function makeStruct(name: string, fields: Array<{ name: string; type: xdr.ScSpecTypeDef }>): xdr.ScSpecUdtStructV0 {
  const s = new xdr.ScSpecUdtStructV0();
  s.doc('');
  s.lib('');
  s.name(name);
  s.fields(
    fields.map((f) => {
      const sf = new xdr.ScSpecUdtStructFieldV0();
      sf.doc('');
      sf.name(f.name);
      sf.type(f.type);
      return sf;
    }),
  );
  return s;
}

/** Create an Option<T> ScSpecTypeDef. */
function opt(inner: xdr.ScSpecTypeDef): xdr.ScSpecTypeDef {
  const s = new xdr.ScSpecTypeOption();
  s.valueType(inner);
  return xdr.ScSpecTypeDef.scSpecTypeOption(s);
}

/** Create a Result<Ok, Err> ScSpecTypeDef. */
function res(okType: xdr.ScSpecTypeDef, errType: xdr.ScSpecTypeDef): xdr.ScSpecTypeDef {
  const s = new xdr.ScSpecTypeResult();
  s.okType(okType);
  s.errorType(errType);
  return xdr.ScSpecTypeDef.scSpecTypeResult(s);
}

/** Create a Vec<T> ScSpecTypeDef. */
function vec(element: xdr.ScSpecTypeDef): xdr.ScSpecTypeDef {
  const s = new xdr.ScSpecTypeVec();
  s.elementType(element);
  return xdr.ScSpecTypeDef.scSpecTypeVec(s);
}

/** Create a Map<K,V> ScSpecTypeDef. */
function mapType(key: xdr.ScSpecTypeDef, value: xdr.ScSpecTypeDef): xdr.ScSpecTypeDef {
  const m = new xdr.ScSpecTypeMap();
  m.keyType(key);
  m.valueType(value);
  return xdr.ScSpecTypeDef.scSpecTypeMap(m);
}

// ---------------------------------------------------------------------------
// WASM builder
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ABIParser', () => {
  it('parses a function spec from WASM contractspec section', () => {
    const entry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      makeFunc('transfer', [
        makeInput('from', xdr.ScSpecTypeDef.scSpecTypeAddress()),
        makeInput('to', xdr.ScSpecTypeDef.scSpecTypeAddress()),
        makeInput('amount', xdr.ScSpecTypeDef.scSpecTypeI128()),
      ], [xdr.ScSpecTypeDef.scSpecTypeVoid()]),
    );

    const wasm = buildMinimalWasm([entry]);
    const parser = new ABIParser();
    const result = parser.parse({ wasm, contractName: 'Token' });

    expect(result.name).toBe('Token');
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0]!.name).toBe('transfer');
    expect(result.functions[0]!.params).toHaveLength(3);
    expect(result.functions[0]!.params[0]!.name).toBe('from');
    expect(result.functions[0]!.params[0]!.type.kind).toBe('address');
    expect(result.functions[0]!.returns.kind).toBe('void');
  });

  it('parses an event spec', () => {
    const params = [
      makeEventParam('name', xdr.ScSpecTypeDef.scSpecTypeSymbol(),
        xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationTopicList()),
      makeEventParam('from', xdr.ScSpecTypeDef.scSpecTypeAddress(),
        xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationTopicList()),
      makeEventParam('to', xdr.ScSpecTypeDef.scSpecTypeAddress(),
        xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationData()),
      makeEventParam('amount', xdr.ScSpecTypeDef.scSpecTypeI128(),
        xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationData()),
    ];

    const entry = xdr.ScSpecEntry.scSpecEntryEventV0(
      makeEvent('Transfer', [Buffer.from('transfer', 'utf8'), Buffer.from('from', 'utf8')], params),
    );

    const wasm = buildMinimalWasm([entry]);
    const parser = new ABIParser();
    const result = parser.parse({ wasm });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.name).toBe('Transfer');
    expect(result.events[0]!.topics).toHaveLength(4);
    expect(result.events[0]!.data).toHaveLength(2);
    expect(result.events[0]!.data[1]!.type.kind).toBe('i128');
  });

  it('parses an error enum', () => {
    const entry = xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(
      makeErrorEnum('ContractError', [
        { name: 'InsufficientBalance', value: 1 },
        { name: 'Unauthorized', value: 2 },
      ]),
    );

    const wasm = buildMinimalWasm([entry]);
    const parser = new ABIParser();
    const result = parser.parse({ wasm });

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.name).toBe('InsufficientBalance');
    expect(result.errors[0]!.code).toBe(1);
    expect(result.errors[1]!.name).toBe('Unauthorized');
    expect(result.errors[1]!.code).toBe(2);
  });

  it('parses a struct type definition', () => {
    const entry = xdr.ScSpecEntry.scSpecEntryUdtStructV0(
      makeStruct('AllowanceData', [
        { name: 'spender', type: xdr.ScSpecTypeDef.scSpecTypeAddress() },
        { name: 'amount', type: xdr.ScSpecTypeDef.scSpecTypeI128() },
      ]),
    );

    const wasm = buildMinimalWasm([entry]);
    const parser = new ABIParser();
    const result = parser.parse({ wasm });

    expect(result.types).toHaveLength(1);
    expect(result.types[0]!.name).toBe('AllowanceData');
    expect(result.types[0]!.type.kind).toBe('struct');
    if (result.types[0]!.type.kind === 'struct') {
      expect(result.types[0]!.type.fields).toHaveLength(2);
      expect(result.types[0]!.type.fields[0]!.name).toBe('spender');
    }
  });

  it('parses nested types (option, vec, result)', () => {
    const entry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      makeFunc('try_swap', [
        makeInput('amount', opt(xdr.ScSpecTypeDef.scSpecTypeI128())),
      ], [
        res(
          vec(xdr.ScSpecTypeDef.scSpecTypeAddress()),
          xdr.ScSpecTypeDef.scSpecTypeError(),
        ),
      ]),
    );

    const wasm = buildMinimalWasm([entry]);
    const parser = new ABIParser();
    const result = parser.parse({ wasm });

    expect(result.functions).toHaveLength(1);
    const param = result.functions[0]!.params[0]!;
    expect(param.type.kind).toBe('option');
    if (param.type.kind === 'option') {
      expect(param.type.inner.kind).toBe('i128');
    }

    const ret = result.functions[0]!.returns;
    expect(ret.kind).toBe('result');
    if (ret.kind === 'result') {
      expect(ret.ok.kind).toBe('vec');
      if (ret.ok.kind === 'vec') {
        expect(ret.ok.element.kind).toBe('address');
      }
      expect(ret.error.kind).toBe('error');
    }
  });

  it('parses a full contract with multiple entry kinds', () => {
    const funcEntry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      makeFunc('balance', [
        makeInput('account', xdr.ScSpecTypeDef.scSpecTypeAddress()),
      ], [xdr.ScSpecTypeDef.scSpecTypeI128()]),
    );

    const eventEntry = xdr.ScSpecEntry.scSpecEntryEventV0(
      makeEvent('Approval', [Buffer.from('approve', 'utf8')], [
        makeEventParam('amount', xdr.ScSpecTypeDef.scSpecTypeI128(),
          xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationData()),
      ]),
    );

    const errorEntry = xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(
      makeErrorEnum('ContractError', [
        { name: 'BalanceBelowMinimum', value: 3 },
      ]),
    );

    const wasm = buildMinimalWasm([funcEntry, eventEntry, errorEntry]);
    const parser = new ABIParser();
    const result = parser.parse({ wasm });

    expect(result.functions).toHaveLength(1);
    expect(result.events).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it('parses map types', () => {
    const entry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      makeFunc('get_balances', [
        makeInput('account', xdr.ScSpecTypeDef.scSpecTypeAddress()),
      ], [
        mapType(
          xdr.ScSpecTypeDef.scSpecTypeSymbol(),
          xdr.ScSpecTypeDef.scSpecTypeI128(),
        ),
      ]),
    );

    const wasm = buildMinimalWasm([entry]);
    const parser = new ABIParser();
    const result = parser.parse({ wasm });

    const ret = result.functions[0]!.returns;
    expect(ret.kind).toBe('map');
    if (ret.kind === 'map') {
      expect(ret.key.kind).toBe('symbol');
      expect(ret.value.kind).toBe('i128');
    }
  });

  it('throws on WASM without contractspec section', () => {
    const magic = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
    const version = Buffer.from([0x01, 0x00, 0x00, 0x00]);
    const emptyWasm = Buffer.concat([magic, version]);
    const parser = new ABIParser();
    expect(() => parser.parse({ wasm: emptyWasm })).toThrow(
      /No contractspec custom section found/,
    );
  });

  it('converts all scalar types correctly', () => {
    const typePairs: Array<{ make: () => xdr.ScSpecTypeDef; kind: string }> = [
      { make: () => xdr.ScSpecTypeDef.scSpecTypeBool(),   kind: 'bool' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeU32(),    kind: 'u32' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeI32(),    kind: 'i32' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeI64(),    kind: 'i64' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeU128(),   kind: 'u128' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeI128(),   kind: 'i128' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeString(), kind: 'string' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeSymbol(), kind: 'symbol' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeBytes(),  kind: 'bytes' },
      { make: () => xdr.ScSpecTypeDef.scSpecTypeAddress(), kind: 'address' },
    ];

    for (const { make, kind } of typePairs) {
      const entry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
        makeFunc('test', [
          makeInput('arg', make()),
        ], [xdr.ScSpecTypeDef.scSpecTypeVoid()]),
      );

      const wasm = buildMinimalWasm([entry]);
      const parser = new ABIParser();
      const result = parser.parse({ wasm });
      expect(result.functions[0]!.params[0]!.type.kind).toBe(kind);
    }
  });
});
