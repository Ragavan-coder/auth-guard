# AuthZ Guard: Threat Model & Security Architecture

## 1. Protected Assets & Security Objectives

| Asset                    | Description                                               | Objective                                                  |
| ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| **Downstream Resources** | Protected business APIs (transactions, wallets, accounts) | Prevent unauthorized access or privilege escalation        |
| **ACL Policy Rules**     | Stored in SQLite (`user_permissions`)                     | Preserve integrity and confidentiality of permission rules |
| **Audit Log Trail**      | Stored in SQLite (`authorization_audit`)                  | Preserve non-repudiation and auditability of decisions     |
| **Cryptographic Trust**  | Public JWKS keys from IdP                                 | Prevent signature forgery and algorithm confusion          |

---

## 2. Threat Actors & Capabilities

1. **Unauthenticated Public Caller**: Accesses API without credentials or with expired/corrupted tokens. Seeks authentication bypass or service disruption.
2. **Authenticated Low-Privilege User**: Has valid token issued by trusted IdP for their own identity (`user123`), but attempts to access or mutate resources belonging to others (`wallets/wallet-789`).
3. **Malicious Reverse Proxy / MITM**: Attempts to manipulate headers, correlation IDs, or injected proxy IPs.

---

## 3. Trust Boundaries

```
[ Client / Caller ]
        |
======= | =================== [ Trust Boundary 1: Network Ingress ] =======
        v
[ AuthZ Guard Express Pipeline ]
        |
        +--- Checks JWKS ---> [ Trust Boundary 2: IdP Public Keys ]
        |
======= | =================== [ Trust Boundary 3: Local Data Storage ] ===
        v
[ SQLite Database (authz.db) ]
```

---

## 4. Attack Scenarios & Mitigations

### 4.1 JWT Forgery and Algorithm Confusion

- **Attack**: Supplying an unsigned token with `"alg": "none"`, or signing with an untrusted symmetric key hoping the verifier accepts HMAC with an RSA public key.
- **Mitigation**: `jose.jwtVerify` is invoked with an explicit algorithm allowlist (`ALLOWED_JWT_ALGORITHMS`: `RS256`, `ES256`, `EdDSA`). Tokens using `"none"` or unapproved algorithms are rejected immediately. Unsigned or improperly signed tokens throw `InvalidTokenError` and return HTTP 401.

### 4.2 Caller Identity Spoofing

- **Attack**: Supplying a legitimate token for `user123`, but injecting `"user_id": "admin789"` into the JSON request body.
- **Mitigation**: The authorization service strictly extracts the user identity from the cryptographically verified `sub` claim of the access token. Any `user_id` provided in the request payload is ignored and never trusted.

### 4.3 Path Traversal and Segment Boundary Escaping

- **Attack**: Supplying paths with dot segments (`/transactions/../admin`), encoded traversal (`/%2e%2e/admin`), encoded separators (`/wallets%2ftransactions`), or backslashes (`\`).
- **Mitigation**: `normalizeResourcePath` validates and canonicalizes input paths. Any detected traversal, ambiguous separator, or malformed percent-encoding causes immediate rejection with HTTP 400 `INVALID_REQUEST`.

### 4.4 SQL Injection

- **Attack**: Malicious path or parameter strings injected to alter SQLite queries.
- **Mitigation**: 100% of database interactions in `PermissionRepository` and `AuditRepository` use prepared statements with parameterized binds (`better-sqlite3.prepare(sql).all(param1, param2)`). No user-controlled strings are ever concatenated or interpolated into SQL statements.

### 4.5 Denial of Service (DoS)

- **Attack**: Flooding with huge JSON bodies, rapid requests, or locking the SQLite database.
- **Mitigation**:
  - Request body size capped at `MAX_REQUEST_BODY_BYTES` (default 16 KB).
  - Rate limiting enforced via `express-rate-limit` per IP.
  - SQLite configured with `busy_timeout = 5000` and WAL mode (`journal_mode = WAL`) to allow concurrent readers without locking writers.

### 4.6 Credential Leakage in Logs & Audit

- **Attack**: Intercepting bearer tokens or private keys via system logs or audit tables.
- **Mitigation**:
  - Structured logger (`pino`) explicitly redacts authorization headers, bearer tokens, cookies, and secret fields.
  - SQLite `authorization_audit` schema does not have columns for tokens or headers.
  - Error responses to unauthenticated callers return generic safe messages without internal stack traces or cryptographic error details.

### 4.7 Fail-Closed Guarantee

- In the event of an expired token, missing permission, database query failure, unhandled exception, or ambiguous policy configuration, the system **fails closed**. An unauthenticated or failed request will **never** yield an `ALLOW` decision.

---

## 5. Residual Risks & SQLite Operational Limits

1. **Host-Level Compromise**: SQLite is an embedded file-based database. It does not provide network isolation or hardware-level write-once-read-many (WORM) storage. If the host operating system or root container is compromised, the database file could be read or modified.
2. **Single-Writer Constraint**: While SQLite with WAL mode supports high-throughput concurrent readers, write operations (such as high-volume audit logging) serialize on a single database lock. For multi-node horizontal scale, audit events should be published to Kafka/RabbitMQ or an external managed database (e.g. PostgreSQL).
