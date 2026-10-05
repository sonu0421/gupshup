import Avatar from "./Avatar.jsx";
import { IconUserPlus, IconChat } from "./icons.jsx";

// "Discover people" — every registered user with a clear action based on friendship status.
export default function Discover({ users, onViewProfile, onSendRequest, onAccept, onReject, onMessage }) {
  return (
    <div className="discover">
      {users.length === 0 && (
        <p className="muted small empty-note">Abhi koi aur user register nahi hua. Pehle bano!</p>
      )}
      {users.map((u) => (
        <div key={u._id} className="person-row">
          <button className="person-id" onClick={() => onViewProfile(u)}>
            <Avatar user={u} size={44} />
            <span className="person-meta">
              <span className="person-name">{u.name}</span>
              <span className="muted small ellipsis">{u.bio || "Hey, I'm on Gupshup!"}</span>
            </span>
          </button>
          <span className="person-action">
            {u.friendStatus === "none" && (
              <button className="btn small primary add-friend-btn" onClick={() => onSendRequest(u._id)}>
                <IconUserPlus width={15} height={15} /> Add Friend
              </button>
            )}
            {u.friendStatus === "pending-sent" && (
              <span className="req-sent">Request sent ✓</span>
            )}
            {u.friendStatus === "pending-received" && u.friendRequestId && (
              <span className="req-inline">
                <button className="btn small primary" onClick={() => onAccept(u.friendRequestId)}>
                  Accept
                </button>
                <button className="btn small" onClick={() => onReject(u.friendRequestId)}>
                  Decline
                </button>
              </span>
            )}
            {u.friendStatus === "friends" && (
              <button className="btn small primary" onClick={() => onMessage(u._id)}>
                <IconChat width={15} height={15} /> Message
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
