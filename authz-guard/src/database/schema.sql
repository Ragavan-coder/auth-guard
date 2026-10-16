CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('read', 'write', 'delete')),
  resource TEXT NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny'))
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_action
  ON user_permissions(user_id, action);

CREATE INDEX IF NOT EXISTS idx_user_permissions_lookup
  ON user_permissions(user_id, action, resource);
CREATE TABLE IF NOT EXISTS authorization_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'DENY')),
  reason_code TEXT NOT NULL,
  matched_policy_ids TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_authorization_audit_request
  ON authorization_audit(request_id);
CREATE INDEX IF NOT EXISTS idx_authorization_audit_user_time
  ON authorization_audit(user_id, created_at);
