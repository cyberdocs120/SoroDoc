import { FastifyInstance, FastifyReply } from 'fastify';
import {
  parseContract,
  DocEngine,
  MarkdownRenderer,
  OpenAPIRenderer,
  DocusaurusRenderer,
  fetchContractWasm,
  getRpcUrl,
  type AIPromptConfig,
} from '@sorodoc/core';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'sorodoc-'));
}

export interface GenerateRoutesOptions {
  fetchWasm?: (opts: { contractId: string; network: string }) => Promise<Buffer>;
}

export interface GenerationRequest {
  contractName?: string;
  network?: string;
  formats?: string[];
  tone?: 'technical' | 'friendly' | 'enterprise' | 'educational';
  source?: string;
}

function runGeneration(reply: FastifyReply, wasmBuffer: Buffer, body: GenerationRequest) {
  const contractName = body?.contractName;
  const network = body?.network ?? 'testnet';
  const formats = body?.formats;
  const tone = body?.tone ?? 'technical';

  const name = contractName || 'contract';

  try {
    const abi = parseContract({ wasm: wasmBuffer, contractName: name });

    const aiConfig: AIPromptConfig = {
      enabled: true,
      model: 'claude-sonnet-4-20250514',
      tone,
      generateExamples: true,
      exampleLanguages: ['typescript', 'python', 'rust'],
    };

    const docEngine = new DocEngine();
    return docEngine.generate(abi, aiConfig).then((docOutput) => {
      const tmpDir = createTempDir();
      const results: Record<string, string> = {};

      if (!formats || formats.includes('markdown')) {
        const mdRenderer = new MarkdownRenderer({
          outputDir: tmpDir,
          network,
        });
        const mdResult = mdRenderer.render(docOutput);
        results.markdown = mdResult.markdown ?? '';
      }

      if (!formats || formats.includes('openapi')) {
        const oasRenderer = new OpenAPIRenderer({
          outputDir: tmpDir,
          network,
        });
        oasRenderer.render(docOutput);
        results.openapi = 'OpenAPI spec generated';
      }

      if (!formats || formats.includes('docusaurus')) {
        const dsRenderer = new DocusaurusRenderer({
          outputDir: tmpDir,
          network,
          projectName: name,
        });
        const dsResult = dsRenderer.render(docOutput);
        results.docusaurus = dsResult.markdown ?? '';
      }

      return reply.send({ contractName: name, network, outputs: results });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return reply.status(500).send({ error: `Generation failed: ${message}` });
  }
}

export async function generateRoutes(
  app: FastifyInstance,
  options: GenerateRoutesOptions = {},
): Promise<void> {
  const fetchWasm =
    options.fetchWasm ??
    ((opts: { contractId: string; network: string }) => {
      const network = (opts.network === 'mainnet' ? 'mainnet' : 'testnet') as 'testnet' | 'mainnet';
      return fetchContractWasm({
        contractId: opts.contractId,
        network,
        rpcUrl: getRpcUrl(network),
      });
    });

  app.post<{
    Body: GenerationRequest & { wasm: string };
  }>('/generate', async (request, reply) => {
    const { wasm, ...body } = request.body ?? {};
    if (wasm === undefined || wasm === null) {
      return reply.status(400).send({ error: 'wasm (base64-encoded) is required' });
    }
    if (wasm === '' || wasm.length === 0) {
      return reply.status(400).send({ error: 'wasm must not be empty' });
    }

    const wasmBuffer = Buffer.from(wasm, 'base64');
    if (wasmBuffer.length === 0) {
      return reply.status(400).send({ error: 'wasm must be valid base64' });
    }

    return runGeneration(reply, wasmBuffer, body);
  });

  app.post<{
    Params: { workspaceId: string };
  }>('/workspaces/:workspaceId/generate/wasm', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'WASM file is required' });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const wasmBuffer = Buffer.concat(chunks);

    const body = request.body as Record<string, string> | undefined;
    const name = body?.contractName || data.filename?.replace(/\.wasm$/i, '') || 'contract';

    return runGeneration(reply, wasmBuffer, {
      contractName: name,
      network: body?.network,
      formats: body?.formats ? body.formats.split(',') : undefined,
      tone: body?.tone as GenerationRequest['tone'],
    });
  });

  app.post<{ Body: GenerationRequest & { contractId: string } }>(
    '/generate/deployed',
    async (request, reply) => {
      const { contractId, network = 'testnet', ...body } = request.body ?? {};
      if (!contractId) return reply.status(400).send({ error: 'contractId is required' });
      if (network !== 'testnet' && network !== 'mainnet') {
        return reply.status(400).send({ error: 'network must be testnet or mainnet' });
      }

      let wasmBuffer: Buffer;
      try {
        wasmBuffer = await fetchWasm({ contractId, network });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return reply.status(502).send({ error: `Failed to fetch contract WASM: ${message}` });
      }

      return runGeneration(reply, wasmBuffer, {
        contractName: body.contractName || contractId,
        network,
        formats: body.formats,
        tone: body.tone,
      });
    },
  );
}
