import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { getEnv } from '../config/env.js';
import { RateLimitExceededError } from '../domain/authorization.errors.js';

export function createRateLimiter(): RateLimitRequestHandler {
  const env = getEnv();

  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true, // draft-6 RateLimit headers
    legacyHeaders: false,
    handler: (_req: Request, _res: Response, next) => {
      next(new RateLimitExceededError());
    }
  });
}
