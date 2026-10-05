import express from "express";
import { authRequired as auth } from "../middleware/auth.js";
import FriendRequest from "../models/FriendRequest.js";
import Post from "../models/Post.js";
import Note from "../models/Note.js";

const router = express.Router();

// GET /api/feed — FB/Insta style home feed: friends' + own photo posts,
// plus public notes, newest first.
router.get("/", auth, async (req, res) => {
  const me = req.userId;

  // My friends (accepted requests, either direction) + myself
  const rels = await FriendRequest.find({
    $or: [{ from: me }, { to: me }],
    status: "accepted",
  }).select("from to");
  const friendIds = rels.map((r) =>
    String(r.from) === String(me) ? r.to : r.from
  );
  const postAuthors = [me, ...friendIds];

  const [posts, notes] = await Promise.all([
    Post.find({ user: { $in: postAuthors } })
      .populate("user", "name avatar avatarColor")
      .sort({ createdAt: -1 })
      .limit(30),
    Note.find()
      .populate("user", "name avatar avatarColor")
      .sort({ createdAt: -1 })
      .limit(30),
  ]);

  const items = [
    ...posts.map((p) => ({
      kind: "post",
      _id: p._id,
      user: p.user,
      image: p.image,
      caption: p.caption,
      likesCount: p.likes.length,
      likedByMe: p.likes.map(String).includes(String(me)),
      createdAt: p.createdAt,
    })),
    ...notes.map((n) => ({
      kind: "note",
      _id: n._id,
      user: n.user,
      text: n.text,
      likesCount: n.likes.length,
      likedByMe: n.likes.map(String).includes(String(me)),
      createdAt: n.createdAt,
    })),
  ];

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items.slice(0, 50));
});

export default router;
