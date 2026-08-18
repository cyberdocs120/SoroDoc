import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { authMiddleware, registerAuthDecorators } from './middleware/auth.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { generateRoutes } from './routes/generate.js';
import { authRoutes } from './routes/auth.js';

export interface AppOptions {
  port?: number;
  host?: string;
  enableAuth?: boolean;
  jwtSecret?: string;
  fetchWasm?: (opts: { contractId: string; network: string }) => Promise<Buffer>;
}

export async function createApp(options: AppOptions = {}) {
  const { enableAuth = false, jwtSecret = process.env['JWT_SECRET'] || 'sorodoc-dev-secret', fetchWasm } = options;

  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    },
  });

  app.register(cors, { origin: true });
  app.register(jwt, { secret: jwtSecret });
  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  await registerAuthDecorators(app);

  if (enableAuth) {
    app.addHook('preHandler', authMiddleware);
  }

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.register(authRoutes);
  app.register(workspaceRoutes);
  app.register(generateRoutes, { fetchWasm });

  return app;
}

export async function startServer(options: AppOptions = {}) {
  const { port = 3001, host = '0.0.0.0' } = options;
  const app = await createApp(options);

  try {
    await app.listen({ port, host });
    app.log.info(`SoroDoc API server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  return app;
}
