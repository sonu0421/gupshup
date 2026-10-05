import "dotenv/config";
import express from "express";
// Safety net: one bad request must never crash the whole server.
// (Express 4 doesn't forward async throws to the error handler.)
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (server kept alive):", err?.message);
});
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import convoRoutes from "./routes/conversations.js";
import messageRoutes from "./routes/messages.js";
import usersRoutes from "./routes/users.js";
import friendsRoutes from "./routes/friends.js";
import postsRoutes from "./routes/posts.js";
import notesRoutes from "./routes/notes.js";
import notificationsRoutes from "./routes/notifications.js";
import feedRoutes from "./routes/feed.js";
import { initSocket } from "./socket/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// SECURITY: never boot without a real JWT secret (no silent insecure default)
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET env variable missing — set it in server/.env");
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" },
});

// Security headers (X-Content-Type-Options, X-Frame-Options, HSTS, …)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: restrict in production via CLIENT_URL="https://myapp.vercel.app"
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));

app.use(express.json({ limit: "200kb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/conversations", convoRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/feed", feedRoutes);

// Uploaded photos (avatars, posts, chat images) — same dir multer writes to
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Serve the production frontend from client/dist (run `npm run build` in client/).
// In dev, use the Vite server on :5173 instead; this only kicks in when dist exists.
const distPath = path.join(__dirname, "../../client/dist");
if (fs.existsSync(path.join(distPath, "index.html"))) {
  app.use(express.static(distPath));
  app.get(/.*/, (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

initSocket(io);

// Central error handler — never leak stack traces to clients in production
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({ message: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;
await connectDB(process.env.MONGO_URI);
httpServer.listen(PORT, () =>
  console.log(`Gupshup server running on http://localhost:${PORT}`)
);
