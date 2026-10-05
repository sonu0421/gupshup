import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authRequired as auth } from "../middleware/auth.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import Notification from "../models/Notification.js";
import { getIO } from "../socket/index.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 5);
    cb(null, `post-${req.userId}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// Can the requester view this user's posts?
async function canViewPosts(viewerId, target) {
  if (String(viewerId) === String(target._id)) return true;
  if (!target.isPrivate) return true;
  const rel = await FriendRequest.findOne({
    $or: [
      { from: viewerId, to: target._id },
      { from: target._id, to: viewerId },
    ],
    status: "accepted",
  });
  return !!rel;
}

// GET /api/posts/user/:userId — posts with like info (privacy enforced)
router.get("/user/:userId", auth, async (req, res) => {
  const target = await User.findById(req.params.userId).select("_id isPrivate");
  if (!target) return res.status(404).json({ message: "User not found" });
  if (!(await canViewPosts(req.userId, target)))
    return res.status(403).json({ message: "Private account — posts sirf friends dekh sakte hain" });
  const posts = await Post.find({ user: target._id })
    .populate("user", "name avatar avatarColor")
    .sort({ createdAt: -1 });
  res.json(
    posts.map((p) => ({
      _id: p._id,
      user: p.user,
      image: p.image,
      caption: p.caption,
      likesCount: p.likes.length,
      likedByMe: p.likes.map(String).includes(String(req.userId)),
      createdAt: p.createdAt,
    }))
  );
});

// POST /api/posts — upload a photo with a caption
router.post("/", auth, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });
    const post = await Post.create({
      user: req.userId,
      image: `/uploads/${req.file.filename}`,
      caption: String(req.body.caption || "").slice(0, 300),
    });
    await post.populate("user", "name avatar avatarColor");
    res.status(201).json(post);
  });
});

// POST /api/posts/:id/like — toggle like
router.post("/:id/like", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });
  const me = String(req.userId);
  const idx = post.likes.map(String).indexOf(me);
  if (idx >= 0) post.likes.splice(idx, 1);
  else {
    post.likes.push(req.userId);
    // Notify the post owner (not for self-likes)
    if (String(post.user) !== me) {
      const notif = await Notification.create({
        recipient: post.user,
        type: "post-like",
        actor: req.userId,
        refId: post._id,
      });
      await notif.populate("actor", "name avatar avatarColor");
      getIO()?.to(`user:${post.user}`).emit("notification", notif);
    }
  }
  await post.save();
  res.json({ likesCount: post.likes.length, likedByMe: idx < 0 });
});

// DELETE /api/posts/:id — delete own post
router.delete("/:id", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });
  if (String(post.user) !== String(req.userId))
    return res.status(403).json({ message: "Not your post" });
  try {
    fs.unlinkSync(path.join(uploadDir, path.basename(post.image)));
  } catch {
    /* file already gone */
  }
  await post.deleteOne();
  res.json({ ok: true });
});

export default router;
