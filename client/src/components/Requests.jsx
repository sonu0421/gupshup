import Avatar from "./Avatar.jsx";

// Incoming friend requests with Accept / Reject.
export default function Requests({ requests, onAccept, onReject, onViewProfile }) {
  return (
    <div>
      {requests.length === 0 && (
        <p className="muted small empty-note">Koi pending request nahi hai.</p>
      )}
      {requests.map((r) => (
        <div key={r._id} className="req-card">
          <button className="person-id" onClick={() => onViewProfile(r.from)}>
            <Avatar user={r.from} size={44} />
            <span className="person-meta">
              <span className="person-name">{r.from.name}</span>
              <span className="muted small">tumhe friend banana chahta hai</span>
            </span>
          </button>
          <span className="person-action req-actions">
            <button className="btn small primary" onClick={() => onAccept(r._id)}>
              Accept
            </button>
            <button className="btn small" onClick={() => onReject(r._id)}>
              Reject
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
