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
          // Fit the button to its container so it never overflows on small phones
          const containerW = btnRef.current.parentElement?.clientWidth || 320;
          const w = Math.max(200, Math.min(320, Math.floor(containerW)));
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

  if (!ready && !error) {
    // Render the container hidden so btnRef exists when the effect runs —
    // otherwise renderButton has nowhere to mount and the button never appears.
    return (
      <div style={{ display: "none", width: "100%" }}>
        <div ref={btnRef} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
      <div ref={btnRef} style={{ width: "100%", display: "flex", justifyContent: "center" }} />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
