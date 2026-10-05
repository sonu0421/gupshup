import { useState, useRef } from "react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { convoName, convoOther, timeHM } from "../utils.js";
import Avatar from "./Avatar.jsx";
import SwipeableRow from "./SwipeableRow.jsx";
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
  onDeleteChat,
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState([]);
  const searchTimer = useRef(null);

  // Debounced search — har letter par API call nahi, 300ms ruk ke
  const search = (q) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/users?q=${encodeURIComponent(q)}`);
        setResults(data);
      } catch {
        /* ignore */
      }
    }, 300);
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
    try {
      const { data } = await api.post("/conversations/group", {
        name: groupName.trim(),
        userIds: selected,
      });
      onNewConvo(data);
    } catch (err) {
      alert(err.response?.data?.message || "Group nahi ban paya");
      return;
    }
    setShowGroup(false);
    setGroupName("");
    setSelected([]);
    setQuery("");
    setResults([]);
  };

  const q = query.trim().toLowerCase();
  const visible = conversations.filter((c) => {
    if (filter === "unread" && !q) return (unread[c._id] || 0) > 0;
    if (filter === "groups" && !q) return c.isGroup;
    // Search ho raha hai to naam se filter karo
    if (q) {
      const name = convoName(c, user._id).toLowerCase();
      return name.includes(q);
    }
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>👥 New Group</div>
              <button className="icon-btn" onClick={() => { setShowGroup(false); setSelected([]); }} aria-label="Close">✕</button>
            </div>
            <input
              placeholder="👥 Group ka naam likho… (zaroori!)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ marginBottom: 8, borderColor: !groupName.trim() ? "var(--danger)" : undefined, borderWidth: !groupName.trim() ? 2 : undefined }}
              autoFocus
            />
            <div className="muted small" style={{ marginBottom: 8 }}>
              🔍 <b>Upar wale search box</b> me naam likho, phir yahan tick karo:
            </div>
            {selected.length > 0 && (
              <div style={{ marginBottom: 8, fontWeight: 700, color: "var(--brand)" }}>
                ✓ {selected.length} member{selected.length > 1 ? "s" : ""} selected
              </div>
            )}
            {query.trim() && results.length === 0 && (
              <div className="muted small" style={{ padding: "8px 0" }}>"{query}" se koi nahi mila</div>
            )}
            {!query.trim() && (
              <div className="muted small" style={{ padding: "8px 0" }}>⬆️ Upar search karo members ke liye</div>
            )}
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {results.map((u) => (
              <label key={u._id} className="member-row" style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 4px", cursor: "pointer", borderRadius: 8 }}>
                <input
                  type="checkbox"
                  checked={selected.includes(u._id)}
                  onChange={() => toggleSelect(u._id)}
                  style={{ width: 22, height: 22 }}
                />
                <Avatar user={u} size={36} />
                <span style={{ fontWeight: 600 }}>{u.name}</span>
              </label>
            ))}
            </div>
            <button
              className="btn primary block"
              onClick={createGroup}
              disabled={!groupName.trim() || selected.length === 0}
              style={{ marginTop: 12, opacity: (!groupName.trim() || selected.length === 0) ? 0.5 : 1, fontSize: 16, padding: "12px" }}
            >
              {selected.length > 0 ? `🎉 Create Group (${selected.length})` : "Create Group"}
            </button>
            {(!groupName.trim() || selected.length === 0) && (
              <div className="muted small" style={{ marginTop: 6, textAlign: "center" }}>
                {!groupName.trim() ? "⬆️ Pehle group ka naam likho" : "⬆️ Upar search karke members tick karo"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search results — SABSE UPAR, prominent */}
      {!showGroup && q && (
        <div style={{ padding: "0 16px 10px" }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: "var(--brand)" }}>
            👥 People ({results.length})
          </div>
          {results.length === 0 ? (
            <div className="muted small" style={{ padding: "8px 0" }}>
              "{query}" se koi naya banda nahi mila
            </div>
          ) : (
            results.map((u) => (
              <button key={u._id} className="convo-row" onClick={() => startChat(u._id)} style={{ border: "1px solid var(--brand-soft)", borderRadius: 12, marginBottom: 6 }}>
                <Avatar user={u} size={44} />
                <div className="convo-meta">
                  <div className="convo-name">{u.name}</div>
                  <div className="muted small ellipsis">Tap karke chat shuru karo 💬</div>
                </div>
              </button>
            ))
          )}
          {/* Matching chats bhi dikhao */}
          {visible.length > 0 && (
            <div style={{ fontWeight: 800, fontSize: 14, margin: "12px 0 8px", color: "var(--brand)" }}>
              💬 Chats ({visible.length})
            </div>
          )}
        </div>
      )}

      {/* Jab search nahi ho raha to online friends dikhao */}
      {!q && onlineFriends.length > 0 && (
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

      {/* Chat list — search me filter hokar dikhegi */}
      {!showGroup && (
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
            <SwipeableRow key={c._id} onDelete={() => onDeleteChat?.(c._id)}>
            <button
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
            </SwipeableRow>
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
      )}
    </div>
  );
}
