import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Allow access via tunnel domains (for live demo links)
    allowedHosts: [
      ".loca.lt",
      ".pinggy.net",
      ".pinggy-free.link",
      ".trycloudflare.com",
      ".ngrok.io",
      ".ngrok-free.app",
    ],
    proxy: {
      // Same-origin in dev: frontend talks to backend through Vite,
      // so the whole app works behind a single public URL.
      "/api": "http://localhost:5000",
      "/socket.io": { target: "http://localhost:5000", ws: true },
    },
  },
});
