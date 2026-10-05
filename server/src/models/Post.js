import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    image: { type: String, required: true }, // "/uploads/..." path
    caption: { type: String, default: "", maxlength: 300 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

postSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Post", postSchema);
