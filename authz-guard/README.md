# AuthZ Guard

> Production-minded OAuth2/OIDC Authentication & Fine-Grained Authorization Service

AuthZ Guard is a high-assurance authorization service that cryptographically validates OAuth2/OIDC access tokens using `jose` and evaluates fine-grained ACL permissions with deterministic specificity, explicit-deny precedence, segment-aware wildcard matching, and hierarchical inheritance using SQLite (`better-sqlite3`).

---

## 1. Features

- **Strict Cryptographic Token Validation**: Verifies RS256/ES256/EdDSA JWT access tokens against trusted issuer JWKS with automated caching and key rotation handling.
- **Fail-Closed Architecture**: Token expiration, unverified claims, missing policies, malformed paths, or database errors fail closed—never granting unauthorized access.
- **Deterministic Precedence Engine**: Policy conflicts are resolved via a 4-dimensional specificity vector and explicit-deny tie-breaking. Decisions never depend on database row insertion order.
- **Segment-Aware Wildcards & Inheritance**: Full support for global wildcards (`*`), internal single-segment wildcards (`*`), zero-or-more terminal wildcards (`/*`), and top-level collection inheritance.
- **Explainable Decisions**: Responses provide the decision, safe reason codes (`POLICY_ALLOW`, `EXPLICIT_DENY`, `INHERITED_DENY`, `NO_MATCHING_POLICY`), and the exact subset of policies that determined the outcome.
- **Zero-Trust Audit Logging**: Structured JSON audit events and SQLite persistence with complete redaction of tokens, bearer headers, and secrets.
- **Security Hardening**: Built-in Helmet security headers, configurable IP rate limiting, path traversal protection, parameterized SQL queries, and non-root Docker containerization.
- **Interactive OpenAPI 3.1 & Swagger UI**: Available out-of-the-box at `/docs`.

---

## 2. Architecture Diagram

```
                              +-------------------------------------------+
                              |   OAuth2 / OIDC Identity Provider (IdP)   |
                              +-------------------------------------------+
                                   |                                   |
                1. Authenticate &  |                                   | 2. Fetch JWKS
                   Issue signed    |                                   |    Public Keys
                   JWT Token       v                                   v
             +---------------------------+   POST /authorize   +---------------------------+
             |    Client Application     |-------------------->|        AuthZ Guard        |
             |   (API Gateway / Proxy)   |<--------------------|   Authorization Service   |
             +---------------------------+   HTTP 200 Decision +---------------------------+
                                                                             |
                                                                             | 3. '[Parameterized
                                                                             |    ACL Queries &
                                                                             |    Audit Logging
                                                                             v
                                                               +---------------------------+
                                                               |   SQLite Database (WAL)   |
                                                               | (user_permissions, audit) |
                                                               +---------------------------+
```

---

## 3. Technology Stack

