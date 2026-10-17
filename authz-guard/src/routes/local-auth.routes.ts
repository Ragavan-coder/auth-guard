import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { LocalAuthService } from '../services/local-auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const registerSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export function createLocalAuthRouter(): Router {
  const router = Router();
  const authService = new LocalAuthService();

  /**
   * POST /auth/register
   * Create a new local account. Saves user + hashed password to SQLite.
   */
  router.post(
    '/auth/register',
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => e.message).join(', ');
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: msg } });
        return;
      }

      const result = await authService.register(parsed.data);
      res.status(201).json({
        message: 'Account created successfully.',
        token: result.token,
        user: result.user
      });
    })
  );

  /**
   * POST /auth/login
   * Authenticate with email + password. Returns a signed JWT session token.
   */
  router.post(
    '/auth/login',
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => e.message).join(', ');
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: msg } });
        return;
      }

      const result = await authService.login(parsed.data);
      res.status(200).json({
        message: 'Login successful.',
        token: result.token,
        user: result.user
      });
    })
  );

  /**
   * POST /auth/sync-auth0-user
   * Synchronizes an Auth0 authenticated user into SQLite so Admin can manage permissions.
   */
  router.post(
    '/auth/sync-auth0-user',
    asyncHandler(async (req: Request, res: Response) => {
      const { sub, email, name } = req.body;
      if (!email && !sub) {
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'sub or email required.' } });
        return;
      }
      const { UserRepository } = await import('../repositories/user.repository.js');
      const userRepo = new UserRepository();
      const user = userRepo.upsertOAuthUser({
        sub: sub || email,
        email: email || sub,
        name: name || undefined
      });

      // Seed baseline allow permissions for synced user
      try {
        const db = (userRepo as unknown as { db: import('better-sqlite3').Database }).db;
        if (db) {
          const permStmt = db.prepare(
            'INSERT OR IGNORE INTO user_permissions (user_id, action, resource, effect) VALUES (?, ?, ?, ?)'
          );
          if (user.username) permStmt.run(user.username, 'read', 'transactions', 'allow');
          if (user.email) permStmt.run(user.email, 'read', 'transactions', 'allow');
          if (sub) permStmt.run(sub, 'read', 'transactions', 'allow');
        }
      } catch {
        // non-blocking
      }

      res.status(200).json({
        message: 'Auth0 user synchronized with SQLite successfully.',
        user
      });
    })
  );

  /**
   * GET /auth/demo-tokens
   * Returns pre-generated valid access tokens for all sample test users and registered accounts
   */
  router.get(
    '/auth/demo-tokens',
    asyncHandler(async (_req: Request, res: Response) => {
      const defaultUsers = ['user123', 'user456', 'user789', 'admin789'];
      const tokens: Record<string, string> = {};
      for (const userId of defaultUsers) {
        tokens[userId] = await authService.signToken({
          sub: userId,
          email: `${userId}@authz-guard.internal`,
          username: userId,
          role: userId === 'admin789' ? 'admin' : 'user',
          local: true
        });
      }

      const userList: Array<{ key: string; label: string; role: string; email: string }> = [
        { key: 'user123', label: 'user123 (Seeded Demo)', role: 'user', email: 'user123@authz-guard.internal' },
        { key: 'user456', label: 'user456 (Wallets Read)', role: 'user', email: 'user456@authz-guard.internal' },
        { key: 'user789', label: 'user789 (Wildcard Writer)', role: 'user', email: 'user789@authz-guard.internal' },
        { key: 'admin789', label: 'admin789 (Global Admin)', role: 'admin', email: 'admin789@authz-guard.internal' }
      ];

      try {
        const { UserRepository } = await import('../repositories/user.repository.js');
        const userRepo = new UserRepository();
        const dbUsers = userRepo.findAll();
        for (const u of dbUsers) {
          const userKey = u.username || u.email;
          if (userKey && !tokens[userKey] && !defaultUsers.includes(userKey)) {
            tokens[userKey] = await authService.signToken({
              sub: String(u.id),
              email: u.email,
              username: u.username,
              role: u.role,
              local: true
            });
            userList.push({
              key: userKey,
              label: `${u.username} (${u.email}) [Signed Person]`,
              role: u.role,
              email: u.email
            });
          }
        }
      } catch {
        // non-blocking
      }

      res.status(200).json({
        message: 'Pre-generated demo tokens for live curl / testing',
        tokens,
        userList
      });
    })
  );

  /**
   * GET /auth/token/:userId
   * Generates a valid test token for any user ID on demand
   */
  router.get(
    '/auth/token/:userId',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.params['userId'] || 'user123';
      const token = await authService.signToken({
        sub: userId,
        email: `${userId}@authz-guard.internal`,
        username: userId,
        role: userId.includes('admin') ? 'admin' : 'user',
        local: true
      });
      res.status(200).json({
        user_id: userId,
        token
      });
    })
  );

  return router;
}
