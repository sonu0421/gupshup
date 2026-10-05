import { useRef, useState } from "react";

// Swipe left on a row to reveal a delete button (WhatsApp style).
// Mobile: touch swipe. Desktop: hover par delete dikhta hai.
export default function SwipeableRow({ onDelete, deleteLabel = "Delete", children }) {
  const [offset, setOffset] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const dragging = useRef(false);
  const isHorizontal = useRef(false);

  const DELETE_WIDTH = 84;

  const onTouchStart = (e) => {
    dragging.current = true;
    isHorizontal.current = false;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = offset;
  };

  const onTouchMove = (e) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Pehli baar decide karo: horizontal swipe hai ya vertical scroll?
    if (!isHorizontal.current) {
      // 10px se zyada horizontal aur vertical se double to swipe hai
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        isHorizontal.current = true;
      } else if (Math.abs(dy) > 10) {
        // Vertical scroll hai — swipe cancel karo
        dragging.current = false;
        return;
      } else {
        return; // Abhi decide nahi hua
      }
    }

    // Horizontal swipe hai — vertical scroll roko
    if (isHorizontal.current) {
      e.preventDefault();
      const next = Math.min(0, Math.max(-DELETE_WIDTH - 20, currentX.current + dx));
      setOffset(next);
    }
  };

  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (!isHorizontal.current) return;
    // Aadhe se zyada swipe to khula rakho, nahi to band karo
    setOffset(offset < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0);
    if (offset >= -DELETE_WIDTH / 2) setConfirming(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirming) {
      onDelete?.();
      setOffset(0);
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  // Row par tap karo to swipe band karo (dusri row khuli ho to)
  const handleContentClick = () => {
    if (offset !== 0) {
      setOffset(0);
      setConfirming(false);
    }
  };

  return (
    <div
      className="swipe-row"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className={`swipe-delete ${offset < -10 || confirming ? "swipe-open" : ""}`}
        onClick={handleDelete}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {confirming ? "Pakka? ✓" : `🗑️ ${deleteLabel}`}
      </div>
      <div
        className="swipe-content"
        style={{ transform: `translateX(${offset}px)` }}
        onClick={handleContentClick}
      >
        {children}
      </div>
    </div>
  );
}
