import { useEffect, useRef, useState } from "react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

let gisLoaded = null;
function loadGIS() {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google script failed"));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

// "Sign in with Google" button (Google Identity Services).
// Needs GOOGLE_CLIENT_ID in server/.env + the domain in Google Cloud Console.
export default function GoogleButton({ onDone }) {
  const { loginWithToken } = useAuth();
  const btnRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/auth/config");
        if (!data.googleClientId || cancelled) return;
        await loadGIS();
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: data.googleClientId,
          callback: async (resp) => {
            try {
              const { data } = await api.post("/auth/google", {
                credential: resp.credential,
              });
              loginWithToken(data.token, data.user);
              onDone?.();
            } catch {
              setError("Google se login nahi ho paya");
            }
          },
        });
        if (btnRef.current && !cancelled) {
          window.google.accounts.id.renderButton(btnRef.current, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "continue_with",
            shape: "pill",
          });
          setReady(true);
        }
      } catch {
        /* Google not configured — hide silently */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready && !error) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div ref={btnRef} />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
