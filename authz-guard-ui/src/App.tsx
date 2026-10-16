import React, { useState, useEffect } from "react";
import { createAuth0Client, Auth0Client, User } from "@auth0/auth0-spa-js";
import { CyberShieldGraphic } from "./components/CyberShieldGraphic";
import { GoogleIcon, FacebookIcon, EyeIcon, EyeOffIcon } from "./components/Icons";
import { AdminPanel } from "./components/AdminPanel";
import "./App.css";

const AUTH0_DOMAIN = "dev-gnz6w2yoy7e2lpds.us.auth0.com";
const AUTH0_CLIENT_ID = "LJDknx1EO2VEHizOxEQT6U7SBi7t3KoD";
const API = "http://localhost:3000";

type ActiveTab = "auth0" | "local";

interface LocalSession {
  token: string;
  user: { id: number; username: string; email: string; role: string };
}

function apiFetch(path: string, body: unknown) {
  return fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function App() {
  const [auth0Client, setAuth0Client] = useState<Auth0Client | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuth0Authenticated, setIsAuth0Authenticated] = useState(false);
  const [auth0User, setAuth0User] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [localSession, setLocalSession] = useState<LocalSession | null>(null);
  const [isLocalSignUp, setIsLocalSignUp] = useState(false);
  const [localUsername, setLocalUsername] = useState("");
  const [localEmail, setLocalEmail] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [showLocalPassword, setShowLocalPassword] = useState(false);

  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [activeTab, setActiveTab] = useState<ActiveTab>("auth0");
  const [showAdmin, setShowAdmin] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authzResult, setAuthzResult] = useState<unknown | null>(null);
  const [isEvaluatingAuthz, setIsEvaluatingAuthz] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    let isMounted = true;
    async function initAuth0() {
      try {
        const client = await createAuth0Client({
          domain: AUTH0_DOMAIN,
          clientId: AUTH0_CLIENT_ID,
          authorizationParams: { redirect_uri: window.location.origin },
        });
        if (!isMounted) return;
        setAuth0Client(client);

        if (window.location.search.includes("error=")) {
          const params = new URLSearchParams(window.location.search);
          const desc = params.get("error_description") || params.get("error") || "Auth error.";
          setAuthError(desc);
          showToast(`Auth0 Error: ${desc}`);
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
          await client.handleRedirectCallback();
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const authed = await client.isAuthenticated();
        if (authed && isMounted) {
          const profile = await client.getUser();
          setAuth0User(profile || null);
          setIsAuth0Authenticated(true);
          showToast(`Welcome back, ${profile?.name || profile?.email || "User"}!`);
        }
      } catch (err) {
        if (isMounted) setAuthError((err as Error).message);
      } finally {
        if (isMounted) setIsLoadingAuth(false);
      }
    }
    initAuth0();
    return () => { isMounted = false; };
  }, []);

  const handleAuth0Login = async () => {
    if (!auth0Client) return;
    try { await auth0Client.loginWithRedirect(); }
    catch (err) { showToast(`Login failed: ${(err as Error).message}`); }
  };

  const handleAuth0Signup = async () => {
    if (!auth0Client) return;
    try { await auth0Client.loginWithRedirect({ authorizationParams: { screen_hint: "signup" } }); }
    catch (err) { showToast(`Signup failed: ${(err as Error).message}`); }
  };

  const handleGoogleOAuth = async () => {
    if (!auth0Client) return;
    try { await auth0Client.loginWithRedirect({ authorizationParams: { connection: "google-oauth2" } }); }
    catch (err) { showToast(`Google login failed: ${(err as Error).message}`); }
  };

  const handleAuth0Logout = async () => {
    if (!auth0Client) return;
    try { await auth0Client.logout({ logoutParams: { returnTo: window.location.origin } }); }
    catch (err) { showToast(`Logout failed: ${(err as Error).message}`); }
  };

  const handleAuth0Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth0Client) return;
    if (isSignUp) await handleAuth0Signup();
    else await handleAuth0Login();
  };

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setIsLocalLoading(true);
    try {
      const path = isLocalSignUp ? "/auth/register" : "/auth/login";
      const body = isLocalSignUp
        ? { username: localUsername, email: localEmail, password: localPassword }
        : { email: localEmail, password: localPassword };

      const res = await apiFetch(path, body);
      const data = await res.json();

      if (!res.ok) {
        setLocalError(data?.error?.message || "Request failed.");
        return;
      }

      setLocalSession({ token: data.token, user: data.user });
      showToast(isLocalSignUp
        ? `Account created! Welcome, ${data.user.username}! 🎉`
        : `Welcome back, ${data.user.username}!`
      );
      setLocalUsername(""); setLocalEmail(""); setLocalPassword("");
    } catch {
      setLocalError("Could not reach the backend. Is the server running on port 3000?");
    } finally {
      setIsLocalLoading(false);
    }
  };

  const handleLocalLogout = () => {
    setLocalSession(null);
    showToast("Signed out successfully.");
  };

  const testAuthzService = async () => {
    setIsEvaluatingAuthz(true);
    setAuthzResult(null);
    try {
      let token = "";
      if (auth0Client && isAuth0Authenticated) {
        try { const raw = await auth0Client.getTokenSilently(); token = typeof raw === "string" ? raw : ""; }
        catch { /* silent fallback */ }
      } else if (localSession) {
        token = localSession.token;
      }

      const healthRes = await fetch(`${API}/health/ready`);
      const healthData = await healthRes.json();

      setAuthzResult({
        backend: API,
        serviceStatus: healthData,
        hasAccessToken: Boolean(token),
        authenticatedVia: localSession ? "local" : "auth0",
        testedUser: localSession?.user.email || auth0User?.email || "demo-identity",
        message: "AuthZ Guard Backend is connected and ready.",
      });
      showToast("AuthZ Guard backend query successful!");
    } catch (err) {
      setAuthzResult({
        error: `Could not reach AuthZ Guard backend on ${API}`,
        detail: (err as Error).message,
        tip: "Ensure backend is running with 'npm run dev' in authz-guard directory.",
      });
      showToast("Could not reach AuthZ backend on port 3000");
    } finally {
      setIsEvaluatingAuthz(false);
    }
  };

  const isAnyAuthenticated = isAuth0Authenticated || !!localSession;
  const currentUser = localSession
    ? { name: localSession.user.username, email: localSession.user.email, picture: null, role: localSession.user.role }
    : auth0User
    ? { name: auth0User.name || auth0User.nickname || "User", email: auth0User.email || auth0User.sub || "", picture: auth0User.picture || null, role: "auth0" }
    : null;

  return (
    <div className="page-container">
      {toastMessage && (
        <div className="auth-toast" role="alert">
          <span className="toast-dot" />
          <span>{toastMessage}</span>
        </div>
      )}

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      <button className="admin-trigger-btn" onClick={() => setShowAdmin(true)} title="Open Admin Console">
        ⚙ Admin
      </button>

      <main className="auth-card" aria-label="Authentication portal">
        <section className="form-column">
          <div className="form-ambient-cyan" />
          <div className="form-ambient-blue" />

          <div className="form-content">
            {isLoadingAuth ? (
              <div className="loading-state">
                <span className="spinner large-spinner" />
                <p className="loading-text">Connecting to identity providers...</p>
              </div>
            ) : isAnyAuthenticated && currentUser ? (
              <div className="authenticated-view" id="view-authenticated">
                <header className="profile-header">
                  <div className="profile-badge-row">
                    <span className="live-badge">
                      <span className="live-dot" />
                      {localSession ? "Local Account" : "OIDC Authenticated"}
                    </span>
                    <span className="provider-tag">
                      {localSession ? (localSession.user.role === "admin" ? "Admin" : "User") : "Auth0"}
                    </span>
                  </div>

                  <div className="profile-identity">
                    {currentUser.picture ? (
                      <img src={currentUser.picture} alt={currentUser.name} className="profile-avatar" />
                    ) : (
                      <div className="profile-avatar-placeholder">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="profile-meta">
                      <h1 className="profile-name">{currentUser.name}</h1>
                      <p className="profile-email" id="user-email">{currentUser.email}</p>
                    </div>
                  </div>
                </header>

                <div className="profile-section">
                  <div className="section-title-row">
                    <span className="section-title">Session Details</span>
                    <span className="claims-count">
                      {localSession ? `Role: ${localSession.user.role}` : `${Object.keys(auth0User!).length} claims`}
                    </span>
                  </div>
                  <pre className="user-profile-json" id="user-profile">
                    {JSON.stringify(localSession ? localSession.user : auth0User, null, 2)}
                  </pre>
                </div>

                <div className="authz-test-section">
                  <button
                    type="button"
                    className="test-authz-btn"
                    onClick={testAuthzService}
                    disabled={isEvaluatingAuthz}
                  >
                    {isEvaluatingAuthz ? <span className="spinner" /> : "Verify AuthZ Guard Service Status"}
                  </button>
                  {authzResult !== null && (
                    <pre className="authz-result-json">{JSON.stringify(authzResult, null, 2)}</pre>
                  )}
                </div>

                <div className="profile-actions">
                  {localSession?.user.role === "admin" && (
                    <button
                      type="button"
                      className="admin-dashboard-btn"
                      onClick={() => setShowAdmin(true)}
                    >
                      ⚙ Admin Dashboard
                    </button>
                  )}
                  <button
                    type="button"
                    className="logout-btn"
                    onClick={localSession ? handleLocalLogout : handleAuth0Logout}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="unauthenticated-view" id="view-unauthenticated">
                <div className="auth-tabs" role="tablist">
                  <button
                    role="tab"
                    className={`auth-tab ${activeTab === "auth0" ? "auth-tab-active" : ""}`}
                    onClick={() => { setActiveTab("auth0"); setAuthError(null); setLocalError(""); }}
                    id="tab-auth0"
                    aria-selected={activeTab === "auth0"}
                  >
                    OAuth2 / Auth0
                  </button>
                  <button
                    role="tab"
                    className={`auth-tab ${activeTab === "local" ? "auth-tab-active" : ""}`}
                    onClick={() => { setActiveTab("local"); setAuthError(null); setLocalError(""); }}
                    id="tab-local"
                    aria-selected={activeTab === "local"}
                  >
                    Local Account
                  </button>
                </div>

                {activeTab === "auth0" && (
                  <div className="tab-content" role="tabpanel" aria-labelledby="tab-auth0">
                    {authError && (
                      <div className="auth-error-banner" id="view-error">
                        <span>{authError}</span>
                      </div>
                    )}

                    <header className="form-header">
                      <h1 className="form-title">{isSignUp ? "Create account" : "Sign in"}</h1>
                      <p className="form-subtitle">
                        {isSignUp ? (
                          <>Already have an account?{" "}
                            <button type="button" className="link-btn" onClick={() => setIsSignUp(false)}>Sign in</button>
                          </>
                        ) : (
                          <>Don't have an account?{" "}
                            <button type="button" className="link-btn" onClick={() => setIsSignUp(true)}>Create now</button>
                          </>
                        )}
                      </p>
                    </header>

                    <form onSubmit={handleAuth0Submit} className="auth-form" noValidate>
                      {isSignUp && (
                        <div className="input-group">
                          <label htmlFor="auth-name" className="input-label">Full Name</label>
                          <div className="input-wrapper">
                            <input id="auth-name" type="text" className="text-input" placeholder="John Doe"
                              value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                          </div>
                        </div>
                      )}
                      <div className="input-group">
                        <label htmlFor="auth-email" className="input-label">Email</label>
                        <div className="input-wrapper">
                          <input id="auth-email" type="email" className="text-input" placeholder="example@gmail.com"
                            value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                        </div>
                      </div>
                      <div className="input-group">
                        <label htmlFor="auth-password" className="input-label">Password</label>
                        <div className="input-wrapper password-wrapper">
                          <input id="auth-password" type={showPassword ? "text" : "password"} className="text-input password-input"
                            placeholder="@#*%" value={password} onChange={(e) => setPassword(e.target.value)}
                            autoComplete={isSignUp ? "new-password" : "current-password"} required />
                          <div className="input-divider" aria-hidden="true" />
                          <button type="button" className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}>
                            {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                          </button>
                        </div>
                      </div>
                      <button type="submit" className="submit-btn">
                        {isSignUp ? "Sign Up with Auth0" : "Sign In with Auth0"}
                      </button>
                    </form>

                    <div className="or-divider" aria-hidden="true">
                      <span className="divider-line" />
                      <span className="divider-text">OR CONNECT WITH</span>
                      <span className="divider-line" />
                    </div>

                    <div className="social-actions">
                      <button type="button" className="social-btn" onClick={handleGoogleOAuth} aria-label="Continue with Google">
                        <span className="social-btn-icon"><GoogleIcon size={19} /></span>
                        <span className="social-btn-text">Continue with Google</span>
                      </button>
                      <button type="button" className="social-btn" onClick={handleAuth0Login} aria-label="Auth0 Universal Login">
                        <span className="social-btn-icon"><FacebookIcon size={19} /></span>
                        <span className="social-btn-text">Auth0 Universal Login</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "local" && (
                  <div className="tab-content" role="tabpanel" aria-labelledby="tab-local">
                    <header className="form-header">
                      <h1 className="form-title">{isLocalSignUp ? "Create account" : "Sign in"}</h1>
                      <p className="form-subtitle">
                        {isLocalSignUp ? (
                          <>Already have an account?{" "}
                            <button type="button" className="link-btn" onClick={() => { setIsLocalSignUp(false); setLocalError(""); }}>Sign in</button>
                          </>
                        ) : (
                          <>Don't have an account?{" "}
                            <button type="button" className="link-btn" onClick={() => { setIsLocalSignUp(true); setLocalError(""); }}>Create now</button>
                          </>
                        )}
                      </p>
                    </header>

                    <div className="local-db-badge">
                      <span className="local-db-dot" />
                      Stored securely in local SQLite database
                    </div>

                    <form onSubmit={handleLocalSubmit} className="auth-form local-form" noValidate>
                      {isLocalSignUp && (
                        <div className="input-group">
                          <label htmlFor="local-username" className="input-label">Username</label>
                          <div className="input-wrapper">
                            <input id="local-username" type="text" className="text-input" placeholder="johndoe"
                              value={localUsername} onChange={(e) => setLocalUsername(e.target.value)} required autoFocus />
                          </div>
                        </div>
                      )}
                      <div className="input-group">
                        <label htmlFor="local-email" className="input-label">Email</label>
                        <div className="input-wrapper">
                          <input id="local-email" type="email" className="text-input" placeholder="you@example.com"
                            value={localEmail} onChange={(e) => setLocalEmail(e.target.value)} autoComplete="email" required />
                        </div>
                      </div>
                      <div className="input-group">
                        <label htmlFor="local-password" className="input-label">
                          Password {isLocalSignUp && <span className="password-hint">(min 8 characters)</span>}
                        </label>
                        <div className="input-wrapper password-wrapper">
                          <input id="local-password" type={showLocalPassword ? "text" : "password"}
                            className="text-input password-input" placeholder="••••••••"
                            value={localPassword} onChange={(e) => setLocalPassword(e.target.value)}
                            autoComplete={isLocalSignUp ? "new-password" : "current-password"} required minLength={8} />
                          <div className="input-divider" aria-hidden="true" />
                          <button type="button" className="password-toggle-btn"
                            onClick={() => setShowLocalPassword(!showLocalPassword)}>
                            {showLocalPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                          </button>
                        </div>
                      </div>

                      {localError && <div className="local-error" role="alert">{localError}</div>}

                      <button type="submit" className="submit-btn" disabled={isLocalLoading}>
                        {isLocalLoading
                          ? <span className="spinner" />
                          : isLocalSignUp ? "Create Account" : "Sign In"
                        }
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="center-divider" aria-hidden="true" />

        <section className="visual-column" aria-label="Security Shield Visual">
          <CyberShieldGraphic interactive={true} />
        </section>
      </main>
    </div>
  );
}

export default App;
