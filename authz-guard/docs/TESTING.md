# AuthZ Guard: Quality Assurance & Testing Strategy

## 1. Testing Philosophy

AuthZ Guard uses an automated, multi-tiered testing strategy designed for 100% offline reproducibility and high test coverage. No active internet connection or external identity provider account is required to execute the full test suite.

---

## 2. Test Pyramid & Directory Structure

```
tests/
├── fixtures/
│   ├── permissions.fixture.ts     # Deterministic sample permissions fixture
│   ├── test-keys.ts               # In-memory RSA-256 test keypair and JWKS
│   └── test-token.factory.ts      # Factory for generating valid/expired/untrusted JWTs
├── unit/
│   ├── http-method.mapper.test.ts # Method-to-action mapping and 405 checks
│   ├── path-normalizer.test.ts    # Path traversal, encoding, and slash normalization
│   ├── permission-evaluator.test.ts # Precedence, specificity, and default deny
│   ├── policy-specificity.test.ts # Specificity ranking order and tie-breakers
│   ├── token-validation.test.ts   # Jose token validation and claim verification
│   └── wildcard-matcher.test.ts   # Global, internal, and terminal wildcard semantics
├── integration/
│   ├── audit.repository.test.ts   # Parameterized audit log persistence
│   ├── authorize.routes.test.ts   # Supertest HTTP integration and correlation IDs
│   ├── database.migration.test.ts # Schema migration repeatability and constraints
│   └── permission.repository.test.ts # Parameterized ACL query execution
└── e2e/
    ├── authorization-flow.test.ts # All 9 specification scenarios end-to-end
    └── security-boundaries.test.ts # Adversarial inputs, fail-closed tests, and header checks
```

---

## 3. Running Test Suites

### Execute Full Test Suite

```bash
npm test
```

### Run Specific Test Categories

```bash
# 1. Pure Unit Tests
npm run test:unit

# 2. Database & HTTP Integration Tests
npm run test:integration

# 3. End-to-End & Adversarial Security Tests
npm run test:e2e
```

### Quality Gate Commands

```bash
npm run lint          # Run ESLint check
npm run typecheck     # Verify strict TypeScript compilation
npm run format:check  # Verify Prettier code formatting
npm run build         # Verify production build compilation
```

---

## 4. Test Coverage & Key Scenarios

| Test Suite                      | Tests | Key Validations                                                                                                                                                    |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `http-method.mapper.test.ts`    | 5     | Validates `GET`/`HEAD` -> `read`, `POST`/`PUT`/`PATCH` -> `write`, `DELETE` -> `delete`, and HTTP 405 rejection of unsupported methods (`OPTIONS`, `TRACE`, etc.). |
| `path-normalizer.test.ts`       | 10    | Rejects path traversal (`..`, `%2e%2e`), encoded slashes (`%2f`), backslashes, control characters, query strings, and fragments.                                   |
| `wildcard-matcher.test.ts`      | 7     | Verifies global `*`, internal `*` (1 segment), terminal `/*` (zero or more trailing segments), and collection inheritance.                                         |
| `policy-specificity.test.ts`    | 5     | Verifies exact match > narrow wildcard > broad wildcard > collection inheritance > global `*`.                                                                     |
| `permission-evaluator.test.ts`  | 6     | Verifies deny precedence at equal specificity, narrow allow overriding broad deny, narrow deny overriding broad allow, and default deny.                           |
| `token-validation.test.ts`      | 7     | Verifies RSA signatures, expiration, wrong issuer, wrong audience, rogue keys, and missing subject claims.                                                         |
| `database.migration.test.ts`    | 2     | Verifies idempotent migrations and SQLite CHECK constraints on action and effect.                                                                                  |
| `permission.repository.test.ts` | 4     | Verifies parameterized SQL statements and error handling.                                                                                                          |
| `audit.repository.test.ts`      | 2     | Verifies audit event persistence and confirms no sensitive tokens or headers are stored.                                                                           |
| `authorize.routes.test.ts`      | 8     | Verifies HTTP status codes, correlation ID propagation, and health endpoints.                                                                                      |
| `authorization-flow.test.ts`    | 10    | Verifies all 9 user scenarios from the specification and confirms audit entries.                                                                                   |
| `security-boundaries.test.ts`   | 7     | Verifies body spoofing protection, oversized payload rejection, fail-closed database errors, and Helmet headers.                                                   |

**Total Tests**: 73 passing tests across 12 test files.
