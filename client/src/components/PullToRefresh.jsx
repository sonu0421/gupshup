import { useRef, useState } from "react";

// Pull-to-refresh wrapper for mobile: drag down from the top of a scrollable
// area to trigger onRefresh. Desktop / mouse unaffected.
// Works even when the real scroll happens in a nested element (.convo-list etc.)
// by finding the nearest scrollable ancestor of the touch target.
export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const wrapRef = useRef(null);
  const startY = useRef(0);
  const scrollEl = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const THRESHOLD = 70;

  const findScroller = (target) => {
    let node = target;
    while (node && node !== wrapRef.current?.parentElement) {
      if (node.nodeType === 1) {
        const style = window.getComputedStyle(node);
        if (
          /(auto|scroll)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          return node;
        }
      }
      node = node.parentNode;
    }
    return wrapRef.current;
  };

  const atTop = () => !scrollEl.current || scrollEl.current.scrollTop <= 0;

  const onTouchStart = (e) => {
    if (refreshing) return;
    scrollEl.current = findScroller(e.target);
    startY.current = atTop() ? e.touches[0].clientY : 0;
  };

  const onTouchMove = (e) => {
    if (refreshing || !startY.current || !atTop()) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      // Dampen the pull so it feels springy, cap it
      setPull(Math.min(dy * 0.5, 110));
      if (dy > 10 && e.cancelable) e.preventDefault();
    } else {
      setPull(0);
    }
  };

  const onTouchEnd = async () => {
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPull(0);
    startY.current = 0;
    scrollEl.current = null;
  };

  const showLoader = refreshing || pull >= THRESHOLD;

  return (
    <div ref={wrapRef} className={`ptr-wrap ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="ptr-indicator"
        style={{
          height: showLoader ? 44 : pull,
          opacity: pull > 5 || refreshing ? 1 : 0,
        }}
      >
        <span className={`ptr-spinner ${refreshing ? "spinning" : ""}`}>
          {refreshing ? "⟳" : pull >= THRESHOLD ? "↑" : "↓"}
        </span>
        <span className="ptr-text">{refreshing ? "Refreshing…" : pull >= THRESHOLD ? "Release!" : "Pull to refresh"}</span>
      </div>
      {children}
    </div>
  );
}
