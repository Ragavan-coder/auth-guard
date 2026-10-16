# AuthZ Guard — Submission Guide

> **Take-Home Coding Exercise: OAuth2 Token Validation & Fine-Grained Authorization Service**

---

## Quick Start (< 3 minutes)

```bash
# 1. Install dependencies
cd authz-guard && npm install

# 2. Configure environment (Auth0 tenant pre-configured in .env)
# No changes needed for local evaluation — .env ships ready-to-use

# 3. Apply database migrations + seed sample permissions
npm run db:migrate && npm run db:seed

# 4. Start the service
npm run dev
# ? AuthZ Guard listening on http://0.0.0.0:3000
# ? Swagger UI: http://localhost:3000/docs

# 5. Run the full automated demo (all scenarios, audit log)
npm run demo

# 6. Run all 73 tests (offline — no network required)
npm test
```

---

## Exercise Requirements Checklist

| Requirement | Status | Implementation |
|---|---|---|
| OAuth2 JWT Token Validation | ? | `jose` JWKS-based cryptographic RS256/ES256/EdDSA verification |
| User Identity Extraction | ? | `sub` claim extracted from verified payload |
| SQLite Permission Database | ? | `better-sqlite3` with parameterized queries, WAL mode |
| `POST /authorize` endpoint | ? | Zod-validated, returns `decision`, `reason_code`, `matched_permissions` |
| HTTP Method ? Action Mapping | ? | GET/HEAD ? read, POST/PUT/PATCH ? write, DELETE ? delete |
| Wildcard Pattern Matching | ? | `*`, `wallets/*`, `wallets/*/transactions/*` |
| Specificity Precedence | ? | 4-dimensional specificity vector, never order-dependent |
| Deny Beats Allow | ? | Explicit deny at highest applicable specificity tier wins |
| Default Deny | ? | `NO_MATCHING_POLICY` ? DENY |
| Unit Tests | ? | 40 unit tests: matcher, normalizer, specificity, evaluator, mapper |
| Integration Tests | ? | 16 integration tests: DB migrations, routes, audit, repositories |
| E2E Tests | ? | 17 E2E tests: all sample scenarios + adversarial security vectors |
| Rate Limiting | ? | `express-rate-limit`, configurable via env |
| Audit Logging | ? | Structured Pino JSON + SQLite persistence, GET /audit endpoint |
| OpenAPI 3.1 + Swagger UI | ? | `/docs`, `/openapi.json` |
| Docker | ? | Multi-stage non-root `docker compose up -d` |
| README Documentation | ? | Architecture, algorithm, curl examples, design decisions |

---

## All Exercise Sample Scenarios — Live curl Commands

> Replace <TOKEN_USERxxx> with a valid JWT whose sub claim = that user ID.
> Auth0 tenant is pre-configured in .env. For offline demo: npm run demo

```bash
# Should ALLOW - user123 has read access to transactions
curl -s -X POST localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<TOKEN_USER123>","method":"GET","path":"/transactions"}' | jq .
# Response: { "decision": "ALLOW", "reason_code": "POLICY_ALLOW", "matched_permissions": [{"id":1,"resource":"transactions","effect":"allow"}] }


# Should DENY - user123 explicitly denied delete access
curl -s -X POST localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<TOKEN_USER123>","method":"DELETE","path":"/transactions/txn-456"}' | jq .
# Response: { "decision": "DENY", "reason_code": "INHERITED_DENY", "matched_permissions": [{"id":3,"resource":"transactions","effect":"deny"}] }


# Should ALLOW - user456 has specific permission for wallet-789 transactions
curl -s -X POST localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<TOKEN_USER456>","method":"GET","path":"/wallets/wallet-789/transactions"}' | jq .
# Response: { "decision": "ALLOW", "matched_permissions": [{"id":7,"resource":"wallets/wallet-789/transactions","effect":"allow"}] }


# Should ALLOW - user789 can write to any transaction in any wallet (pattern: wallets/*/transactions/*)
curl -s -X POST localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<TOKEN_USER789>","method":"POST","path":"/wallets/wallet-456/transactions/txn-999"}' | jq .
# Response: { "decision": "ALLOW", "matched_permissions": [{"id":8,"resource":"wallets/*/transactions/*","effect":"allow"}] }


curl -s -X POST localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<TOKEN_USER789>","method":"POST","path":"/wallets/wallet-789/transactions"}' | jq .
# Response: { "decision": "ALLOW" }  ? terminal /* matches 0 trailing segments


# Should DENY - user456 only has read access to wallet-789 transactions, not write
curl -s -X POST localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<TOKEN_USER456>","method":"POST","path":"/wallets/wallet-789/transactions"}' | jq .
# Response: { "decision": "DENY", "reason_code": "NO_MATCHING_POLICY" }


# Should ALLOW - admin789 has global wildcard permissions
curl -s -X POST localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<TOKEN_ADMIN789>","method":"DELETE","path":"/accounts/acc-123/settings"}' | jq .
# Response: { "decision": "ALLOW", "matched_permissions": [{"id":11,"resource":"*","effect":"allow"}] }


# Wildcard inheritance - user456 GET /wallets/wallet-999 (matches wallets/*)
curl -s -X POST localhost:3000/authorize \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<TOKEN_USER456>","method":"GET","path":"/wallets/wallet-999"}' | jq .
# Response: { "decision": "ALLOW", "matched_permissions": [{"id":5,"resource":"wallets/*","effect":"allow"}] }
```

