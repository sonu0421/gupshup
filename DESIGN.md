# Gupshup — System Design Document

> Real-time MERN chat application with social features.
> This document describes the architecture, data model, APIs, real-time protocol,
> UI structure and security design of the project.

---

## 1. Overview

Gupshup is a full-stack web application that combines **real-time messaging**
(1-to-1 and group chat) with **social networking** features (profiles, photo
posts, notes feed, friend requests, notifications).

**Design goals**

- Real-time everything: messages, typing, online status, notifications
- Mobile-first responsive UI (WhatsApp-style on phones, two-pane on desktop)
- Simple deployment: one Node process serves both API and frontend

---

## 2. System Architecture

```
┌──────────────┐      HTTPS/WSS       ┌─────────────────────────────┐
│    Browser   │ ◄──────────────────► │        Node.js Server       │
│  React (SPA) │                      │  Express 4 + Socket.io 4    │
└──────────────┘                      └──────┬──────────────┬───────┘
                                             │              │
                                    REST (/api/*)     WebSocket events
                                             │              │
                                      ┌──────▼──────────────▼───────┐
                                      │      MongoDB (Mongoose)     │
                                      │  users, conversations,      │
                                      │  messages, posts, notes, …  │
                                      └─────────────────────────────┘
```

- **Single deployable unit.** In production the Express server also serves the
  built React app (`client/dist`) as static files with an SPA fallback, so the
  whole product runs on one port (`:5000`).
- **Same-origin API.** The frontend calls relative URLs (`/api/...`) and opens
  the Socket.io connection on the same origin — no CORS juggling in the
  default setup.
- **Database.** MongoDB via Mongoose. Demo mode uses `mongodb-memory-server`
  (zero-install, data resets on restart); production uses MongoDB Atlas via
  `MONGO_URI`.

---

## 3. Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 18, Vite 5, React Router 6, Axios, socket.io-client 4, hand-written CSS design system |
| Backend    | Node.js, Express 4, Socket.io 4, Mongoose 8 |
| Auth       | JSON Web Tokens (jsonwebtoken), bcryptjs password hashing |
| Uploads    | Multer (disk storage, image-only filter, size limits) |
| Database   | MongoDB (Atlas in production, in-memory for demo) |
| Security   | Helmet headers, express-rate-limit, CORS allow-list, input validation |

---

## 4. Database Design

MongoDB collections (Mongoose models in `server/src/models/`):

### User
| Field | Type | Notes |
|-------|------|-------|
| name | String | 2–50 chars, trimmed |
| email | String | unique, lowercase |
| password | String | bcrypt hash (never plain text) |
| avatar | String | emoji **or** `/uploads/...` photo path; `""` = initial letter |
| avatarColor | String | background colour for initial avatars |
| bio | String | max 160 chars |
| isPrivate | Boolean | default `false`; friends-only posts when `true` |

### Conversation
| Field | Type | Notes |
|-------|------|-------|
| name | String | group name (empty for 1-to-1) |
| isGroup | Boolean | |
| participants | ObjectId[] → User | members |
| admin | ObjectId → User | group creator |
| lastMessage | ObjectId → Message | denormalised for fast sidebar previews |

### Message
| Field | Type | Notes |
|-------|------|-------|
| conversation | ObjectId → Conversation | indexed |
| sender | ObjectId → User | |
| text | String | may be empty for photo-only messages |
| image | String | `/uploads/...` path or `null` |
| readBy | ObjectId[] → User | **drives blue ✓✓ read receipts** |

### FriendRequest
| Field | Type | Notes |
|-------|------|-------|
| from / to | ObjectId → User | |
| status | enum | `pending` \| `accepted` |
| *(unique index on from+to)* | | one relationship record per pair |

Accepting a request flips status to `accepted` **and** auto-creates a 1-to-1
Conversation, so friends can message instantly.

### Post
| Field | Type | Notes |
|-------|------|-------|
| user | ObjectId → User | author |
| image | String | `/uploads/...` photo (required) |
| caption | String | max 300 chars |
| likes | ObjectId[] → User | like = array membership (toggle) |

