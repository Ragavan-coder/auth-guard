import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { InvalidRequestError } from '../domain/authorization.errors.js';

export function validateRequestBody(schema: ZodSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object') {
      return next(new InvalidRequestError('Request body must be a valid JSON object.'));
    }

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      const zodError = parseResult.error as ZodError;
      const issues = zodError.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return next(new InvalidRequestError(`Validation failed: ${issues}`));
    }

    req.body = parseResult.data;
    next();
  };
}
