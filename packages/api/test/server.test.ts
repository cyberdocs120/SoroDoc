import { describe, it, expect, beforeEach } from 'vitest';
import { xdr } from '@stellar/stellar-sdk';
import { createApp } from '../src/server.js';
import { deleteWorkspace } from '../src/db/index.js';

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

function makeWasm(): Buffer {
  const entry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
    makeFunc('transfer', [
      makeInput('to', xdr.ScSpecTypeDef.scSpecTypeAddress()),
      makeInput('amount', xdr.ScSpecTypeDef.scSpecTypeI128()),
    ], [xdr.ScSpecTypeDef.scSpecTypeVoid()]),
  );
  return buildMinimalWasm([entry]);
}

async function makeApp(enableAuth = false) {
  const app = await createApp({ enableAuth });
  return app;
}

describe('health', () => {
  it('returns ok status', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
    await app.close();
  });
});

describe('workspaces', () => {
  beforeEach(async () => {
    const app = await makeApp();
    for (const ws of (await app.inject({ method: 'GET', url: '/workspaces' })).json()) {
      deleteWorkspace(ws.id);
    }
    await app.close();
  });

  it('creates and lists workspaces', async () => {
    const app = await makeApp();

    const created = await app.inject({
      method: 'POST',
      url: '/workspaces',
      payload: { name: 'My Contract', description: 'Test workspace' },
    });
    expect(created.statusCode).toBe(201);
    const ws = created.json();
    expect(ws.name).toBe('My Contract');
    expect(ws.contracts).toEqual([]);

    const list = await app.inject({ method: 'GET', url: '/workspaces' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    await app.close();
  });

  it('rejects workspace creation without a name', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/workspaces', payload: { description: 'no name' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Name is required');
    await app.close();
  });

  it('returns 404 for missing workspace', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/workspaces/missing-id' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('updates a workspace', async () => {
    const app = await makeApp();
    const created = (await app.inject({ method: 'POST', url: '/workspaces', payload: { name: 'Old' } })).json();

    const updated = await app.inject({
      method: 'PUT',
      url: `/workspaces/${created.id}`,
      payload: { name: 'New' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe('New');
    await app.close();
  });

  it('deletes a workspace', async () => {
    const app = await makeApp();
    const created = (await app.inject({ method: 'POST', url: '/workspaces', payload: { name: 'Temp' } })).json();

    const del = await app.inject({ method: 'DELETE', url: `/workspaces/${created.id}` });
    expect(del.statusCode).toBe(204);

    const missing = await app.inject({ method: 'GET', url: `/workspaces/${created.id}` });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('adds a contract to a workspace', async () => {
    const app = await makeApp();
    const ws = (await app.inject({ method: 'POST', url: '/workspaces', payload: { name: 'Token' } })).json();

    const res = await app.inject({
      method: 'POST',
      url: `/workspaces/${ws.id}/contracts`,
      payload: { name: 'Token', network: 'testnet' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('pending');

    const fetched = (await app.inject({ method: 'GET', url: `/workspaces/${ws.id}` })).json();
    expect(fetched.contracts).toHaveLength(1);
    await app.close();
  });

  it('rejects contract creation without name or network', async () => {
    const app = await makeApp();
    const ws = (await app.inject({ method: 'POST', url: '/workspaces', payload: { name: 'Token' } })).json();

    const res = await app.inject({ method: 'POST', url: `/workspaces/${ws.id}/contracts`, payload: { name: 'Token' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Name and network are required');
    await app.close();
  });

  it('returns 404 when adding a contract to a missing workspace', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/workspaces/missing/contracts',
      payload: { name: 'Token', network: 'testnet' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('auth middleware', () => {
  it('rejects requests without a bearer token', async () => {
    const app = await makeApp(true);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
    await app.close();
  });

  it('rejects invalid tokens', async () => {
    const app = await makeApp(true);
    const res = await app.inject({ method: 'GET', url: '/health', headers: { authorization: 'Bearer wrong-token' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
    await app.close();
  });

  it('accepts a valid JWT token', async () => {
    const app = await makeApp(true);
    const token = app.jwt.sign({ id: 'test-user', email: 'test@test.com', role: 'user' });
    const res = await app.inject({ method: 'GET', url: '/health', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('generate routes', () => {
  it('requires wasm on direct generate', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/generate', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('wasm (base64-encoded) is required');
    await app.close();
  });

  it('rejects empty wasm on direct generate', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/generate', payload: { wasm: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('wasm must not be empty');
    await app.close();
  });

  it('generates documentation from a base64 wasm', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: {
        wasm: makeWasm().toString('base64'),
        contractName: 'Token',
        formats: ['markdown', 'openapi'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.contractName).toBe('Token');
    expect(body.outputs.markdown).toBeTruthy();
    expect(body.outputs.openapi).toBe('OpenAPI spec generated');
    await app.close();
  });

  it('validates contractId on deployed generation', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/generate/deployed', payload: { network: 'testnet' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('contractId is required');
    await app.close();
  });

  it('validates network on deployed generation', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/generate/deployed', payload: { contractId: 'abc', network: 'mars' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('network must be testnet or mainnet');
    await app.close();
  });

  it('fetches the deployed contract WASM and generates documentation', async () => {
    const fetchWasm = async () => makeWasm();
    const app = await createApp({ fetchWasm });
    const res = await app.inject({
      method: 'POST',
      url: '/generate/deployed',
      payload: { contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2V2EQO2KQPV7R6R6VU', network: 'testnet', contractName: 'Token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.contractName).toBe('Token');
    expect(body.outputs.markdown).toBeTruthy();
    expect(body.outputs.openapi).toBeTruthy();
    await app.close();
  });

  it('returns 502 when the WASM fetch fails', async () => {
    const fetchWasm = async () => {
      throw new Error('No WASM found for contract');
    };
    const app = await createApp({ fetchWasm });
    const res = await app.inject({
      method: 'POST',
      url: '/generate/deployed',
      payload: { contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2V2EQO2KQPV7R6R6VU', network: 'testnet' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain('Failed to fetch contract WASM');
    await app.close();
  });
});
