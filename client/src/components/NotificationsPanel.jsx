import Avatar from "./Avatar.jsx";
import { timeHM } from "../utils.js";

const TEXTS = {
  "friend-request": (name) => `${name} ne tumhe friend request bheji`,
  "friend-accepted": (name) => `${name} ne tumhari friend request accept ki 🎉`,
  "post-like": (name) => `${name} ne tumhari photo like ki`,
  "note-like": (name) => `${name} ne tumhara note like kiya`,
};

// Bell dropdown: every like, request and accept in one place.
export default function NotificationsPanel({ notifications = [], onItemClick, onClose }) {
  return (
    <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
      <div className="notif-head">Notifications</div>
      <div className="notif-list">
        {notifications.length === 0 && (
          <p className="muted small empty-note" style={{ margin: 12 }}>
            Abhi koi notification nahi hai.
          </p>
        )}
        {notifications.map((n) => (
          <button
            key={n._id}
            className={`notif-item ${n.read ? "" : "unread"}`}
            onClick={() => onItemClick(n)}
          >
            <Avatar user={n.actor} size={38} />
            <span className="ntext">
              {TEXTS[n.type]?.(n.actor?.name || "Someone") || "New notification"}
              <span className="ntime" style={{ display: "block" }}>{timeHM(n.createdAt)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
