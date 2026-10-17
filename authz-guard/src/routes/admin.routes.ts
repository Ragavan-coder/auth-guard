import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserRepository } from '../repositories/user.repository.js';
import { PermissionRepository } from '../repositories/permission.repository.js';
import { requireLocalAuth } from '../middleware/local-auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { logger } from '../utils/logger.js';

const addPermissionSchema = z.object({
  user_id: z.string().min(1),
  action: z.enum(['read', 'write', 'delete']),
  resource: z.string().min(1),
  effect: z.enum(['allow', 'deny'])
});

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin'])
});

export function createAdminRouter(): Router {
  const router = Router();

  // All admin routes require a valid local JWT with role=admin
  router.use('/admin', requireLocalAuth(true));

  const userRepo = new UserRepository();

  /**
   * GET /admin/users
   * List all registered users with their current permissions.
   */
  router.get(
    '/admin/users',
    asyncHandler(async (_req: Request, res: Response) => {
      const users = userRepo.findAllWithPermissions();
      res.status(200).json({ total: users.length, users });
    })
  );

  /**
   * DELETE /admin/users/:id
   * Delete a user account and all their permissions.
   */
  router.delete(
    '/admin/users/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params['id'] ?? '', 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid user ID.' } });
        return;
      }

      const user = userRepo.findById(id);
      if (!user) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
        return;
      }

      if (user.role === 'admin') {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot delete an admin account.' } });
        return;
      }

      userRepo.deleteById(id);
      logger.info({ userId: id }, 'Admin deleted user account.');
      res.status(200).json({ message: `User ${user.email} deleted successfully.` });
    })
  );

  /**
   * PUT /admin/users/:id/role
   * Change a user's role (user | admin).
   */
  router.put(
    '/admin/users/:id/role',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params['id'] ?? '', 10);
      const parsed = updateRoleSchema.safeParse(req.body);
      if (!Number.isFinite(id) || !parsed.success) {
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid request.' } });
        return;
      }

      const updated = userRepo.updateRole(id, parsed.data.role);
      if (!updated) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
        return;
      }

      res.status(200).json({ message: `User role updated to ${parsed.data.role}.` });
    })
  );

  /**
   * GET /admin/users/:id/permissions
   * Get all permissions for a specific user (by DB user id).
   */
  router.get(
    '/admin/users/:id/permissions',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params['id'] ?? '', 10);
      const user = userRepo.findById(id);
      if (!user) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
        return;
      }

      const permRepo = new PermissionRepository();
      // Get all permissions for this user_id (email) regardless of action
      const db = (permRepo as unknown as { db: import('better-sqlite3').Database }).db;
      const perms = db
        .prepare('SELECT * FROM user_permissions WHERE user_id = ? ORDER BY id ASC')
        .all(user.email);

      res.status(200).json({ user_id: user.email, permissions: perms });
    })
  );

  /**
   * POST /admin/permissions
   * Add a new permission rule for any user_id.
   */
  router.post(
    '/admin/permissions',
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = addPermissionSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => e.message).join(', ');
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: msg } });
        return;
      }

      const { user_id, action, resource, effect } = parsed.data;
      const canonicalResource =
        resource === '*' ? '*' : resource.trim().replace(/^\/+/, '').replace(/\/+$/, '') || resource.trim();
      const permRepo = new PermissionRepository();
      const db = (permRepo as unknown as { db: import('better-sqlite3').Database }).db;
      const result = db
        .prepare('INSERT INTO user_permissions (user_id, action, resource, effect) VALUES (?, ?, ?, ?)')
        .run(user_id, action, canonicalResource, effect);

      logger.info({ user_id, action, resource: canonicalResource, effect }, 'Admin added permission.');
      res.status(201).json({
        message: 'Permission added.',
        id: result.lastInsertRowid
      });
    })
  );

  /**
   * DELETE /admin/permissions/:id
   * Remove a specific permission rule by its database ID.
   */
  router.delete(
    '/admin/permissions/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params['id'] ?? '', 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Invalid permission ID.' } });
        return;
      }

      const permRepo = new PermissionRepository();
      const db = (permRepo as unknown as { db: import('better-sqlite3').Database }).db;
      const result = db.prepare('DELETE FROM user_permissions WHERE id = ?').run(id);

      if (result.changes === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Permission not found.' } });
        return;
      }

      logger.info({ permissionId: id }, 'Admin removed permission.');
      res.status(200).json({ message: 'Permission deleted.' });
    })
  );

  return router;
}
