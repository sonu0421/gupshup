import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import AuthDecor from "../components/AuthDecor.jsx";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      nav("/");
    } catch {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="auth-wrap">
      <AuthDecor />
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
        <h1>Gupshup</h1>
        <p className="auth-tagline">Welcome back — your people are waiting 💬</p>
        {error && <div className="error">{error}</div>}
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn primary block">Log in</button>
        <div className="auth-divider"><span>or</span></div>
        <GoogleButton onDone={() => nav("/")} />
        <p className="muted center-text">
          No account? <Link to="/register">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
