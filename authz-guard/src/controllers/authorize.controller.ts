import type { Request, Response } from 'express';
import { AuthorizeService } from '../services/authorize.service.js';
import { AuthorizeRequestBody } from '../domain/authorization.types.js';

export class AuthorizeController {
  constructor(private authorizeService: AuthorizeService = new AuthorizeService()) {}

  public authorize = async (req: Request, res: Response): Promise<void> => {
    const requestId = req.requestId || 'unknown';
    const body = req.body as AuthorizeRequestBody;

    const response = await this.authorizeService.execute(body, requestId);

    // Completed evaluations (both ALLOW and DENY) return HTTP 200 per API specification
    res.status(200).json(response);
  };
}
