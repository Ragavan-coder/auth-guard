import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { LocalAuthService, LocalAuthClaims } from '../services/local-auth.service.js';

declare global {
  namespace Express {
    interface Request {
      localUser?: LocalAuthClaims;
    }
  }
}

export function requireLocalAuth(requireAdmin = false): RequestHandler {
  const authService = new LocalAuthService();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing local session token.' } });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const claims = await authService.verifyToken(token);

      if (requireAdmin && claims.role !== 'admin') {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
        return;
      }

      req.localUser = claims;
      next();
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session token.' } });
    }
  };
}
