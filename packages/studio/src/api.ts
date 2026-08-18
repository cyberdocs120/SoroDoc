export interface ContractData {
  contractName: string;
  network: string;
  abi?: {
    name: string;
    functions: Array<{
      name: string;
      params: Array<{ name: string; type: { kind: string } }>;
      returns: { kind: string };
      docs?: string;
    }>;
    events: Array<{ name: string; description?: string }>;
    errors: Array<{ code: number; name: string; message?: string }>;
  };
  docs?: {
    contractName: string;
    overview: string;
    functions: Array<{
      name: string;
      description: string;
      params: Array<{ name: string; type: { kind: string }; description: string }>;
      returns: { type: { kind: string }; description: string };
      examples?: Array<{ language: string; code: string }>;
    }>;
    events: Array<{
      name: string;
      description: string;
      topics: Array<{ index: number; name: string; type: { kind: string } }>;
      data: Array<{ name: string; type: { kind: string } }>;
    }>;
    errors: Array<{
      code: number;
      name: string;
      description: string;
      commonCauses: string[];
      remediation: string;
    }>;
  };
  outputs?: Record<string, string>;
}

export interface GenerationResponse {
  contractName: string;
  network: string;
  outputs: Record<string, string>;
}

export interface SdkResponse {
  package: string;
  language: string;
  files: Record<string, string>;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function generateFromWasm(
  wasm: Buffer,
  contractName: string,
  network: string,
): Promise<GenerationResponse> {
  const wasmBase64 = wasm.toString('base64');
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wasm: wasmBase64, contractName, network }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Generation failed');
  }
  return res.json();
}

export async function generateFromDeployed(
  contractId: string,
  network: string,
  contractName?: string,
): Promise<GenerationResponse> {
  const res = await fetch(`${API_BASE}/generate/deployed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractId, network, contractName: contractName || contractId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Generation failed');
  }
  return res.json();
}

export async function generateSdk(
  wasm: Buffer,
  language: string,
  packageName: string,
  contractName: string,
): Promise<SdkResponse> {
  const wasmBase64 = wasm.toString('base64');
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wasm: wasmBase64, contractName, formats: ['markdown'] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'SDK generation failed');
  }
  const data = await res.json();
  return { package: packageName, language, files: data.outputs };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