### Note
Short text posts for the Home feed: `user`, `text` (max 500), `likes[]`.

### Notification
| Field | Type | Notes |
|-------|------|-------|
| recipient | ObjectId → User | who sees it (indexed) |
| type | enum | `friend-request` \| `friend-accepted` \| `post-like` \| `note-like` |
| actor | ObjectId → User | who triggered it |
| refId | ObjectId | related post / note / request |
| read | Boolean | |

**Entity relationships (ER sketch)**

```
User 1───* Message *───1 Conversation (participants *───* User)
User 1───* Post / Note / Notification
User *───* User  (via FriendRequest: from/to + status)
Conversation *───1 Message (lastMessage)
```

---

## 5. REST API Design

Base: `/api`. Authenticated routes require `Authorization: Bearer <JWT>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account (rate-limited, validated) |
| POST | `/auth/login` | Login, returns JWT + user (rate-limited) |
| GET | `/auth/me` | Current user profile |
| GET | `/auth/users?q=` | Search people |
| GET | `/users` | Discover: all users + my `friendStatus` toward each |
| GET | `/users/:id` | Public profile (+ `isFriend`) |
| PATCH | `/users/me` | Edit bio / avatar / privacy |
| POST | `/users/me/avatar` | Upload profile photo (2 MB, image-only) |
| GET/POST | `/conversations` | List my chats / create 1-to-1 or group |
| GET | `/messages/:conversationId` | Chat history (participants only) |
| POST | `/messages/upload` | Upload a chat photo → `{ url }` (5 MB, image-only) |
| POST | `/friends/request/:userId` | Send friend request |
| POST | `/friends/accept/:requestId` | Accept (+ auto-creates chat) |
| POST | `/friends/reject/:requestId` | Reject |
| GET | `/friends` · `/friends/requests` | My friends · incoming requests |
| GET | `/posts/user/:userId` | Profile posts (privacy enforced) |
| POST | `/posts` | Upload photo post + caption |
| POST | `/posts/:id/like` | Toggle like (creates notification) |
| DELETE | `/posts/:id` | Owner only |
| GET | `/notes/feed` | All notes, newest first |
| POST | `/notes` · `POST /notes/:id/like` · `DELETE /notes/:id` | Notes CRUD + likes |
| GET | `/feed` | **Home feed:** friends' + own posts merged with notes, newest first |
| GET | `/notifications` · `POST /notifications/read` | Notification center |
| GET | `/api/health` | Liveness probe |

---

## 6. Real-time Protocol (Socket.io)

Handshake authentication: the client sends its JWT in `auth: { token }`; the
server verifies it in an `io.use()` middleware and attaches `socket.userId`.
Connections without a valid token are rejected — **userIds can never be
spoofed**.

Rooms:
- `user:<userId>` — personal room (sidebar updates, notifications, requests)
- `convo:<conversationId>` — everyone currently viewing a chat

| Event (client → server) | Payload | Effect |
|---|---|---|
| `join-conversation` | conversationId | Join chat room |
| `send-message` | `{ conversationId, text, image }` | Persist message → broadcast |
| `typing` | `{ conversationId, isTyping, userName }` | Typing indicator |
| `mark-seen` | `{ conversationId }` | Mark messages read |

| Event (server → client) | Payload | Effect |
|---|---|---|
| `new-message` | message | Append to open chat |
| `conversation-updated` | `{ conversationId, message }` | Refresh sidebar preview + unread badge |
| `messages-seen` | `{ conversationId, seenBy }` | Flip ticks to blue ✓✓ |
| `typing` | `{ userName, isTyping }` | "X is typing…" |
| `online-users` | `[userId…]` | Green-dot presence |
| `friend-request` / `friend-accepted` | request | Live social updates |
| `notification` | notification | Bell badge + panel entry |

---

## 7. UI / UX Design

**Design system** (`client/src/index.css`, CSS variables):
- Dark theme, purple→pink gradient brand (`--accent-gradient`)
- Inline SVG icon set (`components/icons.jsx`) — no emoji icons in chrome UI
- Chat bubbles with tails, shadows, slide-in animation; gradient for own messages
- Micro-interactions: heart-pop on like, bell-ring on new notification, card entrances

**Pages / views**

| View | Description |
|------|-------------|
| Login / Register | Gradient brand card, animated entrance |
| Chat (main) | Sidebar (Home · Chats · Discover · Requests tabs) + chat window; WhatsApp-style single-pane on mobile |
| Home | Facebook-style feed: composer + mixed posts/notes, newest first |
| Discover | People list with Add Friend / Request sent / Accept-Decline / Message actions |
| Requests | Incoming friend requests |
| ProfilePage | Full-page dashboard: cover, avatar, bio, stats, posts grid, notes |
| Notifications | Bell dropdown, tap-to-navigate |

**Key UX details**
- Read receipts: grey ✓ sent → blue ✓✓ seen by all (via `readBy`)
- Unread badges on chats + count in the browser tab title
- "↓ New messages" pill when scrolled up; sound ping + browser Notification when tab hidden
- Photo messages: in-bubble preview, click for full-screen lightbox
- Private accounts: identity visible, posts hidden from non-friends (403)

---

## 8. Data Flow Examples

**Register → first message**
1. `POST /auth/register` → bcrypt hash → User created → JWT returned, stored in `localStorage`
2. Socket connects with JWT → server verifies → joins `user:<id>` room
3. Discover → `POST /friends/request/:id` → recipient gets `friend-request` event + notification
4. Accept → status `accepted` → 1-to-1 Conversation created → both sidebars refresh via `conversation-updated`
5. `send-message` → Message saved (with `readBy: []`) → `new-message` to `convo:<id>` room
6. Recipient opens chat → `mark-seen` → `readBy` updated → sender gets `messages-seen` → ticks turn blue

**Posting a photo**
1. `POST /posts` (multipart, Multer validates type/size) → file to `server/uploads/` → Post created
2. Appears in author's profile and in friends' `/feed`
3. Like → `likes[]` toggled → Notification created → actor notified in real time

---

## 9. Security Design

| Concern | Mitigation |
|---------|------------|
| Impersonation | JWT verified on **every** socket handshake; REST via `authRequired` |
| Password storage | bcrypt (10 rounds); select `-password` on reads |
| Brute force | `express-rate-limit`: 20 auth attempts / IP / 15 min |
| Headers | Helmet (nosniff, frameguard, HSTS…) |
| CORS | Allow-list via `CLIENT_URL` env (same-origin by default) |
| Injection | Email/name/password validation; regex-escaped search (ReDoS-safe) |
| Malicious uploads | Multer image-only filter, 2–5 MB caps, server-generated filenames |
| IDOR | Participant check on chats; owner check on delete; privacy check on posts |
| Info leaks | Central error handler (no stack traces); fail-fast without `JWT_SECRET` |
| Secrets | `.env` git-ignored; `.env.example` documents required vars |

---

## 10. Deployment

```
                 ┌──────────────┐
                 │    Render    │  Node 20, `npm start`
                 │  (backend)   │  env: MONGO_URI, JWT_SECRET, CLIENT_URL
                 └──────┬───────┘
                        │  serves API + frontend (client/dist)
                 ┌──────▼───────┐
                 │    Vercel    │  (optional) static frontend → points at Render API
                 └──────────────┘
                        │
                 ┌──────▼───────┐
                 │ MongoDB Atlas│  M0 free cluster, 0.0.0.0/0 network access
                 └──────────────┘
```

Build once (`npm run build` in `client/`), deploy `server/` — Express serves
`client/dist` itself, so a single service is enough. Uploads live on the
server's disk (`server/uploads/`, served at `/uploads/*`).

---

*Document version: 1.0 — matches the codebase at `~/workspace/gupshup/`.*
