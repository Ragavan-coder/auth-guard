import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../domain/authorization.errors.js';
import { logger } from '../utils/logger.js';

interface HttpErrorLike {
  status?: number;
  statusCode?: number;
  type?: string;
  message?: string;
}

export function errorHandlerMiddleware(): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

    // 1. Known AppError subclasses
    if (err instanceof AppError) {
      logger.warn(
        {
          requestId,
          statusCode: err.statusCode,
          errorCode: err.errorCode,
          errorName: err.name
        },
        'Handled application error'
      );

      res.status(err.statusCode).json({
        error: {
          code: err.errorCode,
          message: err.safeMessage,
          request_id: requestId,
          ...(err.details && process.env.NODE_ENV !== 'production' ? { details: err.details } : {})
        }
      });
      return;
    }

    const httpErr = err as HttpErrorLike;

    // 2. Payload too large (from express.json / body-parser)
    if (
      httpErr.status === 413 ||
      httpErr.statusCode === 413 ||
      httpErr.type === 'entity.too.large'
    ) {
      logger.warn({ requestId }, 'Request payload exceeded maximum configured limit.');
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload exceeds maximum allowed size.',
          request_id: requestId
        }
      });
      return;
    }

    // 3. JSON parse syntax error (from express.json)
    if (
      (err instanceof SyntaxError && 'body' in err) ||
      httpErr.status === 400 ||
      httpErr.statusCode === 400
    ) {
      logger.warn({ requestId }, 'Malformed JSON body syntax in request.');
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Malformed JSON payload.',
          request_id: requestId
        }
      });
      return;
    }

    // 4. Unhandled operational or programming error: fail closed
    logger.error(
      {
        err,
        requestId,
        path: req.path,
        method: req.method
      },
      'Unhandled internal error occurred during request processing'
    );

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred. Request failed closed.',
        request_id: requestId
      }
    });
  };
}
