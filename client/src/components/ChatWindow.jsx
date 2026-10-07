import { useEffect, useRef, useState } from "react";
import { getSocket } from "../socket.js";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { convoName, convoOther, timeHM, isSeenByAll, fileUrl } from "../utils.js";
import { IconSend, IconImage, IconX, IconChat, IconChevronLeft, IconPhone, IconVideo } from "./icons.jsx";
import Avatar from "./Avatar.jsx";

export default function ChatWindow({ convo, onlineUsers, onBack, onViewProfile, onDeleteChat }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reactFor, setReactFor] = useState(null); // messageId jiska emoji picker khula hai
  const [replyTo, setReplyTo] = useState(null); // message object jiska reply likha ja raha hai
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimer = useRef(null);
  const pressTimer = useRef(null);
  const atBottomRef = useRef(true);
  const convoId = convo?._id;

  const REACT_EMOJIS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

  const markSeen = () => {
    if (!convoId || document.visibilityState !== "visible") return;
    getSocket().emit("mark-seen", { conversationId: convoId });
  };

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    setAtBottom(near);
    if (near) setHasNew(false);
  };

  useEffect(() => {
    if (!convoId) return;
    const socket = getSocket();
    socket.emit("join-conversation", convoId);
    api
      .get(`/messages/${convoId}`)
      .then((res) => {
        setMessages(res.data);
        setTypingUser(null);
        setHasNew(false);
        atBottomRef.current = true;
        setAtBottom(true);
        setTimeout(() => scrollToBottom(false), 60);
        markSeen();
      })
      .catch(() => {});

    const onNew = (msg) => {
      if (String(msg.conversation) !== String(convoId)) return;
      setMessages((prev) => {
        // Apna optimistic ("sending...") bubble tha to use asli message se replace karo
        if (msg.clientTempId) {
          const idx = prev.findIndex((m) => m._id === msg.clientTempId);
          if (idx !== -1) {
            const next = [...prev];
            // blob URL revoke karo taaki memory leak na ho
            if (next[idx].image?.startsWith("blob:")) {
              try { URL.revokeObjectURL(next[idx].image); } catch { /* ignore */ }
            }
            next[idx] = { ...msg, sending: false };
            return next;
          }
        }
        return prev.some((m) => m._id === msg._id) ? prev : [...prev, msg];
      });
      const mine = String(msg.sender._id || msg.sender) === String(user._id);
      if (!mine) {
        markSeen();
        // User scrolled up -> show pill instead of yanking the scroll
        if (!atBottomRef.current) setHasNew(true);
      }
    };

    const onTyping = ({ conversationId, isTyping, userName, userId: tUid }) => {
      if (String(conversationId) !== String(convoId)) return;
      if (String(tUid) === String(user._id)) return;
      setTypingUser(isTyping ? userName : null);
    };

    // Someone read my messages -> turn ticks blue live
    const onSeen = ({ conversationId, seenBy }) => {
      if (String(conversationId) !== String(convoId)) return;
      setMessages((prev) =>
        prev.map((m) => {
          const mine = String(m.sender._id || m.sender) === String(user._id);
          const readers = (m.readBy || []).map(String);
          if (mine && !readers.includes(String(seenBy))) {
            return { ...m, readBy: [...(m.readBy || []), seenBy] };
          }
          return m;
        })
      );
    };

    // Kisi ne message par reaction lagaya/hataya -> chips live update karo
    const onReacted = ({ messageId, conversationId, reactions }) => {
      if (String(conversationId) !== String(convoId)) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId) ? { ...m, reactions } : m
        )
      );
    };

    // Server ne message reject kiya (galat replyTo) -> optimistic bubble fail dikhao
    const onMsgError = ({ clientTempId }) => {
      if (!clientTempId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === clientTempId ? { ...m, sending: false, sendFailed: true } : m
        )
      );
    };

    socket.on("new-message", onNew);
    socket.on("typing", onTyping);
    socket.on("messages-seen", onSeen);
    socket.on("message-reacted", onReacted);
    socket.on("message-error", onMsgError);
    return () => {
      socket.off("new-message", onNew);
      socket.off("typing", onTyping);
      socket.off("messages-seen", onSeen);
      socket.off("message-reacted", onReacted);
      socket.off("message-error", onMsgError);
    };
  }, [convoId, user._id]);

  // Auto-scroll only when the user is already at the bottom
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [messages]);

  // Mark seen when the tab becomes visible again
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") markSeen();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [convoId, user._id]);

  if (!convo) {
    return (
      <main className="chat-main empty-state">
        <div className="empty-art">
          <IconChat width={44} height={44} />
        </div>
        <h2>Pick a conversation</h2>
        <p className="muted">Choose a chat from the left, or find people in Discover ✨</p>
      </main>
    );
  }

  const other = convoOther(convo, user._id);
  const online = other && onlineUsers.includes(String(other._id));

  const emitTyping = (isTyping) =>
    getSocket().emit("typing", {
      conversationId: convoId,
      isTyping,
      userName: user.name,
    });

  const handleChange = (e) => {
    setText(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1500);
  };

  // Reaction toggle (optimistic): pehle UI me lagao, phir server ko batao.
  // Server `message-reacted` se final truth bhejta hai.
  const react = (m, emoji) => {
    const uid = String(user._id);
    setMessages((prev) =>
      prev.map((x) => {
        if (String(x._id) !== String(m._id)) return x;
        const mine = (x.reactions || []).find((r) => String(r.user) === uid);
        let reactions;
        if (mine && mine.emoji === emoji) {
          reactions = (x.reactions || []).filter((r) => String(r.user) !== uid);
        } else {
          reactions = [
            ...(x.reactions || []).filter((r) => String(r.user) !== uid),
            { user: uid, emoji },
          ];
        }
        return { ...x, reactions };
      })
    );
    getSocket().emit("react-message", { messageId: m._id, emoji });
    setReactFor(null);
  };

  // Long-press (touch + mouse) par emoji picker kholo
  const startPress = (m) => {
    if (m.sending) return;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setReactFor(m._id), 550);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  // Quote helpers
  const quoteSnippet = (q) => {
    if (!q || typeof q !== "object") return "Message";
    if (q.text) return q.text.length > 60 ? q.text.slice(0, 60) + "…" : q.text;
    if (q.image) return "📷 Photo";
    return "Message";
  };
  const quoteName = (q) => {
    const s = q?.sender;
    if (!s) return "";
    const sid = s._id || s;
    return String(sid) === String(user._id) ? "You" : s.name || "";
  };

  // Reactions ko emoji-wise group karo (chips ke liye)
  const groupedReactions = (reactions = []) => {
    const map = {};
    reactions.forEach((r) => {
      if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, mine: false };
      map[r.emoji].count++;
      if (String(r.user) === String(user._id)) map[r.emoji].mine = true;
    });
    return Object.values(map);
  };

  // Quoted original message par scroll karo + flash highlight
  const scrollToMsg = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1200);
  };

  const send = (e) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    // Optimistic: bhejte hi bubble dikhao ("sending..." ke saath), server
    // confirm kare to asli message se replace ho jayega
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempMsg = {
      _id: tempId,
      conversation: convoId,
      sender: { _id: user._id, name: user.name },
      text: msg,
      image: null,
      createdAt: new Date().toISOString(),
      sending: true,
      // Reply ka quote optimistic bubble me bhi dikhao
      replyTo: replyTo
        ? { _id: replyTo._id, text: replyTo.text, image: replyTo.image, sender: replyTo.sender }
        : null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(), 50);
    getSocket().emit("send-message", {
      conversationId: convoId,
      text: msg,
      clientTempId: tempId,
      replyTo: replyTo?._id || null,
    });
    emitTyping(false);
    clearTimeout(typingTimer.current);
    setText("");
    setReplyTo(null);
  };

  const sendImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Optimistic: photo select karte hi turant preview dikhao, upload
    // background me hoga. Fail ho to "retry" dikhega.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const blobUrl = URL.createObjectURL(file);
    const tempMsg = {
      _id: tempId,
      conversation: convoId,
      sender: { _id: user._id, name: user.name },
      text: "",
      image: blobUrl,
      createdAt: new Date().toISOString(),
      sending: true,
      uploadFailed: false,
      replyTo: replyTo
        ? { _id: replyTo._id, text: replyTo.text, image: replyTo.image, sender: replyTo.sender }
        : null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(), 50);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      // NOTE: Content-Type header manually set MAT karo — browser khud
      // "multipart/form-data; boundary=..." lagata hai. Manual header se
      // boundary missing ho jati hai aur multer upload fail kar deta hai.
      const { data } = await api.post("/messages/upload", form);
      getSocket().emit("send-message", {
        conversationId: convoId,
        text: "",
        image: data.url,
        clientTempId: tempId,
        replyTo: replyTo?._id || null,
      });
      setReplyTo(null);
    } catch {
      // upload failed — bubble par retry dikhao
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, sending: false, uploadFailed: true } : m))
      );
      try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="chat-main">
      <header className="chat-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconChevronLeft width={22} height={22} />
        </button>
        <button
          className="chat-peer"
          onClick={() => !convo.isGroup && other && onViewProfile?.(other._id)}
          title={convo.isGroup ? "" : "View profile"}
        >
          <span className="avatar-wrap">
            <Avatar user={convo.isGroup ? { name: convoName(convo, user._id), avatarColor: "#635BFF" } : other} size={40} />
            {online && <span className="dot" />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="chat-title ellipsis">{convoName(convo, user._id)}</div>
            <div className="small" style={{ color: online ? "var(--success)" : "var(--muted)", fontWeight: 600 }}>
              {convo.isGroup
                ? `${convo.participants.length} members`
                : online
                  ? "● Online"
                  : "Offline"}
            </div>
          </div>
        </button>
        <div className="head-actions">
          <button className="icon-btn" title="Voice call (coming soon)" aria-label="Voice call">
            <IconPhone width={19} height={19} />
          </button>
          <button className="icon-btn" title="Video call (coming soon)" aria-label="Video call">
            <IconVideo width={20} height={20} />
          </button>
          <div style={{ position: "relative" }}>
            <button
              className="icon-btn"
              title="Chat options"
              aria-label="Chat options"
              onClick={() => { setShowMenu((s) => !s); setConfirmDelete(false); }}
            >
              ⋮
            </button>
            {showMenu && (
              <div className="chat-menu">
                <button
                  className="chat-menu-item danger"
                  onClick={() => {
                    if (confirmDelete) {
                      onDeleteChat?.(convo._id);
                      setShowMenu(false);
                    } else {
                      setConfirmDelete(true);
                      setTimeout(() => setConfirmDelete(false), 3000);
                    }
                  }}
                >
                  {confirmDelete ? "Pakka delete? ✓" : "🗑️ Delete chat"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="messages" ref={scrollRef} onScroll={handleScroll}>
        {messages.map((m) => {
          const mine = String(m.sender._id || m.sender) === String(user._id);
          const seen = mine && !m.sending && isSeenByAll(m, convo, user._id);
          const chips = groupedReactions(m.reactions);
          return (
            <div key={m._id} id={`msg-${m._id}`} className={`msg-row ${mine ? "mine" : ""}`}>
              <div
                className={`bubble ${m.sending ? "sending" : ""}`}
                onPointerDown={() => startPress(m)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!m.sending) setReactFor(m._id);
                }}
              >
                {!mine && <div className="sender">{m.sender.name}</div>}
                {/* Reply quote — tap karne par original message par scroll */}
                {m.replyTo && (
                  <button
                    className="quote"
                    onClick={() => scrollToMsg(m.replyTo._id || m.replyTo)}
                    title="Go to original message"
                  >
                    <span className="quote-name">{quoteName(m.replyTo)}</span>
                    <span className="quote-text">{quoteSnippet(m.replyTo)}</span>
                  </button>
                )}
                {m.image && (
                  <div className="bubble-img-wrap">
                    <img
                      src={m.image.startsWith("blob:") ? m.image : fileUrl(m.image)}
                      alt="Shared photo"
                      className="bubble-img"
                      loading="lazy"
                      onClick={() => !m.sending && setLightbox(fileUrl(m.image))}
                    />
                    {m.sending && (
                      <div className="upload-overlay">
                        <span className="ptr-spinner spinning">⟳</span>
                      </div>
                    )}
                  </div>
                )}
                {m.text && <div>{m.text}</div>}
                <div className="time">
                  {timeHM(m.createdAt)}
                  {mine && (
                    <span className={`ticks ${seen ? "seen" : ""}`}>
                      {m.sending ? "🕐" : seen ? "✓✓" : "✓"}
                    </span>
                  )}
                  {/* Desktop hover par quick react/reply buttons */}
                  {!m.sending && (
                    <span className="msg-quick">
                      <button
                        className="msg-quick-btn"
                        title="React"
                        onClick={(e) => { e.stopPropagation(); setReactFor(reactFor === m._id ? null : m._id); }}
                      >
                        😊
                      </button>
                      <button
                        className="msg-quick-btn"
                        title="Reply"
                        onClick={(e) => { e.stopPropagation(); setReplyTo(m); }}
                      >
                        ↩️
                      </button>
                    </span>
                  )}
                </div>
                {/* Reaction chips */}
                {chips.length > 0 && (
                  <div className="react-chips">
                    {chips.map((g) => (
                      <button
                        key={g.emoji}
                        className={`react-chip ${g.mine ? "mine" : ""}`}
                        onClick={() => react(m, g.emoji)}
                        title="Tap to toggle your reaction"
                      >
                        {g.emoji}
                        {g.count > 1 && <span>{g.count}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {m.uploadFailed && (
                  <button
                    className="retry-btn"
                    onClick={() => {
                      // purana failed bubble hatao, user dobara photo chune
                      setMessages((prev) => prev.filter((x) => x._id !== m._id));
                      fileRef.current?.click();
                    }}
                  >
                    ⚠️ Send fail — tap to retry
                  </button>
                )}
                {m.sendFailed && (
                  <div className="send-fail">⚠️ Not sent — reply ka message nahi mila</div>
                )}
              </div>
              {/* Emoji picker popover (long-press / right-click / 😊 button) */}
              {reactFor === m._id && !m.sending && (
                <div className={`react-picker ${mine ? "mine" : ""}`}>
                  {REACT_EMOJIS.map((e) => (
                    <button key={e} className="react-emoji" onClick={() => react(m, e)}>
                      {e}
                    </button>
                  ))}
                  <button
                    className="react-emoji"
                    title="Reply"
                    onClick={() => { setReplyTo(m); setReactFor(null); }}
                  >
                    ↩️
                  </button>
                  <button className="react-emoji" title="Close" onClick={() => setReactFor(null)}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {typingUser && <div className="typing">{typingUser} is typing…</div>}
        <div ref={bottomRef} />
      </div>

      {hasNew && (
        <button
          className="new-msg-pill"
          onClick={() => {
            scrollToBottom();
            setHasNew(false);
          }}
        >
          ↓ New messages
        </button>
      )}

      {/* Reply quote bar */}
      {replyTo && (
        <div className="reply-bar">
          <div className="reply-bar-body">
            <span className="quote-name">Replying to {quoteName(replyTo)}</span>
            <span className="quote-text">{quoteSnippet(replyTo)}</span>
          </div>
          <button
            className="icon-btn"
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            title="Cancel reply"
          >
            <IconX width={16} height={16} />
          </button>
        </div>
      )}

      <form className="composer" onSubmit={send}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={sendImage}
        />
        <button
          type="button"
          className="icon-btn"
          title="Send photo"
          aria-label="Send photo"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <IconImage width={20} height={20} />
        </button>
        <input
          placeholder={uploading ? "Uploading photo…" : "Type a message..."}
          value={text}
          onChange={handleChange}
          autoComplete="off"
          disabled={uploading}
        />
        <button type="submit" className="send-btn" title="Send" aria-label="Send">
          <IconSend width={20} height={20} />
        </button>
      </form>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" />
          <button className="lightbox-close" aria-label="Close">
            <IconX width={22} height={22} />
          </button>
        </div>
      )}
    </main>
  );
}
