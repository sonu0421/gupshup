import { io } from "socket.io-client";

let socket = null;
let socketToken = null;

// Simple pub/sub so any component can react to connection changes
const listeners = new Set();
export function onConnectionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitStatus(status) {
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch {
      /* ignore */
    }
  });
}

// Authenticated socket: the JWT is verified by the server on handshake,
// so nobody can impersonate another user by passing a fake userId.
export function getSocket() {
  const token = localStorage.getItem("gupshup_token");
  // Token changed (login/logout/switch) → reconnect with the new identity
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    // Vercel deploy par VITE_SOCKET_URL = Render backend ka URL.
    // Local/dev me same-origin (proxied to the backend by Vite in dev).
    const socketUrl = import.meta.env.VITE_SOCKET_URL || undefined;
    socket = io(socketUrl, {
      auth: { token },
      // Aggressive but polite reconnection: quick first retries for brief
      // network blips (mobile network switch, tunnel hiccup), then back off.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.4,
      timeout: 15000,
    });
    socketToken = token;

    socket.on("connect", () => emitStatus("connected"));
    socket.on("disconnect", () => emitStatus("disconnected"));
    socket.on("reconnect_attempt", () => emitStatus("reconnecting"));
    socket.on("reconnect", () => emitStatus("connected"));
    // Bad/expired token → server rejects handshake; stop retrying and log out
    socket.on("connect_error", (err) => {
      const msg = err?.message || "";
      if (/invalid token|authentication required|unauthorized/i.test(msg)) {
        socket.disconnect();
        localStorage.removeItem("gupshup_token");
        emitStatus("unauthorized");
      } else {
        emitStatus("reconnecting");
      }
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}
