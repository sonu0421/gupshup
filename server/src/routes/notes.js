import express from "express";
import { authRequired as auth } from "../middleware/auth.js";
import Note from "../models/Note.js";
import Notification from "../models/Notification.js";
import { getIO } from "../socket/index.js";

const router = express.Router();

const shape = (n, meId) => ({
  _id: n._id,
  user: n.user,
  text: n.text,
  likesCount: n.likes.length,
  likedByMe: n.likes.map(String).includes(String(meId)),
  createdAt: n.createdAt,
});

// GET /api/notes/feed — latest notes from everyone (public thoughts)
router.get("/feed", auth, async (req, res) => {
  const notes = await Note.find()
    .populate("user", "name avatar avatarColor")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notes.map((n) => shape(n, req.userId)));
});

// GET /api/notes/user/:userId — one user's notes (for their profile page)
router.get("/user/:userId", auth, async (req, res) => {
  const notes = await Note.find({ user: req.params.userId })
    .populate("user", "name avatar avatarColor")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notes.map((n) => shape(n, req.userId)));
});

// POST /api/notes — share a thought
router.post("/", auth, async (req, res) => {
  const text = String(req.body.text || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ message: "Note khaali nahi ho sakta" });
  const note = await Note.create({ user: req.userId, text });
  await note.populate("user", "name avatar avatarColor");
  res.status(201).json(shape(note, req.userId));
});

// POST /api/notes/:id/like — toggle like
router.post("/:id/like", auth, async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ message: "Note not found" });
  const me = String(req.userId);
  const idx = note.likes.map(String).indexOf(me);
  if (idx >= 0) note.likes.splice(idx, 1);
  else {
    note.likes.push(req.userId);
    if (String(note.user) !== me) {
      const notif = await Notification.create({
        recipient: note.user,
        type: "note-like",
        actor: req.userId,
        refId: note._id,
      });
      await notif.populate("actor", "name avatar avatarColor");
      getIO()?.to(`user:${note.user}`).emit("notification", notif);
    }
  }
  await note.save();
  res.json({ likesCount: note.likes.length, likedByMe: idx < 0 });
});

// DELETE /api/notes/:id — delete own note
router.delete("/:id", auth, async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ message: "Note not found" });
  if (String(note.user) !== String(req.userId))
    return res.status(403).json({ message: "Not your note" });
  await note.deleteOne();
  res.json({ ok: true });
});

export default router;
