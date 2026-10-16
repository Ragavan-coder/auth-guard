# Security Policy: AuthZ Guard

## 1. Supported Versions

| Version | Supported |
|---|---|
| 1.0.x | Yes |
| < 1.0 | No |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability or potential exploit in AuthZ Guard, please do **NOT** open a public issue. Instead, report it privately to the security team via:

- **Email**: `security@authz-guard.internal`
- **PGP Key Fingerprint**: `9B4F 3A21 C765 8D92 110E  881A 45BC 2210 EF78 9012`

Please include:
1. Detailed description of the potential vulnerability.
2. Steps to reproduce or a minimal proof of concept (PoC).
3. Potential impact on authorization boundaries or confidentiality.

We commit to acknowledging your report within 24 hours and providing an assessment within 72 hours.

---

## 3. Security Design Guarantees

1. **No Token Storage**: AuthZ Guard verifies cryptographically signed OAuth2/OIDC JWTs and strictly avoids storing tokens, bearer credentials, or passwords in application memory, logs, or SQLite tables.
2. **Fail Closed**: All authentication and operational exceptions result in access denial. No error or database partition can trigger an `ALLOW` decision.
3. **Prepared Statements**: All SQL queries use parameterized queries via `better-sqlite3` to guarantee injection safety.
4. **Strict Algorithm Allowlist**: Algorithms are constrained to verified asymmetric suites (`RS256`, `ES256`, `EdDSA`). The insecure `"none"` algorithm is rejected unconditionally.
5. **Least Privilege Runtime**: Docker images execute as unprivileged non-root user `node` (UID 1000).
