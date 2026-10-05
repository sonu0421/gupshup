import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" }, // group name (empty for 1-to-1)
    isGroup: { type: Boolean, default: false },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    // "Delete chat" (sirf apne liye): ye users apni list me ye chat nahi dekhenge.
    // Naya message aate hi wapas dikhne lagegi.
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
