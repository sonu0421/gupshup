import express from "express";
import { authRequired as auth } from "../middleware/auth.js";
import FriendRequest from "../models/FriendRequest.js";
import Conversation from "../models/Conversation.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIO } from "../socket/index.js";

const router = express.Router();
const FRIEND_FIELDS = "name email avatar avatarColor bio";

// My friends list
router.get("/", auth, async (req, res) => {
  const me = req.userId;
  const rels = await FriendRequest.find({
    $or: [{ from: me }, { to: me }],
    status: "accepted",
  }).populate("from to", FRIEND_FIELDS);
  res.json(rels.map((r) => (String(r.from._id) === String(me) ? r.to : r.from)));
});

// Incoming pending requests
router.get("/requests", auth, async (req, res) => {
  const reqs = await FriendRequest.find({ to: req.userId, status: "pending" })
    .populate("from", FRIEND_FIELDS)
    .sort({ createdAt: -1 });
  res.json(reqs);
});

// Send a friend request
router.post("/request/:userId", auth, async (req, res) => {
  const me = req.userId;
  const other = req.params.userId;
  if (String(other) === String(me))
    return res.status(400).json({ message: "You cannot add yourself" });
  const target = await User.findById(other).select("_id");
  if (!target) return res.status(404).json({ message: "User not found" });
  const existing = await FriendRequest.findOne({
    $or: [
      { from: me, to: other },
      { from: other, to: me },
    ],
    status: { $in: ["pending", "accepted"] },
  });
  if (existing) return res.status(400).json({ message: "Request already exists" });

  const fr = await FriendRequest.create({ from: me, to: other });
  await fr.populate("from", FRIEND_FIELDS);
  const io = getIO();
  io?.to(`user:${other}`).emit("friend-request", fr);
  // Notification center entry
  const notif = await Notification.create({
    recipient: other,
    type: "friend-request",
    actor: me,
    refId: fr._id,
  });
  await notif.populate("actor", "name avatar avatarColor");
  io?.to(`user:${other}`).emit("notification", notif);
  res.status(201).json(fr);
});

// Accept a request (only the recipient) — also opens a 1-to-1 chat for both
router.post("/accept/:requestId", auth, async (req, res) => {
  const fr = await FriendRequest.findById(req.params.requestId);
  if (!fr || String(fr.to) !== String(req.userId) || fr.status !== "pending")
    return res.status(404).json({ message: "Request not found" });
  fr.status = "accepted";
  await fr.save();
  await fr.populate("from to", FRIEND_FIELDS);

  // Auto-create the 1-to-1 conversation so chat appears for both users
  const [a, b] = [fr.from._id, fr.to._id];
  let convo = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [a, b], $size: 2 },
  });
  if (!convo) convo = await Conversation.create({ participants: [a, b] });

  const io = getIO();
  io?.to(`user:${a}`).to(`user:${b}`).emit("friend-accepted", fr);
  // Nudge both sidebars to reload so the new chat shows up instantly
  io?.to(`user:${a}`).to(`user:${b}`).emit("conversation-updated", {
    conversationId: String(convo._id),
  });
  // Notification center entry for the requester
  const notif = await Notification.create({
    recipient: a,
    type: "friend-accepted",
    actor: b,
    refId: fr._id,
  });
  await notif.populate("actor", "name avatar avatarColor");
  io?.to(`user:${a}`).emit("notification", notif);
  res.json(fr);
});

// Reject a request (only the recipient)
router.post("/reject/:requestId", auth, async (req, res) => {
  const fr = await FriendRequest.findById(req.params.requestId);
  if (!fr || String(fr.to) !== String(req.userId) || fr.status !== "pending")
    return res.status(404).json({ message: "Request not found" });
  await fr.deleteOne();
  res.json({ ok: true });
});

// Unfriend
router.delete("/:userId", auth, async (req, res) => {
  const me = req.userId;
  await FriendRequest.deleteOne({
    $or: [
      { from: me, to: req.params.userId },
      { from: req.params.userId, to: me },
    ],
    status: "accepted",
  });
  res.json({ ok: true });
});

export default router;
