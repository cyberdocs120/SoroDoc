export interface Workspace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  contracts: ContractRecord[];
}

export interface ContractRecord {
  id: string;
  name: string;
  network: 'testnet' | 'mainnet';
  contractId?: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  error?: string;
  createdAt: string;
}

const workspaces = new Map<string, Workspace>();

export function listWorkspaces(): Workspace[] {
  return Array.from(workspaces.values());
}

export function getWorkspace(id: string): Workspace | undefined {
  return workspaces.get(id);
}

export function createWorkspace(data: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'contracts'>): Workspace {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const ws: Workspace = { id, ...data, createdAt: now, updatedAt: now, contracts: [] };
  workspaces.set(id, ws);
  return ws;
}

export function updateWorkspace(id: string, data: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Workspace | undefined {
  const ws = workspaces.get(id);
  if (!ws) return undefined;
  const updated: Workspace = { ...ws, ...data, id: ws.id, createdAt: ws.createdAt, updatedAt: new Date().toISOString() };
  workspaces.set(id, updated);
  return updated;
}

export function deleteWorkspace(id: string): boolean {
  return workspaces.delete(id);
}

export function addContract(workspaceId: string, contract: Omit<ContractRecord, 'id' | 'createdAt'>): ContractRecord | undefined {
  const ws = workspaces.get(workspaceId);
  if (!ws) return undefined;
  const record: ContractRecord = { ...contract, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  ws.contracts.push(record);
  ws.updatedAt = new Date().toISOString();
  return record;
}

export function updateContract(workspaceId: string, contractId: string, data: Partial<Omit<ContractRecord, 'id' | 'createdAt'>>): ContractRecord | undefined {
  const ws = workspaces.get(workspaceId);
  if (!ws) return undefined;
  const idx = ws.contracts.findIndex(c => c.id === contractId);
  if (idx === -1) return undefined;
  ws.contracts[idx] = { ...ws.contracts[idx]!, ...data } as ContractRecord;
  ws.updatedAt = new Date().toISOString();
  return ws.contracts[idx];
}
