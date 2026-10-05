import { useEffect, useRef, useState } from "react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx"; // blank-screen fix
import Avatar from "./Avatar.jsx";
import { IconHeart, IconChevronLeft } from "./icons.jsx";
import { timeHM, fileUrl } from "../utils.js";
import PullToRefresh from "./PullToRefresh.jsx";

// Double-tap to confirm logout (native confirm() dialogs don't work well
// in all browsers/automation; this is also nicer on mobile)
function LogoutButton({ onLogout }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);
  const handle = () => {
    if (armed) {
      clearTimeout(timer.current);
      onLogout();
    } else {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
    }
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      className="btn"
      style={{ width: "100%", marginTop: 4, color: "var(--danger, #DC2626)" }}
      onClick={handle}
    >
      {armed ? "Pakka? Dobara dabao ✓" : "⎋ Log out"}
    </button>
  );
}

// Full profile dashboard (FB/Insta style): header, stats, posts, notes.
export default function ProfilePage({
  userId,
  currentUserId,
  onBack,
  onEdit,
  onSendRequest,
  onMessage,
  onGoRequests,
  onLogout,
  onUnfriend,
}) {
  const [profile, setProfile] = useState(null);
  const [friendStatus, setFriendStatus] = useState("none");
  const [posts, setPosts] = useState([]);
  const [postsBlocked, setPostsBlocked] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const [ptab, setPtab] = useState("posts");
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const openFriends = async () => {
    setShowFriends(true);
    setFriendsLoading(true);
    try {
      const { data } = await api.get(`/friends/of/${userId}`);
      setFriendsList(data);
    } catch {
      setFriendsList([]);
    }
    setFriendsLoading(false);
  };
  const postFileRef = useRef(null);

  const isSelf = String(userId) === String(currentUserId);

  const load = async () => {
    const { data } = await api.get(`/users/${userId}`);
    setProfile(data);
    // friendship status from discover list
    try {
      const { data: people } = await api.get("/users");
      setFriendStatus(people.find((p) => p._id === userId)?.friendStatus || "none");
    } catch {
      /* ignore */
    }
    try {
      const { data: p } = await api.get(`/posts/user/${userId}`);
      setPosts(p);
      setPostsBlocked(false);
    } catch (e) {
      if (e.response?.status === 403) setPostsBlocked(true);
    }
    try {
      const { data: n } = await api.get(`/notes/user/${userId}`);
      setNotes(n);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setProfile(null);
    load();
  }, [userId]);

  const createPost = async () => {
    if (!postFile) {
      alert("Pehle photo chuno");
      return;
    }
    setPosting(true);
    const form = new FormData();
    form.append("image", postFile);
    form.append("caption", postCaption);
    try {
      await api.post("/posts", form);
      setPostCaption("");
      setPostFile(null);
      setShowNewPost(false);
      load();
    } catch (e) {
      alert(e.response?.data?.message || "Post nahi ban paya");
    }
    setPosting(false);
  };

  const togglePostLike = async (post) => {
    const { data } = await api.post(`/posts/${post._id}/like`);
    setPosts((prev) =>
      prev.map((p) =>
        p._id === post._id ? { ...p, likesCount: data.likesCount, likedByMe: data.likedByMe } : p
      )
    );
  };

  const deletePost = async (postId) => {
    if (!confirm("Ye post delete kar dein?")) return;
    await api.delete(`/posts/${postId}`);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  };

  const toggleNoteLike = async (note) => {
    const { data } = await api.post(`/notes/${note._id}/like`);
    setNotes((prev) =>
      prev.map((n) =>
        n._id === note._id ? { ...n, likesCount: data.likesCount, likedByMe: data.likedByMe } : n
      )
    );
  };

  if (!profile) {
    return (
      <main className="chat-main profile-page">
        <p className="muted" style={{ padding: 24 }}>Loading profile…</p>
      </main>
    );
  }

  return (
    <PullToRefresh onRefresh={load}>
    <main className="profile-page">
      {onBack && (
        <header className="chat-head">
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <IconChevronLeft width={22} height={22} />
          </button>
          <div className="chat-title">{profile.name}</div>
        </header>
      )}

      <div className="profile-cover" />
      <div className="profile-body">
        <div className="profile-avatar-row">
          <Avatar user={profile} size={88} />
          {isSelf ? (
            <button className="btn small" onClick={onEdit}>
              Edit Profile
            </button>
          ) : (
            friendStatus === "friends" && (
              <button className="btn primary small" onClick={() => onMessage(userId)}>
                Message
              </button>
            )
          )}
        </div>

        <div className="profile-name">
          {profile.name} {profile.isPrivate && <span title="Private account">🔒</span>}
        </div>
        <div className="profile-handle">@{profile.email.split("@")[0]}</div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}

        <div className="profile-stats">
          <span className="stat"><b>{postsBlocked ? "–" : posts.length}</b><span>Posts</span></span>
          <button className="stat stat-btn" onClick={openFriends}>
            <b>{profile.friendsCount ?? 0}</b><span>Connections</span>
          </button>
          <span className="stat"><b>{notes.length}</b><span>Notes</span></span>
        </div>

        {!isSelf && (
          <div className="profile-actions">
            {friendStatus === "none" && (
              <button className="btn primary" onClick={() => onSendRequest(userId)}>
                + Add Friend
              </button>
            )}
            {friendStatus === "friends" && (
              <button
                className="btn small"
                style={{ color: "var(--danger, #DC2626)" }}
                onClick={async () => {
                  if (confirmUnfriend) {
                    try {
                      await api.delete(`/friends/${userId}`);
                    } catch { /* ignore */ }
                    setFriendStatus("none");
                    setConfirmUnfriend(false);
                    onUnfriend?.(userId);
                  } else {
                    setConfirmUnfriend(true);
                    setTimeout(() => setConfirmUnfriend(false), 3000);
                  }
                }}
              >
                {confirmUnfriend ? "Pakka unfriend? ✓" : "Unfriend"}
              </button>
            )}
            {friendStatus === "pending-sent" && (
              <button className="btn" disabled>Request sent ✓</button>
            )}
            {friendStatus === "pending-received" && (
              <button className="btn primary" onClick={onGoRequests}>
                Respond to request →
              </button>
            )}
          </div>
        )}

        {isSelf && onLogout && (
          <LogoutButton onLogout={onLogout} />
        )}

        <div className="chip-row" style={{ marginBottom: 4 }}>
          <button className={`chip ${ptab === "posts" ? "active" : ""}`} onClick={() => setPtab("posts")}>
            Posts
          </button>
          <button className={`chip ${ptab === "about" ? "active" : ""}`} onClick={() => setPtab("about")}>
            About
          </button>
        </div>

        {ptab === "posts" && (
        <div className="profile-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Posts & Notes</h3>
            {isSelf && (
              <button className="btn small" onClick={() => setShowNewPost((s) => !s)}>
                + New post
              </button>
            )}
          </div>
          {isSelf && showNewPost && (
            <div className="feed-card" style={{ padding: 14, marginBottom: 12 }}>
              <button className="btn small" onClick={() => postFileRef.current?.click()}>
                {postFile ? `📷 ${postFile.name.slice(0, 24)}` : "📷 Choose photo"}
              </button>
              <input
                ref={postFileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setPostFile(e.target.files[0] || null)}
              />
              {postFile && (
                <div style={{ marginTop: 10, position: "relative" }}>
                  <img
                    src={URL.createObjectURL(postFile)}
                    alt="Preview"
                    style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }}
                  />
                  <button
                    className="icon-btn"
                    style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.55)", color: "#fff" }}
                    onClick={() => setPostFile(null)}
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              )}
              <input
                placeholder="Write a caption…"
                value={postCaption}
                maxLength={300}
                onChange={(e) => setPostCaption(e.target.value)}
                style={{ margin: "8px 0" }}
              />
              <button className="btn primary small block" onClick={createPost} disabled={posting}>
                {posting ? "Posting…" : "Share post"}
              </button>
            </div>
          )}
          {postsBlocked ? (
            <p className="muted small empty-note">🔒 Private account — posts sirf friends dekh sakte hain.</p>
          ) : posts.length === 0 ? (
            <p className="muted small empty-note">
              {isSelf ? "Abhi koi post nahi — pehli photo daalo!" : "Abhi koi post nahi hai."}
            </p>
          ) : (
            <div>
              {posts.map((p) => (
                <div key={p._id} className="post-card">
                  <div className="feed-head" style={{ padding: "10px 14px" }}>
                    <span className="person-id">
                      <Avatar user={profile} size={36} />
                      <span className="person-meta">
                        <span className="person-name">{profile.name}</span>
                        <span className="muted small">{timeHM(p.createdAt)}</span>
                      </span>
                    </span>
                    {isSelf && (
                      <button className="link danger" onClick={() => deletePost(p._id)}>
                        Delete
                      </button>
                    )}
                  </div>
                  <img className="post-img" src={fileUrl(p.image)} alt="post" loading="lazy" />
                  <div className="post-body">
                    {p.caption && <p className="post-caption">{p.caption}</p>}
                    <div className="post-actions">
                      <button
                        className={`like-btn ${p.likedByMe ? "liked" : ""}`}
                        onClick={() => togglePostLike(p)}
                      >
                        {p.likedByMe ? <IconHeart filled width={18} height={18} /> : <IconHeart width={18} height={18} />} {p.likesCount}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {notes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {notes.map((n) => (
                <div key={n._id} className="feed-card" style={{ padding: 14, marginBottom: 10 }}>
                  <p className="feed-note-text" style={{ padding: 0 }}>{n.text}</p>
                  <div className="post-actions" style={{ marginTop: 8 }}>
                    <span className="muted small">{timeHM(n.createdAt)}</span>
                    <button
                      className={`like-btn ${n.likedByMe ? "liked" : ""}`}
                      onClick={() => toggleNoteLike(n)}
                    >
                      {n.likedByMe ? <IconHeart filled width={18} height={18} /> : <IconHeart width={18} height={18} />} {n.likesCount}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {ptab === "about" && (
          <div className="profile-section">
            <div className="feed-card" style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <div className="small" style={{ fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>BIO</div>
                <div>{profile.bio || "Hey, I'm on Gupshup!"}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="small" style={{ fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>EMAIL</div>
                <div>{profile.email}</div>
              </div>
              <div>
                <div className="small" style={{ fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>ACCOUNT</div>
                <div>{profile.isPrivate ? "🔒 Private — posts only for friends" : "🌍 Public"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>

    {/* Friends/connections list modal */}
    {showFriends && (
      <div className="modal-overlay" onClick={() => setShowFriends(false)}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Connections ({friendsList.length})</h3>
            <button className="icon-btn" onClick={() => setShowFriends(false)} aria-label="Close">✕</button>
          </div>
          <div style={{ overflowY: "auto" }}>
            {friendsLoading ? (
              <p className="muted" style={{ textAlign: "center", padding: 20 }}>Loading…</p>
            ) : friendsList.length === 0 ? (
              <p className="muted" style={{ textAlign: "center", padding: 20 }}>
                {profile.isPrivate && !isSelf ? "🔒 Private account" : "Abhi koi connections nahi"}
              </p>
            ) : (
              friendsList.map((f) => (
                <div key={f._id} className="person-row">
                  <span className="person-id">
                    <Avatar user={f} size={40} />
                    <span className="person-meta">
                      <span className="person-name">{f.name}</span>
                      <span className="muted small ellipsis">{f.bio || "Hey, I'm on Gupshup!"}</span>
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}
    </PullToRefresh>
  );
}
