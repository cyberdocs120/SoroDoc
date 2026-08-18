import { FastifyInstance } from 'fastify';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

const users = new Map<string, { id: string; email: string; passwordHash: string; role: 'admin' | 'user' }>();

async function hashPassword(password: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(password).digest('hex');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { email: string; password: string } }>('/auth/register', async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters' });
    }
    if (users.has(email)) {
      return reply.status(409).send({ error: 'User already exists' });
    }

    const id = crypto.randomUUID();
    const user = { id, email, passwordHash: await hashPassword(password), role: 'user' as const };
    users.set(email, user);

    const token = app.jwt.sign({ id, email, role: user.role }, { expiresIn: '24h' });
    return reply.status(201).send({ token, user: { id, email, role: user.role } });
  });

  app.post<{ Body: { email: string; password: string } }>('/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const user = users.get(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ id: user.id, email: user.email, role: user.role }, { expiresIn: '24h' });
    return reply.send({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  app.get('/auth/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.user as User;
    return reply.send({ user });
  });
}
