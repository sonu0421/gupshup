import { io } from "socket.io-client";

let socket = null;
let socketToken = null;

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
    socket = io(socketUrl, { auth: { token } });
    socketToken = token;
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
