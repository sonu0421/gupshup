import mongoose from "mongoose";

// 24-hour ephemeral stories (IG/WhatsApp style), friends-only visibility.
// Images live in /uploads (same as chat photos/posts) — NOTE: Render's free
// tier wipes /uploads on every redeploy, so stories can vanish early there.
const storySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    image: { type: String, required: true }, // "/uploads/..." path
    caption: { type: String, default: "", maxlength: 100, trim: true },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Mongo TTL index auto-deletes the doc once this passes
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Story", storySchema);
