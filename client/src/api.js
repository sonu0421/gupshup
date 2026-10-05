import axios from "axios";

// Same-origin: /api is proxied to the backend by Vite in dev
const api = axios.create({
  baseURL: "/api",
  timeout: 15000, // never hang forever on a bad network — fail fast instead
});

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("gupshup_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
