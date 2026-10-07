import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api.js";
import Avatar from "./Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getSocket } from "../socket.js";
import { fileUrl } from "../utils.js";
import StoryViewer from "./StoryViewer.jsx";

// IG-style stories strip at the top of Home: friends' + own 24h stories.
// "+" tile -> photo picker + caption -> POST /api/stories
export default function StoriesBar({ onReplyToUser }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]); // [{ user, stories: [...], unseen: bool }]
  const [viewer, setViewer] = useState(null); // { groupIdx, storyIdx }
  const [composing, setComposing] = useState(null); // { file, previewUrl, caption }
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/stories");
      // user-wise group karo (server newest-first bhejta hai)
      const map = new Map();
      data.forEach((s) => {
        const uid = String(s.user._id);
        if (!map.has(uid)) map.set(uid, { user: s.user, stories: [], unseen: false });
        const g = map.get(uid);
        g.stories.push(s);
        if (!s.viewedByMe && String(s.user._id) !== String(user._id)) g.unseen = true;
      });
      const arr = [...map.values()];
      // Apni stories sabse pehle
      arr.sort((a, b) =>
        String(a.user._id) === String(user._id) ? -1 :
        String(b.user._id) === String(user._id) ? 1 : 0
      );
      setGroups(arr);
    } catch {
      /* ignore */
    }
  }, [user._id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onNew = () => load();
    socket.on("story-new", onNew);
    return () => socket.off("story-new", onNew);
  }, [load]);

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setComposing({ file, previewUrl: URL.createObjectURL(file), caption: "" });
  };

  const postStory = async () => {
    if (!composing || posting) return;
    setPosting(true);
    try {
      const form = new FormData();
      form.append("image", composing.file);
      form.append("caption", composing.caption.slice(0, 100));
      await api.post("/stories", form);
      try { URL.revokeObjectURL(composing.previewUrl); } catch { /* ignore */ }
      setComposing(null);
      load();
    } catch {
      alert("Story post nahi ho payi");
    }
    setPosting(false);
  };

  const openViewer = (groupIdx, storyIdx = 0) => setViewer({ groupIdx, storyIdx });

  const handleDelete = async (storyId) => {
    try {
      await api.delete(`/stories/${storyId}`);
      setViewer(null);
      load();
    } catch {
      alert("Story delete nahi ho payi");
    }
  };

  const handleReply = (authorId) => {
    setViewer(null);
    onReplyToUser?.(authorId);
  };

  return (
    <>
      <div className="stories-bar">
        {/* Add story tile */}
        <div className="story-tile">
          <button className="story-add" onClick={() => fileRef.current?.click()} title="Add story">
            <Avatar user={user} size={56} />
            <span className="story-plus">+</span>
          </button>
          <span className="story-name">You</span>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
        </div>

        {groups.map((g, gi) => {
          const mine = String(g.user._id) === String(user._id);
          return (
            <div className="story-tile" key={g.user._id}>
              <button
                className={`story-ring ${g.unseen ? "unseen" : "seen"}`}
                onClick={() => openViewer(gi, g.unseen ? g.stories.findIndex((s) => !s.viewedByMe) : 0)}
                title={`${g.user.name} ki stories`}
              >
                <img src={fileUrl(g.stories[0].image)} alt="" loading="lazy" />
              </button>
              <span className="story-name">{mine ? "You" : g.user.name.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>

      {/* Story composer (preview + caption) */}
      {composing && (
        <div className="story-composer" onClick={() => !posting && setComposing(null)}>
          <div className="story-composer-card" onClick={(e) => e.stopPropagation()}>
            <img src={composing.previewUrl} alt="Story preview" />
            <input
              maxLength={100}
              placeholder="Caption likho… (optional)"
              value={composing.caption}
              onChange={(e) => setComposing({ ...composing, caption: e.target.value })}
            />
            <div className="story-composer-actions">
              <button className="btn" onClick={() => setComposing(null)} disabled={posting}>
                Cancel
              </button>
              <button className="btn primary" onClick={postStory} disabled={posting}>
                {posting ? "Posting…" : "Share story"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewer && (
        <StoryViewer
          groups={groups}
          groupIdx={viewer.groupIdx}
          storyIdx={viewer.storyIdx}
          currentUserId={user._id}
          onNavigate={(gi, si) => setViewer({ groupIdx: gi, storyIdx: si })}
          onClose={() => { setViewer(null); load(); }}
          onDelete={handleDelete}
          onReply={handleReply}
          onViewed={load}
        />
      )}
    </>
  );
}
