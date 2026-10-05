import { useEffect, useState } from "react";
import { onConnectionChange } from "../socket.js";

// Thin banner shown when the real-time connection drops.
// Lets the user know messages may be delayed, instead of failing silently.
export default function ConnectionBanner() {
  const [status, setStatus] = useState("connected");

  useEffect(() => onConnectionChange(setStatus), []);

  if (status === "connected" || status === "unauthorized") return null;

  return (
    <div className={`conn-banner ${status}`}>
      <span className="conn-dot" />
      {status === "reconnecting" ? "Connecting… live updates paused" : "Offline — trying to reconnect…"}
    </div>
  );
}
