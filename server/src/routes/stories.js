import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import Story from "../models/Story.js";
import FriendRequest from "../models/FriendRequest.js";
import { authRequired } from "../middleware/auth.js";
import { getIO } from "../socket/index.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same uploads dir the chat-photo route writes to (served at /uploads/...)
const uploadDir = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 5);
    cb(null, `story-${req.userId}-${Date.now()}${ext}`);
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

// Accepted friends (either direction) — same logic as routes/feed.js
async function friendIdsOf(me) {
  const rels = await FriendRequest.find({
    $or: [{ from: me }, { to: me }],
    status: "accepted",
  }).select("from to");
  return rels.map((r) => (String(r.from) === String(me) ? r.to : r.from));
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

// POST /api/stories — new story (photo only, v1). 24h expiry.
router.post("/", authRequired, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      const caption = String(req.body.caption || "").slice(0, 100);
      const story = await Story.create({
        user: req.userId,
        image: `/uploads/${req.file.filename}`,
        caption,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      });
      const populated = await story.populate("user", "name avatar avatarColor");
      // Friends ko real-time batao
      const io = getIO();
      if (io) {
        const friends = await friendIdsOf(req.userId);
        friends.forEach((f) => io.to(`user:${f}`).emit("story-new", { story: populated }));
      }
      res.status(201).json(populated);
    } catch (e) {
      console.error("story create failed:", e.message);
      res.status(500).json({ message: "Story post nahi ho payi" });
    }
  });
});

// GET /api/stories — friends' + own UNEXPIRED stories, newest first
router.get("/", authRequired, async (req, res) => {
  const me = req.userId;
  const friends = await friendIdsOf(me);
  const authors = [me, ...friends];
  const now = new Date();
  const stories = await Story.find({ user: { $in: authors }, expiresAt: { $gt: now } })
    .populate("user", "name avatar avatarColor")
    .populate("viewers", "name avatar avatarColor")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(
    stories.map((s) => {
      const mine = String(s.user._id) === String(me);
      return {
        _id: s._id,
        user: s.user,
        image: s.image,
        caption: s.caption,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        viewersCount: s.viewers.length,
        // Viewers list sirf apni story par dikhao (privacy)
        viewers: mine ? s.viewers : undefined,
        viewedByMe: s.viewers.map((v) => String(v._id)).includes(String(me)),
      };
    })
  );
});

// POST /api/stories/:id/view — mark as viewed (only if visible to me)
router.post("/:id/view", authRequired, async (req, res) => {
  const me = req.userId;
  const story = await Story.findById(req.params.id);
  if (!story || story.expiresAt <= new Date())
    return res.status(404).json({ message: "Story nahi mili" });
  const friends = await friendIdsOf(me);
  const visible =
    String(story.user) === String(me) ||
    friends.map(String).includes(String(story.user));
  if (!visible) return res.status(403).json({ message: "Not allowed" });
  await Story.updateOne({ _id: story._id }, { $addToSet: { viewers: me } });
  const io = getIO();
  if (io) {
    io.to(`user:${story.user}`).emit("story-viewed", {
      storyId: String(story._id),
      viewedBy: String(me),
    });
  }
  res.json({ ok: true });
});

// DELETE /api/stories/:id — owner only (image file bhi delete karo)
router.delete("/:id", authRequired, async (req, res) => {
  const story = await Story.findById(req.params.id);
  if (!story) return res.status(404).json({ message: "Story nahi mili" });
  if (String(story.user) !== String(req.userId))
    return res.status(403).json({ message: "Not allowed" });
  if (story.image?.startsWith("/uploads/")) {
    try {
      fs.unlinkSync(path.join(uploadDir, path.basename(story.image)));
    } catch {
      /* ignore */
    }
  }
  await Story.deleteOne({ _id: story._id });
  res.json({ ok: true });
});

export default router;
