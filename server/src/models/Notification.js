import mongoose from "mongoose";

// In-app notification center entries (bell icon)
const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["friend-request", "friend-accepted", "post-like", "note-like"],
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    refId: { type: mongoose.Schema.Types.ObjectId }, // post / note / request id
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
