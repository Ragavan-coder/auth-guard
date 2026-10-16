import { Router } from 'express';
import { z } from 'zod';
import { AuthorizeController } from '../controllers/authorize.controller.js';
import { validateRequestBody } from '../middleware/validate-request.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const authorizeRequestSchema = z.object({
  access_token: z
    .string({
      required_error: 'access_token is required',
      invalid_type_error: 'access_token must be a string'
    })
    .min(1, 'access_token must not be empty'),
  method: z
    .string({
      required_error: 'method is required',
      invalid_type_error: 'method must be a string'
    })
    .min(1, 'method must not be empty'),
  path: z
    .string({
      required_error: 'path is required',
      invalid_type_error: 'path must be a string'
    })
    .min(1, 'path must not be empty')
});

export function createAuthorizeRouter(
  controller: AuthorizeController = new AuthorizeController()
): Router {
  const router = Router();

  router.post(
    '/authorize',
    validateRequestBody(authorizeRequestSchema),
    asyncHandler(controller.authorize)
  );

  return router;
}
