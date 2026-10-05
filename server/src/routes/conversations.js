import { Router } from "express";
import Conversation from "../models/Conversation.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// GET /api/conversations — my chat list, newest first
router.get("/", authRequired, async (req, res) => {
  const convos = await Conversation.find({ participants: req.userId })
    .populate("participants", "name email avatar avatarColor")
    .populate({ path: "lastMessage", populate: { path: "sender", select: "name" } })
    .sort({ updatedAt: -1 });
  res.json(convos);
});

// POST /api/conversations — open (or create) a 1-to-1 chat
router.post("/", authRequired, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId required" });
  let convo = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [req.userId, userId], $size: 2 },
  }).populate("participants", "name email avatar avatarColor");
  if (!convo) {
    convo = await Conversation.create({ participants: [req.userId, userId] });
    convo = await convo.populate("participants", "name email avatar avatarColor");
  }
  res.status(201).json(convo);
});

// POST /api/conversations/group — create a group chat
router.post("/group", authRequired, async (req, res) => {
  const { name, userIds } = req.body;
  if (!name?.trim() || !userIds?.length)
    return res.status(400).json({ message: "Group name and members required" });
  const convo = await Conversation.create({
    name: name.trim(),
    isGroup: true,
    participants: [...new Set([req.userId, ...userIds])],
    admin: req.userId,
  });
  res.status(201).json(await convo.populate("participants", "name email avatar avatarColor"));
});

export default router;
