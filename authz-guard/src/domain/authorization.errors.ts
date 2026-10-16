/**
 * Central typed domain errors.
 * Ensures error codes and safe messages are strictly separated from internal details.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly safeMessage: string;
  public readonly details?: unknown;

  constructor(statusCode: number, errorCode: string, safeMessage: string, details?: unknown) {
    super(safeMessage);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.safeMessage = safeMessage;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidRequestError extends AppError {
  constructor(message = 'The request is malformed or invalid.', details?: unknown) {
    super(400, 'INVALID_REQUEST', message, details);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = 'The provided access token is invalid, expired, or untrusted.') {
    // 401 response: never disclose internal cryptographic details to caller
    super(401, 'INVALID_TOKEN', message);
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(method: string) {
    super(405, 'METHOD_NOT_ALLOWED', `HTTP method '${method}' is not supported for authorization.`);
  }
}

export class RateLimitExceededError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(429, 'RATE_LIMITED', message);
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected internal error occurred. Request failed closed.') {
    super(500, 'INTERNAL_ERROR', message);
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed. Request failed closed.') {
    super(500, 'INTERNAL_ERROR', message);
  }
}
