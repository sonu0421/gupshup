import express from "express";
import { authRequired as auth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// GET /api/notifications — my latest + unread count
router.get("/", auth, async (req, res) => {
  const notifications = await Notification.find({ recipient: req.userId })
    .populate("actor", "name avatar avatarColor")
    .sort({ createdAt: -1 })
    .limit(30);
  const unreadCount = await Notification.countDocuments({
    recipient: req.userId,
    read: false,
  });
  res.json({ notifications, unreadCount });
});

// POST /api/notifications/read — mark all as read
router.post("/read", auth, async (req, res) => {
  await Notification.updateMany(
    { recipient: req.userId, read: false },
    { $set: { read: true } }
  );
  res.json({ ok: true });
});

export default router;
