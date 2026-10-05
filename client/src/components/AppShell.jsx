import { useEffect, useState } from "react";
import Avatar from "./Avatar.jsx";
import ConnectionBanner from "./ConnectionBanner.jsx";
import {
  IconHome, IconChat, IconCompass, IconUserPlus, IconBell,
  IconUser, IconSearch, IconPlus,
} from "./icons.jsx";

export function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

export const TABS = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "chats", label: "Chats", Icon: IconChat },
  { id: "discover", label: "Discover", Icon: IconCompass },
  { id: "requests", label: "Requests", Icon: IconUserPlus },
  { id: "profile", label: "Profile", Icon: IconUser },
];

const TAB_TITLES = {
  home: "Home",
  chats: "Messages",
  discover: "Discover",
  requests: "Requests",
  profile: "Profile",
};

function BellButton({ unread, onToggle }) {
  return (
    <button
      className={`icon-btn bell-btn ${unread > 0 ? "has-unread" : ""}`}
      onClick={onToggle}
      aria-label="Notifications"
    >
      <IconBell width={21} height={21} />
      {unread > 0 && (
        <span className="bell-badge">{unread > 99 ? "99+" : unread}</span>
      )}
    </button>
  );
}

// App shell: mobile (top header + bottom tab bar) / desktop (sidebar + top bar).
// Children = main content for the active tab.
export default function AppShell({
  tab,
  onTabChange,
  chatsBadge = 0,
  requestsBadge = 0,
  me,
  user,
  notifUnread = 0,
  onToggleNotifs,
  notifPanel,
  onNewMessage,
  onOpenMyProfile,
  onLogout,
  children,
}) {
  const isMobile = useIsMobile();
  const badgeFor = (id) =>
    id === "chats" ? chatsBadge : id === "requests" ? requestsBadge : 0;
  const displayUser = me || user;
  const noScroll = tab === "chats";

  if (isMobile) {
    return (
      <div className="app-shell">
        <ConnectionBanner />
        <header className="m-topbar">
          <span className="m-brand">Gupshup</span>
          <span className="m-title">{TAB_TITLES[tab] || ""}</span>
          <span style={{ position: "relative" }}>
            <BellButton unread={notifUnread} onToggle={onToggleNotifs} />
            {notifPanel}
          </span>
          <button
            className="icon-btn"
            onClick={onOpenMyProfile}
            aria-label="My profile"
            style={{ padding: 2 }}
          >
            <Avatar user={displayUser} size={32} />
          </button>
        </header>

        <main className={`app-main ${noScroll ? "no-scroll" : ""}`}>
          {children}
        </main>

        <nav className="m-tabbar">
          {TABS.map(({ id, label, Icon }) => {
            const b = badgeFor(id);
            return (
              <button
                key={id}
                className={`m-tab ${tab === id ? "active" : ""}`}
                onClick={() => onTabChange(id)}
              >
                <span className="m-tab-icon" style={{ position: "relative" }}>
                  <Icon width={22} height={22} />
                  {b > 0 && <span className="m-tab-badge">{b > 99 ? "99+" : b}</span>}
                </span>
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="d-shell" style={{ flex: 1, minHeight: 0 }}>
        <aside className="d-sidebar">
          <div className="d-brand">Gupshup</div>
          <nav className="d-nav">
            {TABS.map(({ id, label, Icon }) => {
              const b = badgeFor(id);
              return (
                <button
                  key={id}
                  className={`d-nav-item ${tab === id ? "active" : ""}`}
                  onClick={() => onTabChange(id)}
                >
                  <Icon width={20} height={20} />
                  {label}
                  {b > 0 && <span className="d-nav-badge">{b > 99 ? "99+" : b}</span>}
                </button>
              );
            })}
          </nav>
          <button className="d-user-drawer" onClick={onOpenMyProfile} title="My profile">
            <Avatar user={displayUser} size={38} />
            <span className="uinfo">
              <span className="uname ellipsis">{displayUser?.name}</span>
              <span className="usub">View profile</span>
            </span>
          </button>
          <button
            className="link"
            onClick={onLogout}
            style={{ marginTop: 10, alignSelf: "center" }}
          >
            Log out
          </button>
        </aside>

        <div className="d-main">
          <ConnectionBanner />
          <div className="d-topbar">
            <div className="spacer" />
            <button className="btn primary small" onClick={onNewMessage}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IconPlus width={15} height={15} /> New Message
              </span>
            </button>
            <span style={{ position: "relative" }}>
              <BellButton unread={notifUnread} onToggle={onToggleNotifs} />
              {notifPanel}
            </span>
            <button
              className="icon-btn"
              onClick={onOpenMyProfile}
              aria-label="My profile"
              style={{ padding: 2 }}
            >
              <Avatar user={displayUser} size={34} />
            </button>
          </div>
          <div className={`d-content ${noScroll ? "no-scroll" : ""}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
