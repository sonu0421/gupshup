import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import AuthDecor from "../components/AuthDecor.jsx";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await register(name, email, password);
      nav("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
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
        <p className="auth-tagline">Join the conversation — it's free forever ✨</p>
        {error && <div className="error">{error}</div>}
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          placeholder="Password (min 6 chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn primary block">Sign up</button>
        <div className="auth-divider"><span>or</span></div>
        <GoogleButton onDone={() => nav("/")} />
        <p className="muted center-text">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
