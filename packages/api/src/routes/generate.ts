import { FastifyInstance } from 'fastify';
import { parseContract, DocEngine, MarkdownRenderer, OpenAPIRenderer, DocusaurusRenderer, type AIPromptConfig } from '@sorodoc/core';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'sorodoc-'));
}

export async function generateRoutes(app: FastifyInstance): Promise<void> {
  app.post('/generate', async (request, reply) => {
    return reply.status(501).send({
      error: 'WASM upload generation not yet implemented',
      message: 'Use POST /workspaces/:id/generate/wasm with multipart upload, or POST /generate/deployed with a contractId',
    });
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
    const contractName = body?.contractName;
    const network = body?.network ?? 'testnet';
    const formats = body?.formats ? body.formats.split(',') : undefined;
    const tone = (body?.tone as 'technical' | 'friendly' | 'enterprise' | 'educational') || 'technical';

    const name = contractName || data.filename?.replace(/\.wasm$/i, '') || 'contract';

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
      const docOutput = await docEngine.generate(abi, aiConfig);

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

      return reply.send({
        contractName: name,
        network,
        outputs: results,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(500).send({ error: `Generation failed: ${message}` });
    }
  });

  app.post<{ Body: { contractId: string; network: string; contractName?: string } }>(
    '/generate/deployed',
    async (request, reply) => {
      const { contractId, network } = request.body;
      if (!contractId) return reply.status(400).send({ error: 'contractId is required' });
      if (!network) return reply.status(400).send({ error: 'network is required' });

      return reply.status(501).send({
        error: 'Deployed contract generation not yet implemented',
        message: 'This will fetch the WASM from the Soroban RPC and run the full pipeline',
      });
    },
  );
}
