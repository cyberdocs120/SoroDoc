import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { JWT } from '@fastify/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    jwt: JWT;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: 'admin' | 'user';
  authMethod: 'jwt' | 'apikey';
}

const API_KEY_HEADER = 'x-api-key';

function getApiKey(): string | undefined {
  return process.env['SORODOC_API_KEY'] || process.env['API_KEY'];
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = request.headers[API_KEY_HEADER] as string | undefined;
  if (apiKey) {
    const validApiKey = getApiKey();
    if (validApiKey && apiKey === validApiKey) {
      request.user = { id: 'api-key-user', role: 'admin', authMethod: 'apikey' };
      return;
    }
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Provide a valid JWT token in the Authorization header or an API key in x-api-key',
    });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = request.server.jwt.verify<{ id: string; email: string; role: string }>(token);
    request.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role as 'admin' | 'user',
      authMethod: 'jwt',
    };
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export async function registerAuthDecorators(app: FastifyInstance): Promise<void> {
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    await authMiddleware(request, reply);
  });
}
