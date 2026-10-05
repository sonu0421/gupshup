import { useState } from "react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { convoName, convoOther, timeHM } from "../utils.js";
import Avatar from "./Avatar.jsx";
import { IconSearch, IconPlus } from "./icons.jsx";

const FILTERS = [
  { id: "all", label: "All Chats" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
];

// Conversation roster: search, filter pills, online row, rich list items.
export default function ChatList({
  conversations,
  activeId,
  onSelect,
  onNewConvo,
  onlineUsers,
  unread = {},
  people = [],
  onViewProfile,
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState([]);

  const search = async (q) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    try {
      const { data } = await api.get(`/auth/users?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch {
      /* ignore */
    }
  };

  const startChat = async (otherId) => {
    const { data } = await api.post("/conversations", { userId: otherId });
    onNewConvo(data);
    setQuery("");
    setResults([]);
  };

  const toggleSelect = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const createGroup = async () => {
    if (!groupName.trim() || selected.length === 0) return;
    const { data } = await api.post("/conversations/group", {
      name: groupName.trim(),
      userIds: selected,
    });
    onNewConvo(data);
    setShowGroup(false);
    setGroupName("");
    setSelected([]);
    setQuery("");
    setResults([]);
  };

  const visible = conversations.filter((c) => {
    if (filter === "unread") return (unread[c._id] || 0) > 0;
    if (filter === "groups") return c.isGroup;
    return true;
  });

  // Online friends for the presence row
  const onlineFriends = people.filter(
    (p) => p.friendStatus === "friends" && onlineUsers.includes(String(p._id))
  );

  return (
    <div className="chatlist">
      <div className="chatlist-head">
        <h2>Messages</h2>
        <div className="chatlist-search">
          <IconSearch width={17} height={17} />
          <input
            placeholder="Search chats, people…"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
          <button
            className="icon-btn"
            onClick={() => setShowGroup((s) => !s)}
            title="New group"
            aria-label="New group"
            style={{ padding: 4 }}
          >
            <IconPlus width={18} height={18} />
          </button>
        </div>
      </div>

      <div className="filter-pills">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`chip ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showGroup && (
        <div style={{ padding: "0 16px 10px" }}>
          <div className="feed-card" style={{ padding: 14 }}>
            <input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div className="muted small" style={{ marginBottom: 8 }}>
              Search people above, then tick members:
            </div>
            {results.map((u) => (
              <label key={u._id} className="member-row" style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0" }}>
                <input
                  type="checkbox"
                  checked={selected.includes(u._id)}
                  onChange={() => toggleSelect(u._id)}
                  style={{ width: "auto" }}
                />
                <span style={{ fontWeight: 600 }}>{u.name}</span>
                <span className="muted small">{u.email}</span>
              </label>
            ))}
            <button className="btn primary block" onClick={createGroup} style={{ marginTop: 8 }}>
              Create group
            </button>
          </div>
        </div>
      )}

      {!showGroup && results.length > 0 && (
        <div style={{ padding: "0 16px 10px" }}>
          {results.map((u) => (
            <button key={u._id} className="convo-row" onClick={() => startChat(u._id)}>
              <Avatar user={u} size={44} />
              <div className="convo-meta">
                <div className="convo-name">{u.name}</div>
                <div className="muted small ellipsis">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {onlineFriends.length > 0 && (
        <div style={{ padding: "2px 16px 10px", display: "flex", gap: 12, overflowX: "auto" }}>
          {onlineFriends.map((p) => (
            <button
              key={p._id}
              onClick={() => onViewProfile(p._id)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            >
              <span className="avatar-wrap">
                <Avatar user={p} size={52} />
                <span className="dot" />
              </span>
              <span className="small ellipsis" style={{ fontWeight: 600, maxWidth: 60, display: "block" }}>
                {p.name.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="convo-list">
        {visible.map((c) => {
          const other = convoOther(c, user._id);
          const online = other && onlineUsers.includes(String(other._id));
          const last = c.lastMessage;
          const senderName =
            String(last?.sender?._id || last?.sender) === String(user._id)
              ? "You"
              : last?.sender?.name;
          return (
            <button
              key={c._id}
              className={`convo-row ${c._id === activeId ? "active" : ""}`}
              onClick={() => onSelect(c._id)}
            >
              <span className="avatar-wrap">
                <Avatar user={c.isGroup ? { name: convoName(c, user._id), avatarColor: "#635BFF" } : other} size={52} />
                {online && <span className="dot" />}
              </span>
              <div className="convo-meta">
                <div className="convo-top">
                  <span className="convo-name ellipsis">{convoName(c, user._id)}</span>
                  {last && <span className="muted small" style={{ flexShrink: 0 }}>{timeHM(last.createdAt)}</span>}
                </div>
                <div className="convo-sub">
                  <span className="muted small ellipsis">
                    {last
                      ? `${senderName}: ${last.image && !last.text ? "📷 Photo" : last.text}`
                      : "No messages yet — say hi! 👋"}
                  </span>
                  {unread[c._id] > 0 && (
                    <span className="unread-badge">{unread[c._id] > 99 ? "99+" : unread[c._id]}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {visible.length === 0 && (
          <div className="empty-note" style={{ margin: "12px 16px" }}>
            {filter === "all"
              ? "No chats yet — search people above to start! 💬"
              : "Nothing here. You're all caught up! ✨"}
          </div>
        )}
      </div>
    </div>
  );
}
