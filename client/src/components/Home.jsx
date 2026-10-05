import { useEffect, useState } from "react";
import api from "../api.js";
import Avatar from "./Avatar.jsx";
import { IconHeart } from "./icons.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import PullToRefresh from "./PullToRefresh.jsx";
import { timeHM, fileUrl } from "../utils.js";

// Home: FB/Insta style feed — friends' photo posts + everyone's notes, newest first.
export default function Home({ onViewProfile }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/feed");
      setItems(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const post = async () => {
    const t = text.trim();
    if (!t) return;
    setPosting(true);
    try {
      await api.post("/notes", { text: t });
      setText("");
      load();
    } catch {
      alert("Note post nahi ho paya");
    }
    setPosting(false);
  };

  const toggleLike = async (item) => {
    const base = item.kind === "post" ? "posts" : "notes";
    const { data } = await api.post(`/${base}/${item._id}/like`);
    setItems((prev) =>
      prev.map((it) =>
        it._id === item._id
          ? { ...it, likesCount: data.likesCount, likedByMe: data.likedByMe }
          : it
      )
    );
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const remove = async (item) => {
    // Pehli tap par confirm mango, dusri par delete karo (native confirm
    // dialog automation/mobile me achha nahi lagta)
    if (confirmDeleteId !== item._id) {
      setConfirmDeleteId(item._id);
      setTimeout(() => setConfirmDeleteId((id) => (id === item._id ? null : id)), 3000);
      return;
    }
    setConfirmDeleteId(null);
    const base = item.kind === "post" ? "posts" : "notes";
    try {
      await api.delete(`/${base}/${item._id}`);
      setItems((prev) => prev.filter((it) => it._id !== item._id));
    } catch {
      alert("Delete nahi ho paya");
    }
  };

  const isMine = (item) => String(item.user._id || item.user) === String(user._id);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="note-composer feed-composer">
        <div className="composer-row">
          <Avatar user={user} size={40} />
          <input
            maxLength={500}
            placeholder="What's on your mind today? ✍️"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && post()}
          />
        </div>
        <div className="composer-actions">
          <span className="muted small">Share a thought with everyone</span>
          <button className="btn primary small" onClick={post} disabled={posting || !text.trim()}>
            {posting ? "Sharing…" : "Share"}
          </button>
        </div>
      </div>

      <div className="feed">
        {items.length === 0 && (
          <p className="muted small empty-note">
            Abhi feed khali hai — dost banao aur pehla post share karo! ✨
          </p>
        )}
        {items.map((item) => (
          <article key={`${item.kind}-${item._id}`} className="feed-card">
            <div className="feed-head">
              <button className="person-id" onClick={() => onViewProfile(item.user._id)}>
                <Avatar user={item.user} size={40} />
                <span className="person-meta">
                  <span className="person-name">{item.user.name}</span>
                  <span className="muted small">
                    {timeHM(item.createdAt)} · {item.kind === "post" ? "📷 Photo" : "📝 Note"}
                  </span>
                </span>
              </button>
              {isMine(item) && (
                <button className="link danger" onClick={() => remove(item)}>
                  {confirmDeleteId === item._id ? "Pakka? ✓" : "Delete"}
                </button>
              )}
            </div>

            {item.kind === "post" ? (
              <>
                <img src={fileUrl(item.image)} alt="Post" className="feed-img" loading="lazy" />
                {item.caption && <p className="feed-caption">{item.caption}</p>}
              </>
            ) : (
              <p className="feed-note-text">{item.text}</p>
            )}

            <div className="post-actions feed-actions">
              <button
                className={`like-btn ${item.likedByMe ? "liked" : ""}`}
                onClick={() => toggleLike(item)}
              >
                {item.likedByMe
                  ? <IconHeart filled width={18} height={18} />
                  : <IconHeart width={18} height={18} />} {item.likesCount}
              </button>
            </div>
          </article>
        ))}
      </div>
    </PullToRefresh>
  );
}
