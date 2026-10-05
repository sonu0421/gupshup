// Renders a user avatar: uploaded photo, emoji, or initial letter.
import { useState, useEffect } from "react";
import { fileUrl } from "../utils.js";

export default function Avatar({ user, size = 40 }) {
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  const [imgBroken, setImgBroken] = useState(false);
  // Avatar URL badle to error state reset karo (nayi photo try karo)
  useEffect(() => {
    setImgBroken(false);
  }, [user?.avatar]);
  const av = user?.avatar || "";
  // Photo hai ya emoji/initial? (/uploads/ ya uploads/ dono handle karo)
  const isPhoto = av.startsWith("/uploads/") || av.startsWith("uploads/") || av.startsWith("http") || av.startsWith("blob:") || av.startsWith("data:");
  if (isPhoto && !imgBroken) {
    // Leading slash missing ho to add karo
    const src = av.startsWith("uploads/") ? "/" + av : av;
    return (
      <img
        className="avatar avatar-img"
        src={fileUrl(src)}
        style={dim}
        alt={user?.name || "User"}
        // Agar photo file na mile (purana upload wipe ho gaya ho) to tooti
        // image ki jagah naam ka pehla akshar dikhao
        onError={() => setImgBroken(true)}
      />
    );
  }
  if (av && !isPhoto) {
    return (
      <span className="avatar avatar-emoji" style={dim}>
        {user.avatar}
      </span>
    );
  }
  return (
    <span
      className="avatar avatar-initial"
      style={{ ...dim, background: user?.avatarColor || "#635BFF" }}
    >
      {(user?.name || "?")[0].toUpperCase()}
    </span>
  );
}
