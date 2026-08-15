import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { authMiddleware } from './middleware/auth.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { generateRoutes } from './routes/generate.js';

export interface AppOptions {
  port?: number;
  host?: string;
  enableAuth?: boolean;
  fetchWasm?: (opts: { contractId: string; network: string }) => Promise<Buffer>;
}

export function createApp(options: AppOptions = {}) {
  const { enableAuth = false, fetchWasm } = options;

  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    },
  });

  app.register(cors, { origin: true });
  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  if (enableAuth) {
    app.addHook('preHandler', authMiddleware);
  }

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.register(workspaceRoutes);
  app.register(generateRoutes, { fetchWasm });

  return app;
}

export async function startServer(options: AppOptions = {}) {
  const { port = 3001, host = '0.0.0.0' } = options;
  const app = createApp(options);

  try {
    await app.listen({ port, host });
    app.log.info(`SoroDoc API server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  return app;
}