- **Runtime**: Node.js LTS (v22.20.0 / v20+)
- **Language**: TypeScript 5.7+ (Strict Mode: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`)
- **HTTP Framework**: Express 4.21+
- **Database**: SQLite via `better-sqlite3` with parameterized queries and WAL mode
- **JWT & Cryptography**: `jose` 5.9+
- **Validation**: Zod 3.24+
- **Testing**: Vitest 3.0+ & Supertest 7.0+ (100% offline test suite with local RSA keys)
- **Logging**: Pino with structured JSON logs & redaction
- **Security Middleware**: Helmet & `express-rate-limit`
- **Documentation**: OpenAPI 3.1 & Swagger UI (`swagger-ui-express`)
- **Containerization**: Multi-stage, non-root Docker (`node:22-alpine`) & Docker Compose

---

## 4. Installation & Environment Configuration

### 4.1 Prerequisites
- Node.js LTS (v20+ or v22+)
- npm (v10+ or v11+)

### 4.2 Setup
```bash
# Clone and enter project directory
cd authz-guard

# Install dependencies
npm install

# Create environment configuration from template
cp .env.example .env
```

### 4.3 Environment Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | String | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | Number | `3000` | HTTP listening port |
| `DATABASE_PATH` | String | `./data/authz.db` | Path to SQLite database file or `:memory:` |
| `OIDC_ISSUER_URL` | URL | *(Required)* | Trusted Identity Provider issuer URL |
| `OIDC_AUDIENCE` | String | *(Required)* | Expected audience identifier for API tokens |
| `OIDC_JWKS_URL` | URL | *(Optional)* | Custom JWKS URL (defaults to `/.well-known/jwks.json`) |
| `RATE_LIMIT_WINDOW_MS`| Number | `60000` | Rate limiting sliding window in milliseconds |
| `RATE_LIMIT_MAX` | Number | `100` | Maximum requests per IP per window |
| `LOG_LEVEL` | String | `info` | Logging verbosity (`fatal`, `error`, `warn`, `info`, `debug`) |
| `TRUST_PROXY` | Boolean | `false` | Enable reverse-proxy header trust (Nginx/Cloudflare) |
| `MAX_REQUEST_BODY_BYTES` | Number | `16384` | Maximum allowable request body size (16 KB) |

---

## 5. Database Migrations & Seeding

```bash
# 1. Apply versioned schema migrations
npm run db:migrate

# 2. Seed development permission rules (Guard ensures seeding runs only in non-production)
npm run db:seed
```

---

## 6. Running the Service

```bash
# Start development server with live watch
npm run dev

# Compile production bundle and run
npm run build
npm start
```
The server will start on `http://localhost:3000`.
- Swagger UI Interactive Documentation: `http://localhost:3000/docs`
- OpenAPI Specification (JSON): `http://localhost:3000/openapi.json`
- Liveness Probe: `http://localhost:3000/health/live`
- Readiness Probe: `http://localhost:3000/health/ready`

---

## 7. Running the Automated Test Suites

All 73 tests run completely offline without external network dependencies:

```bash
# Run all 73 tests
npm test

# Run individual test suites
npm run test:unit          # 40 pure unit tests (wildcards, specificity, mapper, normalizer)
npm run test:integration   # 16 integration tests (SQLite migrations, queries, audit, routes)
npm run test:e2e           # 17 end-to-end and security tests (all scenarios & attack vectors)

# Quality gates
npm run lint               # ESLint check
npm run typecheck          # Strict TypeScript compiler verification
npm run format:check       # Prettier code formatting check
npm run build              # Production build compilation check
```

---

## 8. Reproducible Demo Script & Walkthrough Video

> 🎥 **Recorded Video Demonstration & Drive Artifacts**:
> **[Watch Live Demo on Google Drive](https://drive.google.com/drive/folders/1VA31Xr32YBKXcWhk_f_lmv4q5D1UMXMz?usp=sharing)**

Run the automated assessment demo script:
```bash
npm run demo
```
This executes an interactive 6-scenario walkthrough verifying valid ALLOWs, inherited DENYs, wildcard matching, missing permissions, expired token handling, path traversal attack rejection, and audit log persistence.

---

## 9. Identity Provider Setup (Auth0 / AWS Cognito / Ory)

### Auth0 Configuration
1. Create an API in Auth0 Dashboard:
   - **Identifier**: `https://api.example.com/v1` (set as `OIDC_AUDIENCE`).
   - **Signing Algorithm**: `RS256`.
2. Configure AuthZ Guard `.env`:
   - `OIDC_ISSUER_URL=https://<your-tenant>.auth0.com/`
   - `OIDC_AUDIENCE=https://api.example.com/v1`
3. Tokens issued by Auth0 contain `iss`, `aud`, and `sub` matching your user ID.

### AWS Cognito Configuration
1. Create a Cognito User Pool with an App Client and Resource Server.
2. Configure AuthZ Guard `.env`:
   - `OIDC_ISSUER_URL=https://cognito-idp.<region>.amazonaws.com/<userPoolId>`
   - `OIDC_AUDIENCE=<clientId>`

---

## 10. API Contract & curl Examples

### 10.1 POST `/authorize` — ALLOW Outcome
```bash
curl -X POST http://localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -H "x-request-id: req-demo-001" \
  -d '{
    "access_token": "<VALID_JWT_TOKEN>",
    "method": "GET",
    "path": "/transactions"
  }'
```
**Response (HTTP 200)**:
```json
{
  "decision": "ALLOW",
  "user_id": "user123",
  "action": "read",
  "resource": "transactions",
  "reason_code": "POLICY_ALLOW",
  "reason": "A matching allow policy applies at the highest applicable specificity.",
  "matched_permissions": [
    {
      "id": 1,
      "action": "read",
      "resource": "transactions",
      "effect": "allow"
    }
  ],
  "request_id": "req-demo-001"
}
```

### 10.2 POST `/authorize` — DENY Outcome
```bash
curl -X POST http://localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "<VALID_JWT_TOKEN>",
    "method": "DELETE",
    "path": "/transactions/txn-456"
  }'
```
**Response (HTTP 200)**:
```json
{
  "decision": "DENY",
  "user_id": "user123",
  "action": "delete",
  "resource": "transactions/txn-456",
  "reason_code": "INHERITED_DENY",
  "reason": "Inherited explicit delete denial applies at highest applicable specificity.",
  "matched_permissions": [
    {
      "id": 3,
      "action": "delete",
      "resource": "transactions",
      "effect": "deny"
    }
  ],
  "request_id": "generated-correlation-id"
}
```

### 10.3 Error Responses

| HTTP Status | Error Code | Condition |
|---|---|---|
| `400` | `INVALID_REQUEST` | Malformed JSON, missing fields, or path traversal detected |
| `401` | `INVALID_TOKEN` | Token is invalid, expired, or failed cryptographic verification |
| `405` | `METHOD_NOT_ALLOWED` | Unsupported HTTP method in request body (`OPTIONS`, `TRACE`, etc.) |
| `413` | `PAYLOAD_TOO_LARGE` | Request payload exceeds 16 KB body limit |
| `429` | `RATE_LIMITED` | Rate limit threshold exceeded |
| `500` | `INTERNAL_ERROR` | Database or operational failure (fails closed) |

---

## 11. Policy Precedence Algorithm

1. **HTTP Method to Action Mapping**:
   - `GET`, `HEAD` -> `read`
   - `POST`, `PUT`, `PATCH` -> `write`
   - `DELETE` -> `delete`
   - Unknown methods return HTTP 405.
2. **Path Normalization**: Canonicalizes path, removes trailing slashes, rejects traversal (`..`, `%2e%2e`), backslashes, control characters, and query strings.
3. **Database Query**: Retrieves applicable permissions for `(user_id, action)` using parameterized SQL.
4. **Pattern Matching**:
   - Global `*` matches everything.
   - Internal `*` matches exactly one segment (`wallets/*/transactions`).
   - Terminal `/*` matches zero or more trailing segments (`wallets/*`, `wallets/*/transactions/*`).
   - Collection inheritance: single-segment collection policy (`transactions`) applies to descendant items (`transactions/txn-456`). Multi-segment entity policies (`wallets/wallet-789`) match exact entities only.
5. **Specificity Ranking**: Rules are ranked: Exact Literal Match (Tier 4) > Wildcard Patterns (Tier 3) > Collection Inheritance (Tier 2) > Global Wildcard (Tier 1). Narrower wildcards with more fixed segments outrank broader wildcards.
6. **Deny Precedence**: Within the winning highest specificity tier, if any rule has effect `deny`, the decision is **`DENY`**. Narrower allows can override broader inherited denies.
7. **Default Deny**: If no rules match, the decision is **`DENY`** (`NO_MATCHING_POLICY`).

---

## 12. Docker & Container Deployment

```bash
# Build and run using Docker Compose
docker compose up -d

# Verify container health
docker compose ps
curl http://localhost:3000/health/live
```
- Non-root user `node` (UID 1000)
- Multi-stage build with pruned production dependencies
- SQLite data persisted in named volume `authz-data`

---

## 13. Project Structure

```
authz-guard/
├── src/
│   ├── app.ts                          # Express application setup
│   ├── server.ts                       # Server socket & graceful shutdown
│   ├── config/                         # Environment & constants
│   ├── middleware/                     # Request ID, rate limit, error handler, validation
│   ├── routes/                         # Authorize & health routes
│   ├── controllers/                    # Authorization controller
│   ├── services/                       # Orchestration, token validation, evaluator, audit
│   ├── repositories/                   # Parameterized SQLite queries
│   ├── database/                       # Migrations, seed, connection, schema
│   ├── domain/                         # Strongly typed domain errors, tokens, policies
│   └── utils/                          # Matcher, specificity, normalizer, logger
├── tests/
│   ├── fixtures/                       # Deterministic test keys and token factory
│   ├── unit/                           # Pure algorithmic unit tests
│   ├── integration/                    # SQLite and HTTP integration tests
│   └── e2e/                            # End-to-end specification & security tests
├── scripts/
│   ├── demo.ts                         # Reproducible assessment demo
│   └── generate-test-keys.ts           # Local RSA test key generator
├── docs/                               # Architecture, algorithm, threat model, demo
├── Dockerfile                          # Multi-stage non-root container
├── compose.yaml                        # Docker Compose deployment
├── openapi.yaml                        # OpenAPI 3.1 specification
└── package.json                        # Dependencies, scripts, and engines
```
