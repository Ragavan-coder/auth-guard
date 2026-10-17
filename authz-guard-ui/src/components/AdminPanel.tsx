import React, { useState, useEffect } from "react";

const API = "http://localhost:3000";

interface Permission {
  id: number;
  user_id: string;
  action: string;
  resource: string;
  effect: string;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
  permissions: Permission[];
}

interface AuditEntry {
  id: number;
  request_id: string;
  user_id: string | null;
  action: string;
  resource: string;
  decision: "ALLOW" | "DENY";
  reason_code: string;
  matched_policy_ids: number[];
  created_at: string;
}

interface AdminPanelProps {
  onClose: () => void;
}

function apiFetch(path: string, init?: RequestInit, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...init, headers });
}

const ADMIN_SESSION_KEY = "authz_guard_admin_token";

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [adminToken, setAdminToken] = useState<string>(() => {
    try {
      return localStorage.getItem(ADMIN_SESSION_KEY) || "";
    } catch {
      return "";
    }
  });
  const [stage, setStage] = useState<"login" | "dashboard">(() => {
    try {
      return localStorage.getItem(ADMIN_SESSION_KEY) ? "dashboard" : "login";
    } catch {
      return "login";
    }
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [adminTab, setAdminTab] = useState<"users" | "audit">("users");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditDecisionFilter, setAuditDecisionFilter] = useState<string>("ALL");
  const [auditUserFilter, setAuditUserFilter] = useState<string>("ALL");

  const [toast, setToast] = useState("");
  const [showAddPerm, setShowAddPerm] = useState<number | null>(null);
  const [newPerm, setNewPerm] = useState({ user_id: "", action: "read", resource: "", effect: "allow" });

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-load users & audit if already authenticated via maintained session
  useEffect(() => {
    if (adminToken && stage === "dashboard") {
      loadUsers(adminToken);
      loadAuditLogs("ALL", "ALL");
    }
  }, [adminToken, stage]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const handleAdminSignOut = () => {
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // storage fallback
    }
    setAdminToken("");
    setStage("login");
    showToast("Admin session signed out.");
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data?.error?.message || "Invalid credentials.");
        return;
      }
      if (data.user?.role !== "admin") {
        setLoginError("Access denied — this account does not have admin privileges.");
        return;
      }
      setAdminToken(data.token);
      try {
        localStorage.setItem(ADMIN_SESSION_KEY, data.token);
      } catch {
        // storage fallback
      }
      setStage("dashboard");
      loadUsers(data.token);
      loadAuditLogs("ALL", "ALL");
    } catch {
      setLoginError("Could not reach the backend. Is the server running?");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loadUsers = async (token: string) => {
    setIsLoadingUsers(true);
    try {
      const res = await apiFetch("/admin/users", {}, token);
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      showToast("Failed to load users.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadAuditLogs = async (decision = auditDecisionFilter, userFilter = auditUserFilter) => {
    setIsLoadingAudit(true);
    try {
      let url = `${API}/audit?limit=50`;
      if (decision && decision !== "ALL") {
        url += `&decision=${decision}`;
      }
      if (userFilter && userFilter !== "ALL") {
        url += `&user_id=${encodeURIComponent(userFilter)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setAuditEntries(data.entries || []);
    } catch {
      showToast("Failed to load audit logs.");
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Delete user "${user.email}" and all their permissions?`)) return;
    try {
      const res = await apiFetch(`/admin/users/${user.id}`, { method: "DELETE" }, adminToken);
      if (res.ok) {
        showToast(`User ${user.email} deleted.`);
        loadUsers(adminToken);
      } else {
        const d = await res.json();
        showToast(d?.error?.message || "Delete failed.");
      }
    } catch {
      showToast("Network error.");
    }
  };

  const handleRoleChange = async (user: AdminUser, role: "user" | "admin") => {
    try {
      const res = await apiFetch(
        `/admin/users/${user.id}/role`,
        { method: "PUT", body: JSON.stringify({ role }) },
        adminToken
      );
      if (res.ok) {
        showToast(`Role updated to ${role}.`);
        loadUsers(adminToken);
      }
    } catch {
      showToast("Failed to update role.");
    }
  };

  const handleDeletePermission = async (permId: number) => {
    try {
      const res = await apiFetch(`/admin/permissions/${permId}`, { method: "DELETE" }, adminToken);
      if (res.ok) {
        showToast("Permission removed.");
        loadUsers(adminToken);
      }
    } catch {
      showToast("Failed to remove permission.");
    }
  };

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerm.user_id || !newPerm.resource) {
      showToast("User ID and Resource are required.");
      return;
    }
    const cleanResource =
      newPerm.resource.trim().replace(/^\/+/, "").replace(/\/+$/, "") || newPerm.resource.trim();
    try {
      const res = await apiFetch(
        "/admin/permissions",
        { method: "POST", body: JSON.stringify({ ...newPerm, resource: cleanResource }) },
        adminToken
      );
      if (res.ok) {
        showToast("Permission added.");
        setShowAddPerm(null);
        setNewPerm({ user_id: "", action: "read", resource: "", effect: "allow" });
        loadUsers(adminToken);
      } else {
        const d = await res.json();
        showToast(d?.error?.message || "Failed to add permission.");
      }
    } catch {
      showToast("Network error.");
    }
  };

  return (
    <div className="admin-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`admin-panel ${isMaximized ? "is-maximized" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="admin-header">
          <div className="admin-header-left">
            <span className="admin-shield-icon">🛡️</span>
            <div>
              <h2 className="admin-title">Admin Console</h2>
              <p className="admin-subtitle">
                {stage === "dashboard"
                  ? "User, Permission & Audit Management"
                  : "Administrator Authentication"}
              </p>
            </div>
          </div>
          <div className="admin-header-actions">
            {stage === "dashboard" && (
              <>
                <button
                  type="button"
                  className="admin-signout-btn"
                  onClick={handleAdminSignOut}
                  title="Sign Out of Admin Console"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  className="admin-size-toggle-btn"
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? "Restore Size" : "Maximize Screen"}
                >
                  {isMaximized ? "❐ Restore" : "⛶ Maximize"}
                </button>
              </>
            )}
            <button
              type="button"
              className="admin-close-btn"
              onClick={onClose}
              aria-label="Close admin panel"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {toast && <div className="admin-toast">{toast}</div>}

        {/* Login Stage */}
        {stage === "login" && (
          <div className="admin-login-container">
            <div className="admin-login-form">
              <div className="admin-login-info">
                <span className="admin-info-icon">ℹ️</span>
                <span>Default credentials: <code>admin@authz-guard.local</code> / <code>Admin@1234!</code></span>
              </div>
              <form onSubmit={handleAdminLogin} className="local-form">
                <div className="input-group">
                  <label className="input-label">Admin Email</label>
                  <div className="input-wrapper">
                    <input
                      type="email"
                      className="text-input"
                      placeholder="admin@authz-guard.local"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Password</label>
                  <div className="input-wrapper">
                    <input
                      type="password"
                      className="text-input"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {loginError && <div className="local-error">{loginError}</div>}
                <button type="submit" className="submit-btn" disabled={isLoggingIn}>
                  {isLoggingIn ? <span className="spinner" /> : "Access Admin Console"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Dashboard Stage */}
        {stage === "dashboard" && (
          <div className="admin-dashboard-container">
            {/* Sticky Navigation Bar */}
            <div className="admin-nav-bar">
              <div className="admin-nav-tabs">
                <button
                  type="button"
                  className={`admin-nav-tab ${adminTab === "users" ? "active" : ""}`}
                  onClick={() => setAdminTab("users")}
                >
                  👥 Users & Permissions ({users.length})
                </button>
                <button
                  type="button"
                  className={`admin-nav-tab ${adminTab === "audit" ? "active" : ""}`}
                  onClick={() => { setAdminTab("audit"); loadAuditLogs(); }}
                >
                  📋 Audit Log ({auditEntries.length})
                </button>
              </div>

              {adminTab === "users" ? (
                <div className="admin-subtoolbar">
                  <span className="admin-user-count">{users.length} registered user{users.length !== 1 ? "s" : ""}</span>
                  <button type="button" className="admin-refresh-btn" onClick={() => loadUsers(adminToken)}>
                    ↺ Refresh
                  </button>
                </div>
              ) : (
                <div className="admin-subtoolbar">
                  <div className="audit-filter-group">
                    <span className="audit-filter-label">Filter:</span>
                    <button
                      type="button"
                      className={`audit-filter-btn ${auditDecisionFilter === "ALL" ? "active" : ""}`}
                      onClick={() => { setAuditDecisionFilter("ALL"); loadAuditLogs("ALL", auditUserFilter); }}
                    >
                      ALL
                    </button>
                    <button
                      type="button"
                      className={`audit-filter-btn filter-allow ${auditDecisionFilter === "ALLOW" ? "active" : ""}`}
                      onClick={() => { setAuditDecisionFilter("ALLOW"); loadAuditLogs("ALLOW", auditUserFilter); }}
                    >
                      ALLOW
                    </button>
                    <button
                      type="button"
                      className={`audit-filter-btn filter-deny ${auditDecisionFilter === "DENY" ? "active" : ""}`}
                      onClick={() => { setAuditDecisionFilter("DENY"); loadAuditLogs("DENY", auditUserFilter); }}
                    >
                      DENY
                    </button>
                  </div>

                  <div className="audit-filter-group audit-user-filter">
                    <span className="audit-filter-label">User:</span>
                    <select
                      className="audit-user-select"
                      value={auditUserFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAuditUserFilter(val);
                        loadAuditLogs(auditDecisionFilter, val);
                      }}
                    >
                      <option value="ALL">All Identities</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.username || u.email}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="admin-refresh-btn"
                    onClick={() => loadAuditLogs(auditDecisionFilter, auditUserFilter)}
                  >
                    ↺ Refresh
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Content View */}
            <div className="admin-scrollable-body">
              {/* TAB 1: USERS & PERMISSIONS */}
              {adminTab === "users" && (
                <div className="admin-users-view">
                  {isLoadingUsers ? (
                    <div className="admin-loading">
                      <span className="spinner large-spinner" />
                      <p>Loading users...</p>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="admin-empty">No registered users yet.</div>
                  ) : (
                    <div className="admin-user-list">
                      {users.map((user) => (
                        <div key={user.id} className="admin-user-card">
                          <div className="admin-user-header">
                            <div className="admin-user-avatar">{user.username.charAt(0).toUpperCase()}</div>
                            <div className="admin-user-info">
                              <div className="admin-user-name">{user.username}</div>
                              <div className="admin-user-email">{user.email}</div>
                              <div className="admin-user-meta">
                                <span className={`role-badge role-${user.role}`}>{user.role}</span>
                                <span className="admin-user-date">Joined {new Date(user.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="admin-user-actions">
                              <select
                                className="role-select"
                                value={user.role}
                                onChange={(e) => handleRoleChange(user, e.target.value as "user" | "admin")}
                                disabled={user.role === "admin" && users.filter((u) => u.role === "admin").length <= 1}
                              >
                                <option value="user">user</option>
                                <option value="admin">admin</option>
                              </select>
                              <button
                                type="button"
                                className="admin-expand-btn"
                                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                              >
                                {expandedUser === user.id ? "▲ Perms" : "▼ Perms"} ({user.permissions.length})
                              </button>
                              {user.role !== "admin" && (
                                <button
                                  type="button"
                                  className="admin-delete-user-btn"
                                  onClick={() => handleDeleteUser(user)}
                                  title="Delete user"
                                >
                                  🗑 Delete
                                </button>
                              )}
                            </div>
                          </div>

                          {expandedUser === user.id && (
                            <div className="admin-perm-panel">
                              <div className="admin-perm-header">
                                <span>Permissions for <code>{user.username}</code> ({user.email})</span>
                                <button
                                  type="button"
                                  className="admin-add-perm-btn"
                                  onClick={() => {
                                    setShowAddPerm(user.id);
                                    setNewPerm({ user_id: user.username || user.email, action: "read", resource: "", effect: "allow" });
                                  }}
                                >
                                  + Add Rule
                                </button>
                              </div>

                              {user.permissions.length === 0 ? (
                                <p className="admin-no-perms">No permissions assigned.</p>
                              ) : (
                                <div className="perm-table-wrapper">
                                  <table className="perm-table">
                                    <thead>
                                      <tr>
                                        <th>Action</th>
                                        <th>Resource Pattern</th>
                                        <th>Effect</th>
                                        <th></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {user.permissions.map((p) => (
                                        <tr key={p.id}>
                                          <td><span className={`action-badge action-${p.action}`}>{p.action}</span></td>
                                          <td><code className="resource-code">{p.resource}</code></td>
                                          <td><span className={`effect-badge effect-${p.effect}`}>{p.effect}</span></td>
                                          <td>
                                            <button
                                              type="button"
                                              className="perm-delete-btn"
                                              onClick={() => handleDeletePermission(p.id)}
                                              title="Remove Rule"
                                            >
                                              ✕
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {showAddPerm === user.id && (
                                <form onSubmit={handleAddPermission} className="add-perm-form">
                                  <div className="add-perm-row">
                                    <select
                                      value={newPerm.action}
                                      onChange={(e) => setNewPerm({ ...newPerm, action: e.target.value })}
                                      className="perm-select"
                                    >
                                      <option value="read">read</option>
                                      <option value="write">write</option>
                                      <option value="delete">delete</option>
                                    </select>
                                    <input
                                      type="text"
                                      className="perm-input"
                                      placeholder="resource pattern (e.g. wallets/* or transactions)"
                                      value={newPerm.resource}
                                      onChange={(e) => setNewPerm({ ...newPerm, resource: e.target.value })}
                                      required
                                    />
                                    <select
                                      value={newPerm.effect}
                                      onChange={(e) => setNewPerm({ ...newPerm, effect: e.target.value })}
                                      className="perm-select"
                                    >
                                      <option value="allow">allow</option>
                                      <option value="deny">deny</option>
                                    </select>
                                    <button type="submit" className="perm-save-btn">Save Rule</button>
                                    <button type="button" className="perm-cancel-btn" onClick={() => setShowAddPerm(null)}>Cancel</button>
                                  </div>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AUDIT LOG */}
              {adminTab === "audit" && (
                <div className="admin-audit-view">
                  {isLoadingAudit ? (
                    <div className="admin-loading">
                      <span className="spinner large-spinner" />
                      <p>Loading audit trail...</p>
                    </div>
                  ) : auditEntries.length === 0 ? (
                    <div className="admin-empty">No audit entries found.</div>
                  ) : (
                    <div className="audit-table-wrapper">
                      <table className="audit-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Decision</th>
                            <th>User ID</th>
                            <th>Action</th>
                            <th>Resource Path</th>
                            <th>Reason Code</th>
                            <th>Request ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditEntries.map((row) => (
                            <tr key={row.id}>
                              <td className="audit-time">{row.created_at}</td>
                              <td>
                                <span className={`decision-badge badge-${row.decision.toLowerCase()}`}>
                                  {row.decision}
                                </span>
                              </td>
                              <td>
                                <div className="audit-user-cell">
                                  <code
                                    className="audit-user clickable-audit-user"
                                    title="Click to filter by this user"
                                    onClick={() => {
                                      const u = row.user_id || "ALL";
                                      setAuditUserFilter(u);
                                      loadAuditLogs(auditDecisionFilter, u);
                                    }}
                                  >
                                    {row.user_id || "anonymous"}
                                  </code>
                                  {row.user_id &&
                                    (row.user_id === "Ragavan S" ||
                                      users.some(
                                        (u) =>
                                          (u.username === row.user_id || u.email === row.user_id) &&
                                          !u.username.startsWith("user") &&
                                          !u.username.startsWith("admin")
                                      )) && (
                                      <span className="signed-user-tag" title="Signed User">
                                        ⭐ Signed
                                      </span>
                                    )}
                                </div>
                              </td>
                              <td><span className={`action-badge action-${row.action}`}>{row.action}</span></td>
                              <td><code className="resource-code">{row.resource}</code></td>
                              <td><span className="reason-code-badge">{row.reason_code}</span></td>
                              <td className="audit-req-id" title={row.request_id}>
                                {row.request_id.slice(0, 8)}...
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
