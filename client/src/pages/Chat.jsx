import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getSocket, disconnectSocket, onConnectionChange } from "../socket.js";
import api from "../api.js";
import AppShell, { useIsMobile } from "../components/AppShell.jsx";
import PullToRefresh from "../components/PullToRefresh.jsx";
import ChatList from "../components/ChatList.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import Home from "../components/Home.jsx";
import Discover from "../components/Discover.jsx";
import Requests from "../components/Requests.jsx";
import ProfileModal from "../components/ProfileModal.jsx";
import ProfilePage from "../components/ProfilePage.jsx";
import NotificationsPanel from "../components/NotificationsPanel.jsx";
import NewMessageModal from "../components/NewMessageModal.jsx";
import { playPing } from "../utils.js";

export default function Chat() {
  const { user, logout, updateUser } = useAuth();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unread, setUnread] = useState({}); // convoId -> unread count

  // Social: discover / friend requests / profile
  const [tab, setTab] = useState("home");
  const [people, setPeople] = useState([]);
  const [requests, setRequests] = useState([]);
  const [me, setMe] = useState(null); // my full profile (avatar, bio)
  const [profileId, setProfileId] = useState(null); // overlay profile dashboard
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0); // force ProfilePage reload after edit
  const [showNewMsg, setShowNewMsg] = useState(false);

  // Notification center
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  // Dismissible system banners
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;
  const openConvoRef = useRef(null);

  const activeConvo = conversations.find((c) => c._id === activeId) || null;
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  const openConvo = (id) => {
    setActiveId(id);
    setProfileId(null);
    setUnread((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  openConvoRef.current = openConvo;

  const openProfile = (userId) => {
    setProfileId(userId);
  };

  const handleTabChange = (t) => {
    setTab(t);
    setProfileId(null);
    if (t !== "chats") setActiveId(null);
  };

  const refreshSocial = () => {
    api.get("/users").then((res) => setPeople(res.data)).catch(() => {});
    api.get("/friends/requests").then((res) => setRequests(res.data)).catch(() => {});
    api.get("/users/me").then((res) => setMe(res.data)).catch(() => {});
    api.get("/notifications").then((res) => {
      setNotifications(res.data.notifications);
      setNotifUnread(res.data.unreadCount);
    }).catch(() => {});
  };

  // Tab title shows total unread count
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Gupshup` : "Gupshup — Real-time Chat";
  }, [totalUnread]);

  useEffect(() => {
    const socket = getSocket();

    const load = () =>
      api.get("/conversations").then((res) => setConversations(res.data)).catch(() => {});
    load();
    refreshSocial();

    const onOnline = (ids) => setOnlineUsers(ids.map(String));

    const onUpdated = ({ conversationId, message }) => {
      load();
      if (!message || String(message.sender?._id || message.sender) === String(user._id)) return;
      if (String(conversationId) === String(activeIdRef.current)) return;

      setUnread((prev) => ({ ...prev, [conversationId]: (prev[conversationId] || 0) + 1 }));
      playPing();

      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        const n = new Notification(message.sender?.name || "Gupshup", {
          body: message.text || (message.image ? "📷 Photo" : "New message"),
        });
        n.onclick = () => {
          window.focus();
          openConvoRef.current(conversationId);
        };
      }
    };

    const onFriendRequest = (fr) => {
      setRequests((prev) => (prev.some((r) => r._id === fr._id) ? prev : [fr, ...prev]));
      playPing();
      refreshSocial();
    };

    const onFriendAccepted = () => {
      playPing();
      refreshSocial();
    };

    const onNotification = (n) => {
      setNotifications((prev) => (prev.some((x) => x._id === n._id) ? prev : [n, ...prev]));
      setNotifUnread((c) => c + 1);
      playPing();
    };

    // Naya user register kare to Discover list turant update ho
    const onUserJoined = () => {
      api.get("/users").then((res) => setPeople(res.data)).catch(() => {});
    };

    // Kisi ne DP/bio badli → Discover, Chat list, sab jagah turant update karo
    const onProfileUpdated = ({ userId, name, avatar, avatarColor, bio }) => {
      const uid = String(userId);
      setPeople((prev) =>
        prev.map((p) => (String(p._id) === uid ? { ...p, name, avatar, avatarColor, bio } : p))
      );
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: (c.participants || []).map((pt) => {
            const pid = String(pt._id || pt);
            return pid === uid ? { ...pt, name, avatar, avatarColor } : pt;
          }),
        }))
      );
      // Apni khud ki DP ho to header/composer bhi turant update karo
      if (uid === String(user._id)) {
        updateUser({ name, avatar, avatarColor, bio });
        setMe((prev) => (prev ? { ...prev, name, avatar, avatarColor, bio } : prev));
      }
    };

    socket.on("online-users", onOnline);
    socket.on("conversation-updated", onUpdated);
    socket.on("friend-request", onFriendRequest);
    socket.on("friend-accepted", onFriendAccepted);
    socket.on("notification", onNotification);
    socket.on("user-joined", onUserJoined);
    socket.on("profile-updated", onProfileUpdated);
    // Reconnected after a drop → re-fetch so nothing sent in-between is missed
    const onReconnect = () => {
      load();
      refreshSocial();
    };
    const unsubConn = onConnectionChange((s) => {
      if (s === "connected") onReconnect();
    });
    return () => {
      socket.off("online-users", onOnline);
      socket.off("conversation-updated", onUpdated);
      socket.off("friend-request", onFriendRequest);
      socket.off("friend-accepted", onFriendAccepted);
      socket.off("notification", onNotification);
      socket.off("user-joined", onUserJoined);
      socket.off("profile-updated", onProfileUpdated);
      unsubConn();
      disconnectSocket();
    };
  }, [user._id]);

  // --- Social actions ---
  const sendRequest = async (userId) => {
    try {
      await api.post(`/friends/request/${userId}`);
      refreshSocial();
    } catch (e) {
      alert(e.response?.data?.message || "Request nahi bhej paye");
    }
  };

  const acceptRequest = async (requestId) => {
    await api.post(`/friends/accept/${requestId}`);
    refreshSocial();
  };

  const rejectRequest = async (requestId) => {
    await api.post(`/friends/reject/${requestId}`);
    refreshSocial();
  };

  const openDirectChat = async (userId) => {
    const { data: convo } = await api.post("/conversations", { userId });
    setConversations((prev) =>
      prev.some((c) => c._id === convo._id) ? prev : [convo, ...prev]
    );
    setTab("chats");
    setProfileId(null);
    openConvo(convo._id);
  };

  const saveProfile = (updated) => {
    setMe(updated);
    updateUser({ avatar: updated.avatar, avatarColor: updated.avatarColor, bio: updated.bio });
    setEditingProfile(false);
    setProfileRefreshKey((k) => k + 1); // ProfilePage turant nayi DP dikhaye
    refreshSocial();
  };

  // --- Notification center ---
  const toggleNotifs = async () => {
    const next = !showNotifs;
    setShowNotifs(next);
    if (next && notifUnread > 0) {
      try {
        await api.post("/notifications/read");
      } catch {
        /* ignore */
      }
      setNotifUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const handleNotifClick = (n) => {
    setShowNotifs(false);
    if (n.type === "friend-request") {
      handleTabChange("requests");
    } else if (n.type === "friend-accepted") {
      setProfileId(n.actor?._id);
    } else {
      setProfileId(user._id);
    }
  };

  const enableBrowserNotifs = async () => {
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
    } catch {
      /* ignore */
    }
  };

  // --- Render pieces ---
  const refreshConvos = () =>
    api.get("/conversations").then((res) => setConversations(res.data)).catch(() => {});
  // Chat delete (sirf apne liye) — list se turant hatao
  const deleteChat = async (convoId) => {
    try {
      await api.delete(`/conversations/${convoId}`);
    } catch {
      /* ignore — phir bhi list se hatao */
    }
    setConversations((prev) => prev.filter((c) => c._id !== convoId));
    setActiveId(null);
  };

  const chatList = (
    <PullToRefresh onRefresh={refreshConvos} className="fill">
      <ChatList
      conversations={conversations}
      activeId={activeId}
      onSelect={openConvo}
      onNewConvo={(convo) => {
        setConversations((prev) =>
          prev.some((c) => c._id === convo._id) ? prev : [convo, ...prev]
        );
        openConvo(convo._id);
      }}
      onlineUsers={onlineUsers}
      unread={unread}
      people={people}
      onViewProfile={openProfile}
      onDeleteChat={deleteChat}
    />
    </PullToRefresh>
  );

  const thread = (
    <ChatWindow
      convo={activeConvo}
      onlineUsers={onlineUsers}
      onBack={() => setActiveId(null)}
      onViewProfile={openProfile}
      onDeleteChat={deleteChat}
    />
  );

  const notifPanel = showNotifs ? (
    <NotificationsPanel
      notifications={notifications}
      onClose={() => setShowNotifs(false)}
      onItemClick={handleNotifClick}
    />
  ) : null;

  return (
    <>
      <AppShell
        tab={tab}
        onTabChange={handleTabChange}
        chatsBadge={totalUnread}
        requestsBadge={requests.length}
        me={me}
        user={user}
        notifUnread={notifUnread}
        onToggleNotifs={toggleNotifs}
        notifPanel={notifPanel}
        onNewMessage={() => setShowNewMsg(true)}
        onOpenMyProfile={() => handleTabChange("profile")}
        onLogout={logout}
      >
        {notifPerm === "default" && (
          <div style={{ padding: isMobile ? "12px 14px 0" : "16px 24px 0", maxWidth: 640, margin: "0 auto", width: "100%" }}>
            <button className="notif-banner" style={{ margin: 0, width: "100%" }} onClick={enableBrowserNotifs}>
              🔔 Notifications on karo — naye message ka alert milega
            </button>
          </div>
        )}

        {tab === "home" && (
          <div className="page">
            <div className="greet">
              <h2>
                {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"},{" "}
                {(me?.name || user.name)?.split(" ")[0]} 👋
              </h2>
              <p>Here's what's happening in your circles today.</p>
            </div>
            <Home onViewProfile={openProfile} />
          </div>
        )}

        {tab === "chats" &&
          (isMobile ? (
            chatList
          ) : (
            <div className="chats-dual">
              {chatList}
              {thread}
            </div>
          ))}

        {tab === "discover" && (
          <div className="page wide">
            <div className="greet">
              <h2>Discover people</h2>
              <p>Grow your network — find creators, engineers and friends.</p>
            </div>
            <PullToRefresh onRefresh={async () => { refreshSocial(); }}>
              <Discover
                users={people}
                onViewProfile={(u) => openProfile(u._id)}
                onSendRequest={sendRequest}
                onAccept={acceptRequest}
                onReject={rejectRequest}
                onMessage={openDirectChat}
              />
            </PullToRefresh>
          </div>
        )}

        {tab === "requests" && (
          <div className="page">
            <div className="greet">
              <h2>Friend requests</h2>
              <p>{requests.length === 0 ? "You're all caught up! ✨" : `${requests.length} request${requests.length === 1 ? "" : "s"} waiting for you`}</p>
            </div>
            <PullToRefresh onRefresh={async () => { refreshSocial(); }}>
              <Requests
                requests={requests}
                onAccept={acceptRequest}
                onReject={rejectRequest}
                onViewProfile={(u) => openProfile(u._id || u)}
              />
            </PullToRefresh>
          </div>
        )}

        {tab === "profile" && (
          <div className="page" style={{ maxWidth: 680 }}>
            <ProfilePage
              key={`profile-${profileRefreshKey}`}
              userId={user._id}
              currentUserId={user._id}
              onEdit={() => me && setEditingProfile(true)}
              onSendRequest={sendRequest}
              onMessage={openDirectChat}
              onGoRequests={() => handleTabChange("requests")}
              onLogout={logout}
              onUnfriend={() => refreshSocial()}
              onViewProfile={openProfile}
            />
          </div>
        )}
      </AppShell>

      {/* Mobile: thread as full-screen overlay */}
      {isMobile && tab === "chats" && activeConvo && (
        <div className="m-thread">{thread}</div>
      )}

      {/* Overlay: viewing someone's profile */}
      {profileId && (
        <div
          className="profile-overlay"
          onClick={(e) => {
            if (e.target.classList.contains("profile-overlay")) setProfileId(null);
          }}
        >
          <div className="profile-sheet">
            <ProfilePage
              userId={profileId}
              currentUserId={user._id}
              onBack={() => setProfileId(null)}
              onEdit={() => setEditingProfile(true)}
              onSendRequest={sendRequest}
              onMessage={(id) => {
                setProfileId(null);
                openDirectChat(id);
              }}
              onGoRequests={() => {
                setProfileId(null);
                handleTabChange("requests");
              }}
              onUnfriend={() => refreshSocial()}
              onViewProfile={openProfile}
            />
          </div>
        </div>
      )}

      {showNewMsg && (
        <NewMessageModal
          people={people}
          onClose={() => setShowNewMsg(false)}
          onSelect={(id) => {
            setShowNewMsg(false);
            openDirectChat(id);
          }}
        />
      )}

      {editingProfile && me && (
        <ProfileModal user={me} onClose={() => setEditingProfile(false)} onSave={saveProfile} />
      )}
    </>
  );
}
