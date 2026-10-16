# AuthZ Guard: Architecture & Technical Design

## 1. High-Level Architecture

AuthZ Guard is a high-assurance, deterministic OAuth2/OIDC access-token validation and fine-grained authorization service. It is designed to act as a centralized policy enforcement point (PEP) or policy decision point (PDP) for modern microservices and API gateways.

```
                           +------------------------------------------+
                           |       Identity Provider (Auth0 / IdP)    |
                           +------------------------------------------+
                                                |
                              1. User logs in   | 2. Fetches JWKS
                              & receives JWT    |    (cached locally)
                                                v
+------------------+   POST /authorize     +--------------------------+
|  API Gateway /   |---------------------->|       AuthZ Guard        |
|  Client Service  |<----------------------|   Authorization Service  |
+------------------+   { decision, ... }   +--------------------------+
                                                        |
                                                        | 3. Parameterized
                                                        |    Query
                                                        v
                                           +--------------------------+
                                           |      SQLite Database     |
                                           | (user_permissions, audit)|
                                           +--------------------------+
```

---

## 2. Request Lifecycle

1. **Ingress & Transport Protection**:
   - Helmet sets HTTP security headers (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, and restrictive CSP).
   - `express.json` enforces body size limits (default 16 KB) to prevent memory exhaustion and DoS.
2. **Correlation Tracking**:
   - `requestIdMiddleware` inspects `X-Request-Id` (sanitizing safe strings) or generates a secure UUIDv4.
   - The correlation ID is propagated across all log lines, audit records, and response headers.
3. **Route Ingress & Schema Validation**:
   - `POST /authorize` passes through `validateRequestBody(authorizeRequestSchema)`.
   - Zod validates that `access_token`, `method`, and `path` are non-empty strings.
4. **Token Cryptographic Verification**:
   - `TokenValidationService` uses `jose.jwtVerify` with the issuer's public JWKS.
   - Validates signature, algorithms (`RS256`, `ES256`, etc.), `iss`, `aud`, `exp`, and `nbf`.
   - Extracts and verifies subject claim (`sub`) into a strongly typed `ValidatedIdentity`.
5. **Action & Resource Normalization**:
   - `mapHttpMethodToAction` maps the requested HTTP method (`GET` -> `read`, `POST` -> `write`, `DELETE` -> `delete`). Unsupported methods fail with HTTP 405.
   - `ResourceResolverService` normalizes the path into a canonical resource identifier, stripping harmless trailing slashes and rejecting traversal sequences (`..`), backslashes, query strings, and control characters.
6. **Policy Retrieval & Evaluation**:
   - `PermissionRepository` retrieves candidate rules for `(user_id, action)` using parameterized queries.
   - `PermissionEvaluatorService` evaluates rules using segment-aware wildcard matching, hierarchical inheritance, and specificity ranking.
   - Deny precedence resolves ties at equal specificity; absence of matching allow rules triggers default deny.
7. **Audit & Egress**:
   - `AuditService` logs a sanitized structured JSON event (omitting tokens/secrets) and persists the decision to SQLite table `authorization_audit`.
   - Returns HTTP 200 with `decision`, `reason_code`, and `matched_permissions`.

---

## 3. Module Responsibilities & Separation of Concerns

| Module                                         | Responsibility                                                                        | Dependencies                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/app.ts`                                   | Express application assembly, middleware registration, routing, error pipeline        | Express, Helmet, Routes, Middleware                                                 |
| `src/server.ts`                                | Process entry point, database migration on boot, socket listening, signal termination | App, Connection, Migrate, Logger                                                    |
| `src/config/env.ts`                            | Zod environment validation, typed immutable configuration                             | Zod, dotenv                                                                         |
| `src/controllers/authorize.controller.ts`      | HTTP transport coordination, status mapping                                           | AuthorizeService                                                                    |
| `src/services/authorize.service.ts`            | Application use-case orchestration                                                    | TokenValidator, ResourceResolver, PermissionEvaluator, PermissionRepo, AuditService |
| `src/services/token-validation.service.ts`     | OAuth2/OIDC JWT verification with JWKS caching                                        | `jose`                                                                              |
| `src/services/resource-resolver.service.ts`    | URL canonicalization                                                                  | PathNormalizer                                                                      |
| `src/services/permission-evaluator.service.ts` | Pure policy evaluation engine                                                         | WildcardMatcher, SpecificityRanker                                                  |
| `src/repositories/permission.repository.ts`    | SQL queries for permission records                                                    | `better-sqlite3`                                                                    |
| `src/repositories/audit.repository.ts`         | SQL persistence of authorization outcomes                                             | `better-sqlite3`                                                                    |
| `src/database/connection.ts`                   | SQLite connection lifecycle, WAL mode, pragmas                                        | `better-sqlite3`                                                                    |
| `src/database/migrate.ts`                      | Repeatable versioned schema migration                                                 | `better-sqlite3`, connection                                                        |

---

## 4. Architectural Decisions & Trade-offs

### Why PermissionEvaluatorService is Independent of Express and SQLite

- **Testability**: The authorization evaluation algorithm can be tested exhaustively via pure unit tests with arbitrary policy combinations in milliseconds without spinning up HTTP servers or SQLite databases.
- **Portability**: The policy evaluation core can be embedded in message queues, CLI tools, or event consumers without transport overhead.
- **Security Boundary**: Policy evaluation logic has zero access to network sockets or SQL connection handles, completely preventing side-channel leaks or unintentional database side-effects during policy calculation.

### Identity Provider vs. Authorization Service Boundary

- **Authentication (AuthN)** is delegated entirely to the trusted OAuth2/OIDC Identity Provider (e.g. Auth0, AWS Cognito, Ory). The IdP authenticates users, manages passwords, handles MFA, and issues cryptographically signed JWTs.
- **Authorization (AuthZ)** is governed locally by AuthZ Guard. The service does not store passwords or manage user registration. It verifies the authenticity of the token and checks the caller's fine-grained ACL permissions stored in SQLite.
