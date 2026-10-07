import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "", trim: true },
    image: { type: String, default: null }, // /uploads/... path for photo messages
    // Users who have read this message (drives the blue ✓✓ seen ticks)
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Quoted message for reply (null = not a reply)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // Emoji reactions: one entry per user (toggle semantics enforced in socket handler)
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        emoji: { type: String, required: true, maxlength: 8 },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
