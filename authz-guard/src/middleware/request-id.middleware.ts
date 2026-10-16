import type { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const SAFE_REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export function requestIdMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incomingHeader = req.headers['x-request-id'];
    let requestId: string;

    if (typeof incomingHeader === 'string' && SAFE_REQUEST_ID_REGEX.test(incomingHeader.trim())) {
      requestId = incomingHeader.trim();
    } else {
      requestId = crypto.randomUUID();
    }

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  };
}
