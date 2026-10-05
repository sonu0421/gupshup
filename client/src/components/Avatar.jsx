// Renders a user avatar: uploaded photo, emoji, or initial letter.
import { useState } from "react";
import { fileUrl } from "../utils.js";

export default function Avatar({ user, size = 40 }) {
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  const [imgBroken, setImgBroken] = useState(false);
  if ((user?.avatar?.startsWith("/uploads/") || user?.avatar?.startsWith("http")) && !imgBroken) {
    return (
      <img
        className="avatar avatar-img"
        src={fileUrl(user.avatar)}
        style={dim}
        alt={user.name}
        // Agar photo file na mile (purana upload wipe ho gaya ho) to tooti
        // image ki jagah naam ka pehla akshar dikhao
        onError={() => setImgBroken(true)}
      />
    );
  }
  if (user?.avatar) {
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
