import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import AdminApp from "./AdminApp";
import "./admin.css";

const LOGIN_ROUTE = "/admin-login";
const DASHBOARD_ROUTE = "/admin";
const DASHBOARD_ALIAS_ROUTE = "/dashboard";
const AUTH_ERROR_TEXT = "Invalid email or password";

function AdminRoot() {
  const [routePath, setRoutePath] = useState(window.location.pathname);
  const [session, setSession] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const navigate = (nextPath, replace = true) => {
    if (window.location.pathname === nextPath) return;

    const method = replace ? "replaceState" : "pushState";
    window.history[method]({}, "", nextPath);
    setRoutePath(nextPath);
  };

  useEffect(() => {
    const handlePopState = () => setRoutePath(window.location.pathname);

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      setSession(data.session || null);
      setIsSessionLoading(false);
    };

    initSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isSessionLoading) return;

    if ((routePath === DASHBOARD_ROUTE || routePath === DASHBOARD_ALIAS_ROUTE) && !session) {
      navigate(LOGIN_ROUTE, true);
      return;
    }

    if (routePath === DASHBOARD_ALIAS_ROUTE && session) {
      navigate(DASHBOARD_ROUTE, true);
      return;
    }

    if (routePath === LOGIN_ROUTE && session) {
      navigate(DASHBOARD_ROUTE, true);
      return;
    }

    if (routePath !== LOGIN_ROUTE && routePath !== DASHBOARD_ROUTE && routePath !== DASHBOARD_ALIAS_ROUTE) {
      navigate(session ? DASHBOARD_ROUTE : LOGIN_ROUTE, true);
    }
  }, [isSessionLoading, routePath, session]);

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setErrorText("");
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorText(AUTH_ERROR_TEXT);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    navigate(DASHBOARD_ROUTE, true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(LOGIN_ROUTE, true);
  };

  if (isSessionLoading) {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <h1 className="admin-auth-title">Checking session...</h1>
        </div>
      </div>
    );
  }

  if (routePath === DASHBOARD_ROUTE || routePath === DASHBOARD_ALIAS_ROUTE) {
    return <AdminApp onLogout={handleLogout} />;
  }

  return (
    <div className="admin-auth-page">
      <form className="admin-auth-card" onSubmit={handleLoginSubmit}>
        <h1 className="admin-auth-title">Admin Login</h1>

        <label className="admin-auth-label" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          className="admin-auth-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
        />

        <label className="admin-auth-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          className="admin-auth-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {errorText && <p className="admin-auth-error">{errorText}</p>}

        <button type="submit" className="admin-auth-button" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default AdminRoot;
