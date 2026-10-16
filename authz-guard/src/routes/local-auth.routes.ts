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
      res.status(200).json({
        message: 'Auth0 user synchronized with SQLite successfully.',
        user
      });
    })
  );

  /**
   * GET /auth/demo-tokens
   * Returns pre-generated valid access tokens for all sample test users
   */
  router.get(
    '/auth/demo-tokens',
    asyncHandler(async (_req: Request, res: Response) => {
      const users = ['user123', 'user456', 'user789', 'admin789'];
      const tokens: Record<string, string> = {};
      for (const userId of users) {
        tokens[userId] = await authService.signToken({
          sub: userId,
          email: `${userId}@authz-guard.internal`,
          username: userId,
          role: userId === 'admin789' ? 'admin' : 'user',
          local: true
        });
      }
      res.status(200).json({
        message: 'Pre-generated demo tokens for live curl / testing',
        tokens
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
