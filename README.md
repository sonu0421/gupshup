# Gupshup — Real-time Chat App

A full-stack MERN chat application with real-time messaging powered by **Socket.io**.
Built as a BTech final-year / semester project.

## Features

- **Auth** — register / login with JWT + bcrypt password hashing
- **1-to-1 chat** — search users, start a conversation
- **Group chat** — create groups with a name and members
- **Real-time messaging** — instant delivery via Socket.io rooms
- **Online status** — green dot + Online/Offline indicator
- **Typing indicator** — "X is typing…" in real time
- **Persistent history** — all messages stored in MongoDB
- **Sidebar previews** — last message + timestamp per conversation
- **Responsive app shell** — mobile: sticky top header + 5-tab bottom nav (Home, Chats, Discover, Requests, Profile); desktop: left sidebar + top bar with search & New Message CTA, dual-pane messaging
- **Read receipts** — single ✓ = sent, blue ✓✓ = seen by everyone (updates live)
- **Unread badges** — red count on chats with new messages + count in the tab title
- **New-message pill** — "↓ New messages" button appears if you're scrolled up when messages arrive
- **Notifications** — sound ping + browser notification when a message arrives and the tab is in the background
- **Discover people** — home screen tab listing every registered user as they sign up
- **Friend requests** — send / accept / reject, real-time updates via Socket.io
- **Profiles** — bio, emoji avatar or uploaded photo, friend count; click any avatar to view
- **Posts** — photo posts with captions + likes on every profile
- **Private accounts** — toggle in profile; non-friends see identity but not posts
- **Profile dashboard** — full-page profile (FB/Insta style) with photo, details, posts grid and notes; opens from chat header or Discover
- **Home + Notes** — "Welcome Home" feed for sharing short text notes/thoughts with likes
- **Home feed (FB-style)** — unified feed: friends' photo posts + everyone's notes, newest first, with author headers and likes
- **Discover UX** — clear "Add Friend" button for new people, "Request sent" state, inline Accept/Decline for incoming requests
- **Notification center** — bell icon with unread badge; likes, friend requests and accepts arrive real-time, tap to jump to them
- **Photo messages** — send images in any chat (📷 button in the composer); photos render in bubbles, click to view full-screen; non-image files are rejected
- **Premium light UI** — off-white canvas (#F8F8FC), white cards, indigo brand (#635BFF), coral accents, Plus Jakarta Sans font; lavender inbound / indigo outbound chat bubbles; micro-animations throughout

## Security

- **JWT auth** — every socket connection verifies the signed token on handshake (no userId spoofing); REST routes use `authRequired` middleware
- **Passwords** — bcrypt hashing (10 rounds), never stored in plain text
- **Rate limiting** — 20 login/register attempts per IP per 15 min (brute-force protection)
- **Helmet** — security headers (X-Content-Type-Options, X-Frame-Options, HSTS…)
- **CORS** — restrictable via `CLIENT_URL` env in production
- **Input validation** — email format, name/password length checks on register/login; regex-escaped search
- **Uploads** — image-only filter, 2–5 MB size limits, safe filenames
- **Ownership checks** — users can only delete their own posts/notes; conversation access checked per request
- Server refuses to boot without a real `JWT_SECRET` (no insecure default in production)

## Tech stack

| Layer    | Tech                          |
| -------- | ----------------------------- |
| Frontend | React 18 + Vite + React Router |
| Backend  | Node.js + Express 4           |
| Real-time| Socket.io 4                   |
| Database | MongoDB + Mongoose            |
| Auth     | JWT + bcryptjs                |

## Project structure

```
gupshup/
├── server/                 # Backend
│   ├── src/
│   │   ├── index.js        # Express + Socket.io bootstrap
│   │   ├── config/db.js    # MongoDB connection
│   │   ├── models/         # User, Conversation, Message schemas
│   │   ├── middleware/auth.js  # JWT guard
│   │   ├── routes/         # auth, conversations, messages (REST)
│   │   └── socket/index.js # real-time events: send-message, typing, online-users
│   └── .env.example
└── client/                 # Frontend
    └── src/
        ├── pages/          # Login, Register, Chat
        ├── components/     # Sidebar, ChatWindow
        ├── context/AuthContext.jsx
        ├── api.js          # axios instance with JWT interceptor
        └── socket.js       # socket.io client singleton
```

## How to run

**1. MongoDB** — install and start MongoDB locally
(or use a free MongoDB Atlas cluster and put its URI in `.env`).

**2. Backend**

```bash
cd server
cp .env.example .env   # then edit MONGO_URI / JWT_SECRET if needed
npm install
npm run dev            # http://localhost:5000
```

**3. Frontend** (new terminal)

```bash
cd client
npm install
npm run dev            # http://localhost:5173
```

Open `http://localhost:5173` in **two browsers** (or normal + incognito),
register two accounts, search each other, and chat in real time.

## How real-time works (viva notes)

- Client connects with `io(url, { auth: { userId } })`.
- Server keeps `onlineUsers: Map(userId → socketId)` and broadcasts the
  online list on every connect/disconnect.
- Each user joins a personal room (`user:<id>`); each open chat joins
  `convo:<conversationId>`.
- `send-message` → server validates the sender is a participant, saves the
  message to MongoDB, then emits `new-message` to the conversation room and
  `conversation-updated` to every participant's personal room (sidebar refresh).
- `typing` events are relayed to the conversation room (excluding the typer).
- **Read receipts:** opening a chat (or receiving a message while viewing it)
  emits `mark-seen`; the server adds you to each message's `readBy` array and
  broadcasts `messages-seen` to the room, so the sender's ✓ ticks turn blue
  live (`Message.readBy`, `isSeenByAll()` in `client/src/utils.js`).
- **Unread badges:** every `conversation-updated` for a chat you don't have
  open bumps a client-side counter — red badge on the chat row + count in the
  browser tab title. Opening the chat clears it.
- **Notifications:** a WebAudio `playPing()` beep plays for background chats;
  if the tab is hidden and permission is granted, a system `Notification`
  appears — clicking it opens that chat.
- **Social:** `POST /friends/request/:id` creates a `FriendRequest` and emits
  `friend-request` to the recipient's `user:<id>` room (live badge + ping);
  accepting emits `friend-accepted` back. `GET /users` returns everyone with
  your `friendStatus` (`none` / `pending-sent` / `pending-received` / `friends`).
  Profile photos upload via `POST /users/me/avatar` (multer, max 2MB, served
  from `/uploads/`); or pick an emoji avatar + initial colour.
- **Posts:** `Post` model (image + caption + likes). `POST /api/posts`
  uploads a photo post; `GET /api/posts/user/:id` lists with like state;
  `POST /api/posts/:id/like` toggles. Privacy: `User.isPrivate` — private
  accounts hide posts from non-friends (403), while name/avatar/bio stay
  visible so you can identify who sent a request.
- **Auto-chat on accept:** accepting a friend request also creates (or finds)
  the 1-to-1 `Conversation` and emits `conversation-updated` to both users,
  so the chat appears in both sidebars instantly.
- **Notes:** `Note` model (text + likes). `GET /api/notes/feed` (latest 50),
  `POST /api/notes`, like toggle, delete own. Shown on the Home tab and on
  each profile page (`GET /api/notes/user/:id`).
- **Notification center:** `Notification` model (recipient, type, actor, read).
  Created on friend-request, friend-accepted, post-like, note-like; emitted
  live via `notification` socket event. `GET /api/notifications` (+ unread
  count), `POST /api/notifications/read`.

## Production serving

The backend can serve the built frontend itself (single port, no CORS hassle):

```bash
cd client && npm run build   # creates client/dist
cd ../server && npm run dev  # serves API + the dist/ SPA on :5000
```

`server/src/index.js` serves `client/dist` with an SPA fallback, but only
when `dist/` exists — in dev, keep using the Vite server on :5173 (it proxies
`/api` to the backend).

## Ideas to extend

- Emoji picker, message search, message reactions/reply
- Stories (24-hour photo/status updates)
- Deploy: Render/Railway (server) + Vercel (client) + Atlas (DB)
