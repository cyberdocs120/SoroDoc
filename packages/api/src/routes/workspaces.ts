import { FastifyInstance } from 'fastify';
import { listWorkspaces, getWorkspace, createWorkspace, updateWorkspace, deleteWorkspace, addContract } from '../db/index.js';

interface CreateWorkspaceBody {
  name: string;
  description: string;
}

interface UpdateWorkspaceBody {
  name?: string;
  description?: string;
}

interface AddContractBody {
  name: string;
  network: 'testnet' | 'mainnet';
  contractId?: string;
}

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/workspaces', async (_request, reply) => {
    return reply.send(listWorkspaces());
  });

  app.get<{ Params: { id: string } }>('/workspaces/:id', async (request, reply) => {
    const ws = getWorkspace(request.params.id);
    if (!ws) return reply.status(404).send({ error: 'Workspace not found' });
    return reply.send(ws);
  });

  app.post<{ Body: CreateWorkspaceBody }>('/workspaces', async (request, reply) => {
    const { name, description } = request.body;
    if (!name) return reply.status(400).send({ error: 'Name is required' });
    const ws = createWorkspace({ name, description });
    return reply.status(201).send(ws);
  });

  app.put<{ Params: { id: string }; Body: UpdateWorkspaceBody }>('/workspaces/:id', async (request, reply) => {
    const ws = updateWorkspace(request.params.id, request.body);
    if (!ws) return reply.status(404).send({ error: 'Workspace not found' });
    return reply.send(ws);
  });

  app.delete<{ Params: { id: string } }>('/workspaces/:id', async (request, reply) => {
    const deleted = deleteWorkspace(request.params.id);
    if (!deleted) return reply.status(404).send({ error: 'Workspace not found' });
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string }; Body: AddContractBody }>('/workspaces/:id/contracts', async (request, reply) => {
    const { name, network, contractId } = request.body;
    if (!name || !network) return reply.status(400).send({ error: 'Name and network are required' });
    const contract = addContract(request.params.id, { name, network, contractId, status: 'pending' });
    if (!contract) return reply.status(404).send({ error: 'Workspace not found' });
    return reply.status(201).send(contract);
  });
}
