import { useEffect, useRef, useState } from "react";
import api from "../api.js";
import Avatar from "./Avatar.jsx";
import { IconX } from "./icons.jsx";
import { fileUrl, timeHM } from "../utils.js";

const DURATION_MS = 5000;

// Fullscreen story viewer: 5s auto-advance, progress bars, tap zones.
// Props: groups, groupIdx, storyIdx, currentUserId, onNavigate(gi, si),
// onClose, onDelete(storyId), onReply(authorId), onViewed()
export default function StoryViewer({
  groups, groupIdx, storyIdx, currentUserId,
  onNavigate, onClose, onDelete, onReply, onViewed,
}) {
  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const [showViewers, setShowViewers] = useState(false);
  const viewedRef = useRef(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mine = story && String(story.user._id) === String(currentUserId);

  const goNext = () => {
    if (!group) return onClose();
    if (storyIdx + 1 < group.stories.length) {
      onNavigate(groupIdx, storyIdx + 1);
    } else if (groupIdx + 1 < groups.length) {
      onNavigate(groupIdx + 1, 0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIdx > 0) onNavigate(groupIdx, storyIdx - 1);
    else if (groupIdx > 0) onNavigate(groupIdx - 1, groups[groupIdx - 1].stories.length - 1);
  };

  // Auto-advance
  useEffect(() => {
    const t = setTimeout(goNext, DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx]);

  // Viewed mark karo (ek story ek baar)
  useEffect(() => {
    if (!story || mine) return;
    const key = String(story._id);
    if (viewedRef.current.has(key)) return;
    viewedRef.current.add(key);
    api.post(`/stories/${story._id}/view`).then(() => onViewed?.()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?._id]);

  // Esc se band karo
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!story) return null;

  const tap = (e) => {
    // Buttons par tap ho to zone navigation mat karo
    if (e.target.closest("button")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.3) goPrev();
    else goNext();
  };

  return (
    <div className="story-viewer" onClick={tap}>
      <img src={fileUrl(story.image)} alt="Story" className="story-viewer-img" />

      {/* Progress bars */}
      <div className="story-progress">
        {group.stories.map((s, i) => (
          <div key={s._id} className="story-prog-track">
            <div
              className={`story-prog-fill ${i < storyIdx ? "done" : ""}`}
              // current story par 5s ka fill animation dobara chalao
              key={`${s._id}-${i === storyIdx ? storyIdx : "x"}`}
              style={i === storyIdx ? { animationDuration: `${DURATION_MS}ms` } : undefined}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="story-head">
        <Avatar user={story.user} size={36} />
        <div className="story-head-meta">
          <span className="story-head-name">{mine ? "You" : story.user.name}</span>
          <span className="story-head-time">{timeHM(story.createdAt)}</span>
        </div>
        <button className="icon-btn story-close" onClick={onClose} aria-label="Close story">
          <IconX width={22} height={22} />
        </button>
      </div>

      {/* Caption */}
      {story.caption && <div className="story-caption">{story.caption}</div>}

      {/* Bottom actions */}
      <div className="story-actions" onClick={(e) => e.stopPropagation()}>
        {mine ? (
          <>
            <button className="story-action-btn" onClick={() => setShowViewers((s) => !s)}>
              👁️ {story.viewersCount || 0} views
            </button>
            <button
              className="story-action-btn danger"
              onClick={() => {
                if (confirmDelete) onDelete(story._id);
                else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }
              }}
            >
              {confirmDelete ? "Pakka delete? ✓" : "🗑️ Delete"}
            </button>
          </>
        ) : (
          <button className="story-action-btn primary" onClick={() => onReply(story.user._id)}>
            💬 Reply
          </button>
        )}
      </div>

      {/* Viewers list (apni story par) */}
      {mine && showViewers && (
        <div className="story-viewers" onClick={(e) => e.stopPropagation()}>
          <div className="story-viewers-head">
            <strong>Viewed by {story.viewers?.length || 0}</strong>
            <button className="icon-btn" onClick={() => setShowViewers(false)} aria-label="Close viewers">
              <IconX width={16} height={16} />
            </button>
          </div>
          {(story.viewers || []).length === 0 && (
            <p className="muted small">Abhi kisi ne nahi dekhi</p>
          )}
          {(story.viewers || []).map((v) => (
            <div key={v._id} className="story-viewer-row">
              <Avatar user={v} size={32} />
              <span>{v.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
