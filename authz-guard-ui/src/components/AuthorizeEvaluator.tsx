import React, { useState, useEffect } from "react";

const API = "http://localhost:3000";

interface MatchedPermission {
  id: number;
  action: string;
  resource: string;
  effect: "allow" | "deny";
}

interface AuthorizeResponse {
  decision: "ALLOW" | "DENY";
  user_id: string;
  action: string;
  resource: string;
  reason_code: string;
  reason: string;
  matched_permissions: MatchedPermission[];
  request_id: string;
}

interface UserItem {
  key: string;
  label: string;
  role: string;
  email: string;
}

interface AuthorizeEvaluatorProps {
  onClose?: () => void;
  defaultToken?: string;
  defaultUserId?: string;
}

export function AuthorizeEvaluator({ onClose, defaultToken, defaultUserId }: AuthorizeEvaluatorProps) {
  const [selectedUser, setSelectedUser] = useState<string>(defaultUserId || "Ragavan S");
  const [method, setMethod] = useState<string>("GET");
  const [resource, setResource] = useState<string>("/transactions");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [userList, setUserList] = useState<UserItem[]>([]);
  const [customToken, setCustomToken] = useState<string>(defaultToken || "");
  const [isLoadingTokens, setIsLoadingTokens] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [result, setResult] = useState<AuthorizeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch demo tokens on mount
  useEffect(() => {
    async function loadDemoTokens() {
      try {
        const res = await fetch(`${API}/auth/demo-tokens`);
        if (res.ok) {
          const data = await res.json();
          const loadedTokens = data.tokens || {};
          setTokens(loadedTokens);

          if (data.userList && Array.isArray(data.userList)) {
            setUserList(data.userList);
          }

          // Automatically select signed user if available, or default
          if (defaultUserId && loadedTokens[defaultUserId]) {
            setSelectedUser(defaultUserId);
            setCustomToken(loadedTokens[defaultUserId]);
          } else if (defaultToken) {
            setSelectedUser("custom");
            setCustomToken(defaultToken);
          } else if (loadedTokens["Ragavan S"]) {
            setSelectedUser("Ragavan S");
            setCustomToken(loadedTokens["Ragavan S"]);
          } else if (loadedTokens.user123) {
            setSelectedUser("user123");
            setCustomToken(loadedTokens.user123);
          }
        }
      } catch (err) {
        console.warn("Could not fetch demo tokens", err);
      } finally {
        setIsLoadingTokens(false);
      }
    }
    loadDemoTokens();
  }, [defaultToken, defaultUserId]);

  const handleUserChange = (u: string) => {
    setSelectedUser(u);
    if (u === "custom") {
      setCustomToken(defaultToken || "");
    } else if (tokens[u]) {
      setCustomToken(tokens[u]);
    }
  };

  const handleEvaluate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setResult(null);
    setIsEvaluating(true);

    try {
      const activeToken = customToken || tokens[selectedUser];
      if (!activeToken) {
        setErrorMsg("Please provide or select a valid JWT access token.");
        setIsEvaluating(false);
        return;
      }

      const res = await fetch(`${API}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: activeToken,
          method: method.trim().toUpperCase(),
          path: resource.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(
          data?.error?.message ||
          data?.message ||
          `HTTP ${res.status}: Evaluation error`
        );
        return;
      }

      setResult(data as AuthorizeResponse);
    } catch (err) {
      setErrorMsg(`Failed to connect to backend: ${(err as Error).message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const setScenario = (u: string, m: string, r: string) => {
    handleUserChange(u);
    setMethod(m);
    setResource(r);
    // Auto-trigger evaluation
    setTimeout(() => {
      const token = tokens[u] || customToken;
      if (token) {
        fetch(`${API}/authorize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: token,
            method: m,
            path: r
          })
        })
          .then((res) => res.json())
          .then((d) => {
            if (d.decision) setResult(d);
            else setErrorMsg(d.error?.message || "Error");
          })
          .catch((err) => setErrorMsg(err.message));
      }
    }, 50);
  };

  const signedUserItem = userList.find((u) => u.label.includes("[Signed Person]") || u.key === "Ragavan S");
  const signedUserKey = signedUserItem ? signedUserItem.key : (tokens["Ragavan S"] ? "Ragavan S" : null);

  return (
    <div className="evaluator-card">
      <div className="evaluator-header">
        <div className="evaluator-title-row">
          <span className="evaluator-icon">⚡</span>
          <div>
            <h3 className="evaluator-title">Policy Evaluator</h3>
            <p className="evaluator-subtitle">Live endpoint testing against <code>POST /authorize</code></p>
          </div>
        </div>
        {onClose && (
          <button className="evaluator-close-btn" onClick={onClose} aria-label="Close">✕</button>
        )}
      </div>

      {/* Quick Scenario Preset Buttons */}
      <div className="scenario-presets">
        <span className="preset-label">Quick Scenarios:</span>
        <button
          type="button"
          className="preset-btn allow-preset"
          onClick={() => setScenario("user123", "GET", "/transactions")}
        >
          🟢 Allow: user123 (GET /transactions)
        </button>
        {signedUserKey && (
          <button
            type="button"
            className="preset-btn allow-preset signed-user-preset"
            onClick={() => setScenario(signedUserKey, "GET", "/transactions")}
            title="Evaluate ALLOW for signed person"
          >
            ⭐ Allow: {signedUserKey} (GET /transactions)
          </button>
        )}
        <button
          type="button"
          className="preset-btn deny-preset"
          onClick={() => setScenario("user123", "DELETE", "/transactions/txn-456")}
        >
          🔴 Deny: user123 (DELETE /transactions/txn-456)
        </button>
        <button
          type="button"
          className="preset-btn wildcard-preset"
          onClick={() => setScenario("user789", "POST", "/wallets/wallet-456/transactions/txn-999")}
        >
          ⚡ Wildcard: user789 (POST wallets/*/transactions/*)
        </button>
      </div>

      <form onSubmit={handleEvaluate} className="evaluator-form">
        <div className="evaluator-grid">
          {/* User / Identity selector */}
          <div className="eval-input-group">
            <label className="eval-label">User Identity</label>
            <select
              className="eval-select"
              value={selectedUser}
              onChange={(e) => handleUserChange(e.target.value)}
              disabled={isLoadingTokens}
            >
              {userList.length > 0 ? (
                userList.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))
              ) : (
                <>
                  <option value="user123">user123 (Seeded Demo)</option>
                  <option value="user456">user456 (Wallets Read)</option>
                  <option value="user789">user789 (Wildcard Writer)</option>
                  <option value="admin789">admin789 (Global Admin)</option>
                  {tokens["Ragavan S"] && <option value="Ragavan S">Ragavan S (Signed Person)</option>}
                </>
              )}
              {defaultToken && (
                <option value="custom">Current Session ({defaultUserId || "Signed User"})</option>
              )}
            </select>
          </div>

          {/* HTTP Method */}
          <div className="eval-input-group eval-method-group">
            <label className="eval-label">Method</label>
            <select
              className="eval-select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="GET">GET (read)</option>
              <option value="POST">POST (write)</option>
              <option value="PUT">PUT (write)</option>
              <option value="DELETE">DELETE (delete)</option>
              <option value="PATCH">PATCH (write)</option>
            </select>
          </div>

          {/* Resource Path */}
          <div className="eval-input-group eval-path-group">
            <label className="eval-label">Resource Path</label>
            <input
              type="text"
              className="eval-input"
              placeholder="/transactions or /wallets/wallet-123"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="eval-submit-btn" disabled={isEvaluating}>
          {isEvaluating ? (
            <span className="spinner" />
          ) : (
            <>
              <span>Evaluate Access</span>
              <span className="btn-arrow">→</span>
            </>
          )}
        </button>
      </form>

      {/* Error Banner */}
      {errorMsg && (
        <div className="eval-error-box">
          <span className="eval-error-icon">⚠️</span>
          <div className="eval-error-text">{errorMsg}</div>
        </div>
      )}

      {/* Evaluation Result Display */}
      {result && (
        <div className={`eval-result-card ${result.decision === "ALLOW" ? "result-allow" : "result-deny"}`}>
          <div className="result-top-bar">
            <div className="decision-badge-container">
              <span className={`decision-badge badge-${result.decision.toLowerCase()}`}>
                {result.decision === "ALLOW" ? "✓ ALLOW" : "✕ DENY"}
              </span>
              <span className="reason-code-badge">{result.reason_code}</span>
            </div>
            <span className="request-id-tag">ID: {result.request_id.slice(0, 8)}...</span>
          </div>

          <p className="result-explanation">{result.reason}</p>

          <div className="result-meta-row">
            <div className="meta-item">
              <span className="meta-label">User:</span>
              <code className="meta-val">{result.user_id}</code>
            </div>
            <div className="meta-item">
              <span className="meta-label">Action:</span>
              <code className="meta-val">{result.action}</code>
            </div>
            <div className="meta-item">
              <span className="meta-label">Resource:</span>
              <code className="meta-val">{result.resource}</code>
            </div>
          </div>

          {result.matched_permissions && result.matched_permissions.length > 0 ? (
            <div className="matched-perms-container">
              <span className="matched-title">Matched Policy Rules:</span>
              <div className="matched-perms-list">
                {result.matched_permissions.map((p) => (
                  <div key={p.id} className="matched-perm-chip">
                    <span className="perm-chip-id">#{p.id}</span>
                    <span className="perm-chip-resource">{p.resource}</span>
                    <span className={`perm-chip-effect effect-${p.effect}`}>{p.effect.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-matched-perms">
              <em>No matching ACL policy found (Default Deny enforced).</em>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
