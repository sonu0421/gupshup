// Convert a backend file path (/uploads/...) to a full URL.
// Frontend lives on Vercel, files live on the Render backend — a relative
// path would wrongly resolve against the frontend domain and 404.
export function fileUrl(path) {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  if (path.startsWith("/uploads/")) {
    const apiUrl = import.meta.env.VITE_API_URL || "";
    const origin = apiUrl.replace(/\/api\/?$/, ""); // strip trailing /api
    if (origin) return origin + path;
  }
  return path;
}

export function convoName(convo, meId) {
  if (!convo) return "";
  if (convo.isGroup) return convo.name || "Group";
  const other = convo.participants.find((p) => String(p._id || p) !== String(meId));
  return other?.name || "Chat";
}

export function convoOther(convo, meId) {
  if (!convo || convo.isGroup) return null;
  return convo.participants.find((p) => String(p._id || p) !== String(meId)) || null;
}

export function timeHM(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// True when every other participant has read this message (blue ✓✓)
export function isSeenByAll(msg, convo, meId) {
  if (!convo || !msg) return false;
  const others = convo.participants.filter((p) => String(p._id || p) !== String(meId));
  if (!others.length) return false;
  const readers = new Set((msg.readBy || []).map(String));
  return others.every((o) => readers.has(String(o._id || o)));
}

// Short notification ping using WebAudio (no audio file needed)
let audioCtx = null;
export function playPing() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch {
    /* audio not available - ignore */
  }
}
