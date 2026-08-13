import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/server.js';
import { deleteWorkspace } from '../src/db/index.js';

async function makeApp(enableAuth = false) {
  const app = createApp({ enableAuth });
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
    expect(res.json().error).toBe('Missing or invalid authorization header');
    await app.close();
  });

  it('rejects invalid tokens', async () => {
    const app = await makeApp(true);
    const res = await app.inject({ method: 'GET', url: '/health', headers: { authorization: 'Bearer wrong-token' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid token');
    await app.close();
  });

  it('accepts the dev token', async () => {
    const app = await makeApp(true);
    const res = await app.inject({ method: 'GET', url: '/health', headers: { authorization: 'Bearer sorodoc-dev-token' } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('generate routes', () => {
  it('returns 501 for direct generate', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/generate' });
    expect(res.statusCode).toBe(501);
    expect(res.json().error).toContain('not yet implemented');
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
    const res = await app.inject({ method: 'POST', url: '/generate/deployed', payload: { contractId: 'abc' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('network is required');
    await app.close();
  });

  it('returns 501 for deployed generation', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/generate/deployed',
      payload: { contractId: 'abc', network: 'testnet' },
    });
    expect(res.statusCode).toBe(501);
    expect(res.json().error).toContain('not yet implemented');
    await app.close();
  });
});
