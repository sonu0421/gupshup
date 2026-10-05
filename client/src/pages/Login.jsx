import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleButton from "../components/GoogleButton.jsx";

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
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">C</div>
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
