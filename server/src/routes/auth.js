import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { authRequired } from "../middleware/auth.js";
import { getIO } from "../socket/index.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Brute-force protection: max 20 login/register attempts per IP per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bahut saari koshishein — 15 minute ruk kar try karo" },
});

const publicUser = (u) => ({ _id: u._id, name: u.name, email: u.email });

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// POST /api/auth/register
router.post("/register", authLimiter, async (req, res) => {
  try {
    let { name, email, password } = req.body;
    name = name?.trim();
    email = email?.trim().toLowerCase();
    if (!name || name.length < 2 || name.length > 50)
      return res.status(400).json({ message: "Naam 2-50 characters ka ho" });
    if (!email || !emailRe.test(email))
      return res.status(400).json({ message: "Sahi email likho" });
    if (!password || password.length < 6 || password.length > 72)
      return res.status(400).json({ message: "Password 6-72 characters ka ho" });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash });
    // Real-time: tell everyone a new user joined so Discover updates live
    try {
      getIO()?.emit("user-joined", { _id: user._id, name: user.name });
    } catch {
      /* socket not ready — ignore */
    }
    res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email aur password likho" });
    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });
    res.json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/config — public client config (Google Client ID for the button)
router.get("/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

// POST /api/auth/google — Sign in with Google.
// Body: { credential } = Google ID token from GIS. We verify it with Google,
// then find-or-create the user and return our own JWT.
router.post("/google", authLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ message: "Google credential missing" });
    if (!process.env.GOOGLE_CLIENT_ID)
      return res.status(500).json({ message: "Google login is not configured" });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email_verified)
      return res.status(400).json({ message: "Google email not verified" });

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = (payload.name || email.split("@")[0]).slice(0, 50);
    const picture = payload.picture || "";

    // 1) Already linked Google account → login
    // 2) Same email registered with password → link Google id, login
    // 3) New user → create account with Google profile photo
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        user.googleId = googleId;
        if (!user.avatar && picture) user.avatar = picture;
        await user.save();
      } else {
        user = await User.create({
          name,
          email,
          googleId,
          avatar: picture,
        });
      }
    }
    res.json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    console.error("Google auth failed:", err.message);
    res.status(401).json({ message: "Google verification failed" });
  }
});

// GET /api/auth/me
router.get("/me", authRequired, async (req, res) => {
  const user = await User.findById(req.userId).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

// GET /api/auth/users?q=  — search people to start a chat with
router.get("/users", authRequired, async (req, res) => {
  const q = escapeRegex(String(req.query.q || "").slice(0, 50));
  const users = await User.find({
    _id: { $ne: req.userId },
    $or: [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ],
  })
    .select("-password")
    .limit(20);
  res.json(users);
});

export default router;
