import { useRef, useState } from "react";
import api from "../api.js";
import Avatar from "./Avatar.jsx";

const EMOJIS = ["😎", "😀", "🥳", "😇", "🤓", "😻", "🦊", "🐼", "🦁", "🐯", "🌟", "🔥", "💎", "🚀", "🎧", "⚽"];
const COLORS = ["#e8b04b", "#4fc3f7", "#ba68c8", "#81c784", "#ff8a65", "#f06292", "#64b5f6", "#aed581"];

// Edit your own profile: photo / emoji avatar / colour / bio / privacy.
export default function ProfileModal({ user, onClose, onSave }) {
  const [bio, setBio] = useState(user.bio || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [avatarColor, setAvatarColor] = useState(user.avatarColor || "#e8b04b");
  const [isPrivate, setIsPrivate] = useState(!!user.isPrivate);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [localPreview, setLocalPreview] = useState(null); // turant dikhne wali preview
  const fileRef = useRef(null);

  // Local preview (abhi select ki) ko pehle dikhao, phir server wali URL
  const previewUser = { ...user, bio, avatar: localPreview || avatar, avatarColor };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    // 1) TURANT preview dikhao — upload ka wait mat karo
    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);
    // 2) Background me upload karo
    setUploading(true);
    const form = new FormData();
    form.append("avatar", file);
    try {
      const { data } = await api.post("/users/me/avatar", form);
      setAvatar(data.avatar);
      setLocalPreview(null);
      try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
    } catch {
      setLocalPreview(null);
      try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
      alert("Upload fail — sirf image file, max 2MB");
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/users/me", { bio, avatar, avatarColor, isPrivate });
      setSavedTick(true);
      // "Saved ✓" dikhao phir band karo — user ko pata chale ho gaya!
      setTimeout(() => {
        onSave({ ...user, bio, avatar, avatarColor, isPrivate });
      }, 700);
    } catch {
      alert("Save nahi ho paya, dobara try karo");
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="profile-head">
          <div style={{ position: "relative" }}>
            <Avatar user={previewUser} size={84} />
            {uploading && (
              <div
                style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.4)", borderRadius: "50%",
                  color: "#fff", fontSize: 24,
                }}
              >
                <span className="ptr-spinner spinning">⟳</span>
              </div>
            )}
          </div>
          <h2>{user.name}</h2>
          <p className="muted small">{user.email}</p>
        </div>

        <label className="field-label">Profile photo</label>
        <div className="avatar-row">
          <button className="btn small" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "📷 Photo upload karo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
          <button className="btn small" onClick={() => setAvatar("")}>
            Initial use karo
          </button>
        </div>

        <label className="field-label">Ya emoji avatar chuno</label>
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`emoji-btn ${avatar === e ? "selected" : ""}`}
              onClick={() => setAvatar(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <label className="field-label">Initial ka colour</label>
        <div className="color-row">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-dot ${avatarColor === c ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setAvatarColor(c)}
              aria-label={c}
            />
          ))}
        </div>

        <label className="field-label">Bio</label>
        <textarea
          className="bio-input"
          rows={2}
          maxLength={160}
          placeholder="Apne baare me kuch likho…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />

        <label className="privacy-row">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <span>🔒 Private account <span className="muted small">(posts sirf friends dekhenge)</span></span>
        </label>

        <button className="btn primary block" onClick={save} disabled={saving || uploading}>
          {savedTick ? "Saved ✓" : saving ? "Saving…" : uploading ? "Photo upload ho rahi…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
