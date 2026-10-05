import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("gupshup_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch((err) => {
        // Only forget the token when the server says it's invalid (401).
        // Network hiccups / cold starts must NOT log the user out.
        if (err.response?.status === 401) {
          localStorage.removeItem("gupshup_token");
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("gupshup_token", data.token);
    setUser(data.user);
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    localStorage.setItem("gupshup_token", data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("gupshup_token");
    setUser(null);
  };

  // Used by Google OAuth: token already issued by our backend
  const loginWithToken = (token, userData) => {
    localStorage.setItem("gupshup_token", token);
    setUser(userData);
  };

  // Profile edit ke baad header/composer sab jagah nayi DP turant dikhe
  const updateUser = (patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithToken, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
