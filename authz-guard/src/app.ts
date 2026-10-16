import express, { Express } from 'express';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';

import { getEnv } from './config/env.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { createRateLimiter } from './middleware/rate-limit.middleware.js';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware.js';
import { createAuthorizeRouter } from './routes/authorize.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createAuditRouter } from './routes/audit.routes.js';
import { createLocalAuthRouter } from './routes/local-auth.routes.js';
import { createAdminRouter } from './routes/admin.routes.js';
import { AuthorizeController } from './controllers/authorize.controller.js';
import { AuthorizeService } from './services/authorize.service.js';
import { TokenValidationService } from './services/token-validation.service.js';
import { LocalAuthService } from './services/local-auth.service.js';
import { PermissionRepository } from './repositories/permission.repository.js';
import { AuditRepository } from './repositories/audit.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { AuditService } from './services/audit.service.js';
import { ResourceResolverService } from './services/resource-resolver.service.js';
import { PermissionEvaluatorService } from './services/permission-evaluator.service.js';
import { InvalidRequestError } from './domain/authorization.errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppDependencies {
  tokenValidator?: TokenValidationService;
  permissionRepo?: PermissionRepository;
  auditRepo?: AuditRepository;
  disableRateLimit?: boolean;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const env = getEnv();
  const app = express();

  // Configure reverse proxy trust
  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  // 1. Core security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:']
        }
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );

  // 2. CORS configuration for frontend clients (e.g. authz-guard-ui, AuthLens)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-ID');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // 3. Request body parsing with strict configurable size limit
  app.use(
    express.json({
      limit: env.MAX_REQUEST_BODY_BYTES,
      strict: true
    })
  );

  // 4. Request Correlation ID
  app.use(requestIdMiddleware());

  // 5. Rate Limiting (can be bypassed in unit tests via dependency injection)
  if (!dependencies.disableRateLimit && env.NODE_ENV !== 'test') {
    app.use(createRateLimiter());
  }

  // 6. Mount OpenAPI / Swagger UI documentation
  try {
    const openApiPath = path.resolve(__dirname, '../openapi.yaml');
    if (fs.existsSync(openApiPath)) {
      const openApiFile = fs.readFileSync(openApiPath, 'utf8');
      const swaggerDocument = YAML.parse(openApiFile);
      app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
      app.get('/openapi.json', (_req, res) => {
        res.json(swaggerDocument);
      });
    }
  } catch {
    // If documentation fails to load at runtime, service continues
  }

  // 7. Mount Health routes (liveness and readiness)
  app.use(createHealthRouter());

  // 8. Mount Audit Log route (development & observability)
  app.use(createAuditRouter());

  // 9. Mount Local Auth routes (register / login)
  app.use(createLocalAuthRouter());

  // 10. Mount Admin routes (protected by admin JWT)
  app.use(createAdminRouter());

  // 11. Seed default admin user if not present
  try {
    const localAuth = new LocalAuthService();
    const userRepo = new UserRepository();
    const adminEmail = process.env['ADMIN_EMAIL'] || 'admin@authz-guard.local';
    const adminPassword = process.env['ADMIN_PASSWORD'] || 'Admin@1234!';
    userRepo.ensureAdmin(adminEmail, localAuth.hashPassword(adminPassword));
  } catch {
    // Non-fatal: admin seed failure should not block startup
  }

  // 9. Assemble services and mount Authorize routes
  const tokenValidator = dependencies.tokenValidator || new TokenValidationService();
  const permissionRepo = dependencies.permissionRepo || new PermissionRepository();
  const auditRepo = dependencies.auditRepo || new AuditRepository();
  const auditService = new AuditService(auditRepo);
  const resourceResolver = new ResourceResolverService();
  const permissionEvaluator = new PermissionEvaluatorService();

  const authorizeService = new AuthorizeService(
    tokenValidator,
    resourceResolver,
    permissionEvaluator,
    permissionRepo,
    auditService
  );

  const authorizeController = new AuthorizeController(authorizeService);
  app.use(createAuthorizeRouter(authorizeController));
  app.use((req, _res, next) => {
    next(new InvalidRequestError(`Route not found: ${req.method} ${req.path}`));
  });

  app.use(errorHandlerMiddleware());

  return app;
}

// Export default application instance
export const app = createApp();
