import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import jwt from "jsonwebtoken";

// Tracks who is currently online: userId -> Set of socketIds
// (Set isliye taaki ek user phone+laptop dono par ho to ek ke band hone
// par dusra abhi bhi online dikhe)
const onlineUsers = new Map();

// The io instance, so REST routes can emit real-time events (friend requests, …)
let ioRef = null;
export function getIO() {
  return ioRef;
}

export function initSocket(io) {
  ioRef = io;

  // SECURITY: verify the JWT on every socket handshake.
  // Previously the client sent a raw userId which anyone could spoof —
  // now the identity comes from the signed token only.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(payload.id);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    if (!userId) {
      socket.disconnect();
      return;
    }

    // Mark user online, join their personal room
    if (!onlineUsers.has(String(userId))) onlineUsers.set(String(userId), new Set());
    onlineUsers.get(String(userId)).add(socket.id);
    socket.join(`user:${userId}`);
    io.emit("online-users", [...onlineUsers.keys()]);

    socket.on("join-conversation", (conversationId) => {
      socket.join(`convo:${conversationId}`);
    });

    socket.on("typing", ({ conversationId, isTyping, userName }) => {
      socket.to(`convo:${conversationId}`).emit("typing", {
        conversationId,
        isTyping,
        userName,
        userId,
      });
    });

    // Mark all messages in a conversation as read by this user,
    // then tell everyone viewing the chat so ticks turn blue live.
    socket.on("mark-seen", async ({ conversationId }) => {
      try {
        const convo = await Conversation.findById(conversationId);
        if (!convo || !convo.participants.map(String).includes(String(userId))) return;
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },
            readBy: { $ne: userId },
          },
          { $addToSet: { readBy: userId } }
        );
        io.to(`convo:${conversationId}`).emit("messages-seen", {
          conversationId,
          seenBy: String(userId),
        });
      } catch (err) {
        console.error("mark-seen failed:", err.message);
      }
    });

    socket.on("send-message", async ({ conversationId, text, image, clientTempId }) => {
      try {
        const clean = text?.trim() || "";
        if (!clean && !image) return;
        const convo = await Conversation.findById(conversationId);
        if (!convo || !convo.participants.map(String).includes(String(userId))) return;

        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          text: clean,
          image: image || null,
        });
        await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
        // Agar kisi ne ye chat delete (hide) ki thi to naya message aate hi wapas dikhao
        await Conversation.findByIdAndUpdate(conversationId, { $set: { hiddenFor: [] } });
        const populated = await message.populate("sender", "name email avatar avatarColor");
        // clientTempId is NOT saved — just echoed so the sender can replace
        // its optimistic ("sending...") bubble with the real message
        const out = populated.toObject();
        if (clientTempId) out.clientTempId = clientTempId;

        // Everyone viewing this chat gets it instantly...
        io.to(`convo:${conversationId}`).emit("new-message", out);
        // ...and every participant's sidebar refreshes its preview
        convo.participants.forEach((p) => {
          io.to(`user:${p}`).emit("conversation-updated", {
            conversationId,
            message: out,
          });
        });
      } catch (err) {
        console.error("send-message failed:", err.message);
      }
    });

    socket.on("disconnect", () => {
      // Sirf tab offline karo jab user ka KOI socket na bacha ho
      const set = onlineUsers.get(String(userId));
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineUsers.delete(String(userId));
      }
      io.emit("online-users", [...onlineUsers.keys()]);
    });
  });
}
