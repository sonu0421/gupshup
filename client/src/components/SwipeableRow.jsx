import { useRef, useState } from "react";

// Swipe left on a row to reveal a delete button (WhatsApp style).
// Works with touch (mobile) and also shows delete on hover for desktop.
export default function SwipeableRow({ onDelete, deleteLabel = "Delete", children }) {
  const [offset, setOffset] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const dragging = useRef(false);

  const DELETE_WIDTH = 84;

  const onTouchStart = (e) => {
    dragging.current = true;
    startX.current = e.touches[0].clientX;
    currentX.current = offset;
  };

  const onTouchMove = (e) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    // Sirf left swipe (negative), 0 se zyada right nahi
    const next = Math.min(0, Math.max(-DELETE_WIDTH - 20, currentX.current + dx));
    setOffset(next);
  };

  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    // Aadhe se zyada swipe to khula rakho, nahi to band karo
    setOffset(offset < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0);
    if (offset >= -DELETE_WIDTH / 2) setConfirming(false);
  };

  const handleDelete = () => {
    if (confirming) {
      onDelete?.();
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <div
      className="swipe-row"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="swipe-delete"
        style={{ width: offset < -10 || confirming ? DELETE_WIDTH : 0 }}
        onClick={handleDelete}
      >
        {confirming ? "Pakka? ✓" : `🗑️ ${deleteLabel}`}
      </div>
      <div
        className="swipe-content"
        style={{ transform: `translateX(${offset}px)` }}
        onClick={() => {
          if (offset !== 0) setOffset(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
