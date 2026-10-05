import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authRequired as auth } from "../middleware/auth.js";
import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Profile photo uploads (stored on disk, served at /uploads/...) ----
const uploadDir = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 5);
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const PUBLIC_FIELDS = "name email avatar avatarColor bio isPrivate createdAt";

// Discover: all users (except me) with my friendship status toward each
router.get("/", auth, async (req, res) => {
  const me = req.userId;
  const users = await User.find({ _id: { $ne: me } })
    .select(PUBLIC_FIELDS)
    .sort({ createdAt: -1 });
  const rels = await FriendRequest.find({
    $or: [{ from: me }, { to: me }],
    status: { $in: ["pending", "accepted"] },
  });
  const statusOf = {};
  const requestIdOf = {};
  for (const r of rels) {
    const other = String(r.from) === String(me) ? String(r.to) : String(r.from);
    statusOf[other] =
      r.status === "accepted"
        ? "friends"
        : String(r.from) === String(me)
          ? "pending-sent"
          : "pending-received";
    if (r.status === "pending") requestIdOf[other] = String(r._id);
  }
  res.json(
    users.map((u) => ({
      ...u.toObject(),
      friendStatus: statusOf[String(u._id)] || "none",
      friendRequestId: requestIdOf[String(u._id)] || null,
    }))
  );
});

// My own profile
router.get("/me", auth, async (req, res) => {
  const u = await User.findById(req.userId).select("-password");
  if (!u) return res.status(404).json({ message: "User not found" });
  res.json(u);
});

// Public profile + friend count
router.get("/:id", auth, async (req, res) => {
  const u = await User.findById(req.params.id).select(PUBLIC_FIELDS);
  if (!u) return res.status(404).json({ message: "User not found" });
  const friendsCount = await FriendRequest.countDocuments({
    $or: [{ from: u._id }, { to: u._id }],
    status: "accepted",
  });
  res.json({ ...u.toObject(), friendsCount });
});

// Edit my profile: bio, emoji avatar, avatar color, private toggle
router.put("/me", auth, async (req, res) => {
  const { bio, avatar, avatarColor, isPrivate } = req.body;
  const u = await User.findById(req.userId);
  if (!u) return res.status(404).json({ message: "User not found" });
  if (bio !== undefined) u.bio = String(bio).slice(0, 160);
  if (avatar !== undefined) u.avatar = String(avatar).slice(0, 200);
  if (avatarColor !== undefined) u.avatarColor = String(avatarColor).slice(0, 20);
  if (isPrivate !== undefined) u.isPrivate = !!isPrivate;
  await u.save();
  res.json({
    _id: u._id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    avatarColor: u.avatarColor,
    bio: u.bio,
    isPrivate: u.isPrivate,
  });
});

// Upload a profile photo
router.post("/me/avatar", auth, (req, res) => {
  upload.single("avatar")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const u = await User.findById(req.userId);
    u.avatar = `/uploads/${req.file.filename}`;
    await u.save();
    res.json({ avatar: u.avatar });
  });
});

export default router;
