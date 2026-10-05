import { Router } from "express";
import Conversation from "../models/Conversation.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// GET /api/conversations — my chat list, newest first (deleted/hidden chats excluded)
router.get("/", authRequired, async (req, res) => {
  const convos = await Conversation.find({
    participants: req.userId,
    hiddenFor: { $ne: req.userId },
  })
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

// DELETE /api/conversations/:id — "Delete chat" (sirf apne liye).
// Dusre participant ki list me chat bani rahegi. Naya message aate hi
// ye chat aapki list me wapas aa jayegi (WhatsApp jaisa).
router.delete("/:id", authRequired, async (req, res) => {
  const convo = await Conversation.findOne({
    _id: req.params.id,
    participants: req.userId,
  });
  if (!convo) return res.status(404).json({ message: "Chat nahi mili" });
  await Conversation.findByIdAndUpdate(req.params.id, {
    $addToSet: { hiddenFor: req.userId },
  });
  res.json({ ok: true });
});

export default router;
