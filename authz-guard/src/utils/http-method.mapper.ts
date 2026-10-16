import { Action } from '../domain/authorization.types.js';
import { MethodNotAllowedError } from '../domain/authorization.errors.js';
import { ACTIONS } from '../config/constants.js';

const METHOD_TO_ACTION_MAP: Record<string, Action> = {
  GET: ACTIONS.READ,
  HEAD: ACTIONS.READ,
  POST: ACTIONS.WRITE,
  PUT: ACTIONS.WRITE,
  PATCH: ACTIONS.WRITE,
  DELETE: ACTIONS.DELETE
};

/**
 * Maps an incoming HTTP method to a canonical authorization Action.
 * Rejects unsupported methods with MethodNotAllowedError (HTTP 405).
 */
export function mapHttpMethodToAction(method: string): Action {
  if (!method || typeof method !== 'string') {
    throw new MethodNotAllowedError('UNKNOWN');
  }

  const normalizedMethod = method.trim().toUpperCase();
  const action = METHOD_TO_ACTION_MAP[normalizedMethod];

  if (!action) {
    throw new MethodNotAllowedError(normalizedMethod);
  }

  return action;
}
