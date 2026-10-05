// Renders a user avatar: uploaded photo, emoji, or initial letter.
export default function Avatar({ user, size = 40 }) {
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  if (user?.avatar?.startsWith("/uploads/") || user?.avatar?.startsWith("http")) {
    return <img className="avatar avatar-img" src={user.avatar} style={dim} alt={user.name} />;
  }
  if (user?.avatar) {
    return (
      <span className="avatar avatar-emoji" style={dim}>
        {user.avatar}
      </span>
    );
  }
  return (
    <span
      className="avatar avatar-initial"
      style={{ ...dim, background: user?.avatarColor || "#635BFF" }}
    >
      {(user?.name || "?")[0].toUpperCase()}
    </span>
  );
}
