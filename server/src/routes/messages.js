import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chat photo uploads (stored on disk, served at /uploads/...)
const uploadDir = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 5);
    cb(null, `msg-${req.userId}-${Date.now()}${ext}`);
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

// POST /api/messages/upload — upload a chat photo, returns { url }
router.post("/upload", authRequired, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// GET /api/messages/:conversationId — chat history (only for participants)
router.get("/:conversationId", authRequired, async (req, res) => {
  const convo = await Conversation.findById(req.params.conversationId);
  if (!convo || !convo.participants.map(String).includes(req.userId))
    return res.status(403).json({ message: "Not allowed" });
  const messages = await Message.find({ conversation: req.params.conversationId })
    .populate("sender", "name email")
    .sort({ createdAt: 1 })
    .limit(300);
  res.json(messages);
});

export default router;
