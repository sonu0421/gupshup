import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { IconSearch, IconX } from "./icons.jsx";

// "+ New Message" modal: pick a person to start chatting with.
export default function NewMessageModal({ people, onClose, onSelect }) {
  const [q, setQ] = useState("");
  const list = people.filter(
    (p) =>
      !q.trim() ||
      p.name.toLowerCase().includes(q.trim().toLowerCase()) ||
      p.email.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      <div className="modal-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2>New message</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX width={20} height={20} />
          </button>
        </div>
        <div className="chatlist-search" style={{ margin: 0 }}>
          <IconSearch width={17} height={17} />
          <input
            placeholder="Search people…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{ overflowY: "auto", maxHeight: 320, display: "flex", flexDirection: "column", gap: 2 }}>
          {list.length === 0 && (
            <p className="muted small center-text" style={{ padding: 16 }}>
              Koi nahi mila — Discover me naye dost banao!
            </p>
          )}
          {list.map((p) => (
            <button key={p._id} className="nm-row" onClick={() => onSelect(p._id)}>
              <Avatar user={p} size={40} />
              <span>
                <span style={{ display: "block" }}>{p.name}</span>
                <span className="muted small">{p.bio || "Hey, I'm on Gupshup!"}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