### Health & Audit Endpoints

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl "http://localhost:3000/audit?limit=20"
curl "http://localhost:3000/audit?user_id=user123&decision=DENY"
# Swagger UI:
open http://localhost:3000/docs
```

---

## Design Decisions & Trade-offs

### 1. Specificity Engine — Order-Independent Determinism

A 4-dimensional specificity vector `(ScopeTier, FixedSegments, -WildcardSegments, PatternDepth)` replaces any insertion-order-based evaluation.

**Why**: An evaluator relying on database row order creates non-deterministic behavior — later-inserted conflicting policies silently change authorization outcomes. The specificity model makes decisions provably reproducible.

**Trade-off**: Higher implementation complexity vs. "first match wins" simplicity. Justified by security correctness.

### 2. Collection Inheritance vs. Multi-Segment Entity Isolation

Single-segment literal policies (`transactions`) inherit to all descendants. Multi-segment literal entities (`wallets/wallet-789`) do NOT inherit to sub-paths — only `wallets/wallet-789/*` would.

**Why**: Prevents inadvertent privilege escalation. Write on `wallets/wallet-789` should not grant write on `wallets/wallet-789/transactions` (a sensitive sub-collection).

### 3. Terminal `/*` Matches Zero or More Trailing Segments

`wallets/*/transactions/*` matches both `wallets/w/transactions` (0 trailing) and `wallets/w/transactions/txn-1` (1 trailing).

**Why**: Models real collection + item access semantics. A grant on `collection/*` intuitively covers both listing and individual items.

### 4. Deny Beats Allow at Equal Specificity; Narrower Allow Overrides Broader Deny

Deny wins only at the same specificity tier. A higher-specificity allow wins over a lower-specificity deny.

**Why**: Avoids "poison deny" where a broad `deny *` makes all narrower allows meaningless. Enables granting specific exceptions above a general deny.

### 5. JWT `sub` Claim as User Identity

User identity is always derived from the cryptographically verified `sub` claim. Body-provided `user_id` fields are ignored.

**Why**: Prevents identity spoofing where a caller passes a malicious `user_id` alongside a lower-privilege token.

### 6. Fail-Closed Architecture

Any error (token failure, database failure, unknown exception) results in DENY and the appropriate HTTP error. No error path can return ALLOW.

**Why**: A broken authorization system that defaults to granting access is a catastrophic security failure.

### 7. SQLite over PostgreSQL

Used `better-sqlite3` (synchronous) for zero external dependencies and embedded operation.

**Trade-off**: Not suitable for write-heavy horizontal scaling. The repository pattern (`PermissionRepository`, `AuditRepository`) isolates the database layer — migration to PostgreSQL requires only new repository implementations.

---

## Areas for Improvement

1. **Policy Management API**: `POST/DELETE /permissions` for runtime policy CRUD.
2. **Permission Caching**: LRU cache on `(userId, action)` policy sets with TTL-based invalidation.
3. **Group/Role Expansion**: Policy inheritance via roles (evaluate role membership before individual policies).
4. **ABAC Context**: Extend `AuthorizeRequest` with arbitrary context attributes (time-of-day, IP range, MFA status) usable in policy conditions.
5. **Distributed Audit**: Stream audit events to Kafka / CloudWatch for cross-service correlation.
6. **JWT Caching**: Cache validated JWT payloads by token fingerprint within their remaining TTL.
7. **Horizontal Scaling**: Redis-backed rate limiting for stateless horizontal scaling.

---

## Assumptions

1. `sub` is the user identity — corresponds 1:1 to `user_id` in `user_permissions`.
2. Collection inheritance applies to top-level single-segment resources only.
3. Terminal `/*` matches zero or more trailing segments.
4. Deny at equal specificity beats allow (AWS IAM / Google IAM semantics).
5. All error paths return DENY, never ALLOW.
6. Service listens on `PORT=3000` by default. Exercise spec used `localhost:8080` — change `PORT=8080` in `.env` if required.
