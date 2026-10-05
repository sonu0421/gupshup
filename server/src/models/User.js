import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6 }, // optional for Google-only users
    // Google OAuth: linked Google account id (null for email+password users)
    googleId: { type: String, sparse: true, unique: true },
    // Profile: avatar is an emoji OR "/uploads/..." photo path; "" = initial letter
    avatar: { type: String, default: "" },
    avatarColor: { type: String, default: "#e8b04b" },
    bio: { type: String, default: "", maxlength: 160 },
    // Private profile: only friends can see posts (name/avatar/bio stay visible)
    isPrivate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
