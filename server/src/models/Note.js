import mongoose from "mongoose";

// Short text notes / thoughts for the Home feed ("apne pasand ki notes")
const noteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 500, trim: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

noteSchema.index({ createdAt: -1 });

export default mongoose.model("Note", noteSchema);
