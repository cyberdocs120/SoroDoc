import { FastifyRequest, FastifyReply } from 'fastify';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== 'sorodoc-dev-token') {
    reply.status(401).send({ error: 'Invalid token' });
    return;
  }

  (request as any).user = { id: 'dev-user', role: 'admin' };
}
