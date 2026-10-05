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
          // Measure the VISIBLE container width so the button fits on small phones.
          // (offsetWidth works because the container is rendered visibly, not display:none.)
          const containerW = btnRef.current.offsetWidth || 280;
          const w = Math.max(200, Math.min(320, containerW));
          window.google.accounts.id.renderButton(btnRef.current, {
            theme: "outline",
            size: "large",
            width: w,
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

  // Always render the container visibly (min-height avoids layout jump) so the
  // effect can measure its real width and fit the Google button on small phones.
  // If Google isn't configured, the effect returns early and this stays empty.
  return (
    <div style={{ width: "100%", display: ready || error ? "flex" : "block", flexDirection: "column", alignItems: "center", gap: 8, minHeight: ready || error ? 0 : 44 }}>
      <div ref={btnRef} style={{ width: "100%", maxWidth: 320, margin: "0 auto" }} />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
