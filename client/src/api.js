import axios from "axios";

// API base: Vercel deploy par VITE_API_URL set hota hai (Render backend ka URL).
// Local/dev me same-origin "/api" (Vite proxy / backend static serve).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000, // never hang forever on a bad network — fail fast instead
});

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("gupshup_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
