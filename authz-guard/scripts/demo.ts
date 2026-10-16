import { TEST_ISSUER, TEST_AUDIENCE, getTestKeys } from '../tests/fixtures/test-keys.js';

// Ensure demo environment has valid test variables
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.OIDC_ISSUER_URL = process.env.OIDC_ISSUER_URL || TEST_ISSUER;
process.env.OIDC_AUDIENCE = process.env.OIDC_AUDIENCE || TEST_AUDIENCE;
process.env.DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'fatal';

import Database from 'better-sqlite3';
import { runMigrations } from '../src/database/migrate.js';
import { seedPermissions } from '../src/database/seed.js';
import { PermissionRepository } from '../src/repositories/permission.repository.js';
import { AuditRepository } from '../src/repositories/audit.repository.js';
import { AuditService } from '../src/services/audit.service.js';
import { TokenValidationService } from '../src/services/token-validation.service.js';
import { ResourceResolverService } from '../src/services/resource-resolver.service.js';
import { PermissionEvaluatorService } from '../src/services/permission-evaluator.service.js';
import { AuthorizeService } from '../src/services/authorize.service.js';
import { TestTokenFactory } from '../tests/fixtures/test-token.factory.js';

async function runDemo(): Promise<void> {
  console.log('================================================================');
  console.log('             AUTHZ GUARD: LIVE DEMONSTRATION                   ');
  console.log('================================================================\n');

  // 1. Initialize in-memory database
  console.log('[1] Initializing isolated in-memory SQLite database...');
  const db = new Database(':memory:');
  runMigrations(db);
  const { insertedCount } = seedPermissions(db);
  console.log(`    -> Schema migrations applied. Seeded ${insertedCount} permission rules.\n`);

  // 2. Setup cryptographic keys & services
  console.log('[2] Initializing cryptographic test keys & services...');
  const { localKeyStore } = await getTestKeys();
  const tokenValidator = new TokenValidationService({
    keyStore: localKeyStore,
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE
  });

  const permissionRepo = new PermissionRepository(db);
  const auditRepo = new AuditRepository(db);
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
  console.log('    -> Services initialized with local JWKS and strict validation.\n');

  // 3. Demo Scenario 1: Valid ALLOW
  console.log('----------------------------------------------------------------');
  console.log('Scenario 1: Valid JWT Access Token -> Evaluation: ALLOW');
  console.log('User: user123 | Action: GET /transactions (action=read)');
  const token1 = await TestTokenFactory.createValidToken({ userId: 'user123' });
  const res1 = await authorizeService.execute(
    { access_token: token1, method: 'GET', path: '/transactions' },
    'demo-req-001'
  );
  console.log('Result:', JSON.stringify(res1, null, 2));

  // 4. Demo Scenario 2: Explicit Inherited DENY
  console.log('\n----------------------------------------------------------------');
  console.log('Scenario 2: Inherited Explicit Deny Takes Precedence -> DENY');
  console.log('User: user123 | Action: DELETE /transactions/txn-456 (action=delete)');
  const res2 = await authorizeService.execute(
    { access_token: token1, method: 'DELETE', path: '/transactions/txn-456' },
    'demo-req-002'
  );
  console.log('Result:', JSON.stringify(res2, null, 2));

  // 5. Demo Scenario 3: Wildcard Match
  console.log('\n----------------------------------------------------------------');
  console.log('Scenario 3: Wildcard Access to Nested Wallet Transaction -> ALLOW');
  console.log('User: user789 | Action: POST /wallets/wallet-456/transactions/txn-999');
  console.log('Matched Pattern: wallets/*/transactions/*');
  const token789 = await TestTokenFactory.createValidToken({ userId: 'user789' });
  const res3 = await authorizeService.execute(
    {
      access_token: token789,
      method: 'POST',
      path: '/wallets/wallet-456/transactions/txn-999'
    },
    'demo-req-003'
  );
  console.log('Result:', JSON.stringify(res3, null, 2));

  // 6. Demo Scenario 4: Missing Permission (Default Deny)
  console.log('\n----------------------------------------------------------------');
  console.log('Scenario 4: Missing Permission -> Default DENY');
  console.log('User: user123 | Action: GET /wallets/wallet-789');
  const res4 = await authorizeService.execute(
    { access_token: token1, method: 'GET', path: '/wallets/wallet-789' },
    'demo-req-004'
  );
  console.log('Result:', JSON.stringify(res4, null, 2));

  // 7. Demo Scenario 5: Cryptographic Failure (Expired Token)
  console.log('\n----------------------------------------------------------------');
  console.log('Scenario 5: Cryptographic Security Check -> Expired Token Rejection');
  try {
    const expiredToken = await TestTokenFactory.createExpiredToken('user123');
    await authorizeService.execute(
      { access_token: expiredToken, method: 'GET', path: '/transactions' },
      'demo-req-005'
    );
  } catch (err: unknown) {
    console.log('Security Boundary Triggered Successfully:');
    console.log(`    Status Code: ${(err as { statusCode?: number }).statusCode}`);
    console.log(`    Error Code:  ${(err as { errorCode?: string }).errorCode}`);
    console.log(`    Message:     ${(err as { safeMessage?: string }).safeMessage}`);
  }

  // 8. Demo Scenario 6: Path Traversal Attack
  console.log('\n----------------------------------------------------------------');
  console.log('Scenario 6: Adversarial Path Traversal Attempt -> HTTP 400 Rejection');
  try {
    await authorizeService.execute(
      { access_token: token1, method: 'GET', path: '/transactions/../admin' },
      'demo-req-006'
    );
  } catch (err: unknown) {
    console.log('Security Boundary Triggered Successfully:');
    console.log(`    Status Code: ${(err as { statusCode?: number }).statusCode}`);
    console.log(`    Error Code:  ${(err as { errorCode?: string }).errorCode}`);
    console.log(`    Message:     ${(err as { safeMessage?: string }).safeMessage}`);
  }

  // 9. Audit Log Persistence Verification
  console.log('\n================================================================');
  console.log('                 AUDIT LOG PERSISTENCE CHECK                    ');
  console.log('================================================================');
  const auditRecords = db
    .prepare(
      'SELECT request_id, user_id, action, resource, decision, reason_code FROM authorization_audit'
    )
    .all();
  console.table(auditRecords);

  db.close();
  console.log('\n[+] Demo execution completed successfully.');
}

runDemo().catch((err) => {
  console.error('Demo encountered an error:', err);
  process.exit(1);
});
