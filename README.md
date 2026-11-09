<div align="center">

# ⚡ Stash

**Instant, zero-login file sharing, live screen casting, and real-time clipboard sync across all your devices.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-stash--ed.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://stash-ed.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

[**Try Stash Now →**](https://stash-ed.vercel.app)

<br />

</div>

---

## ✨ What is Stash?

**Stash** is your instant drop-zone for files, text, voice notes, and screen streams. No sign-ups, no installations, and no friction.

Whether you need to quickly send a photo from your phone to your PC, share code snippets across machines in real-time, or present your screen to a colleague, Stash lets you jump into an ephemeral room and get it done in seconds.

---

## 🚀 Key Features

### 📁 Instant File Sharing & Drop-Zone
- **Drag & Drop / Paste**: Drop any file format—images, videos, PDFs, archives, or ebooks—or just paste directly from your clipboard.
- **Limits**: 100 MB per file, up to 10 files per upload (multiple files are zipped server-side).
- **Transfers**: Files are uploaded to cloud storage (Supabase) and served from there. An opportunistic WebRTC peer-to-peer path is attempted first for devices in the same room; it requires a TURN server to work across most mobile and corporate networks (see configuration below).
- **In-Browser Previews**: Listen to audio files, view images, and inspect files without downloading them first.

### 📋 Live Synced Clipboard
- Copy text, links, or code snippets on one device and see it appear instantly on every connected screen in the room.
- Clear or update the clipboard with a single click.

### 🖥️ 1-Click Screen & Camera Casting
- Broadcast your screen, browser tab, or webcam directly to everyone in your room with real-time WebRTC streaming.
- No third-party meeting software or plugins required.

### 🎙️ Quick Voice Memos
- Record voice notes right from your browser and stash them directly into the room for your peers or your other devices.

### 🔒 Ephemeral Control
- **Burn After Download**: Set files to self-destruct after a chosen number of downloads.
- **Timed Expiry**: Files expire between 1 minute and 7 days (default 24h); rooms and their contents are deleted after 24 hours.
- **Room Protection**: Lock rooms with a 6-digit access code (stored as a bcrypt hash) or enable host approval (lobby mode) to control who gets in.
- **Local Network Auto-Discovery**: Devices sharing a public IP are grouped into the same auto-discovered room.

> **Not end-to-end encrypted.** Traffic is encrypted in transit and files are encrypted at rest by the storage provider, but whoever operates the instance can access uploaded files. Don't use Stash for data you wouldn't trust a hosted service with.

---

## 💡 Common Everyday Use Cases

| Scenario | How Stash Solves It |
| :--- | :--- |
| **Phone ⇄ PC Transfer** | Open Stash on both devices, drag a photo or PDF, and grab it immediately without messaging yourself on chat apps. |
| **Live Code & Text Sharing** | Paste code blocks or links into the shared clipboard during pair programming or team calls. |
| **Quick Live Presentations** | Start a screen share in a private room to quickly show a bug or mockup without scheduling a video call. |
| **Sensitive One-Time Sends** | Share confidential files using **Burn-after-download** and password protection so nothing lingers on the web. |

---

## 🎯 How to Use Stash

1. **Visit [stash-ed.vercel.app](https://stash-ed.vercel.app)** on any browser (Desktop, Mobile, Tablet).
2. **Create or Join a Room**: Pick a custom room name, join a private room with a PIN, or let Stash discover your local network room.
3. **Collaborate & Share**: Drag files in, paste text into the synced clipboard, record audio, or start a live screen stream.
4. **Share the Link**: Send your room link or 6-digit PIN to anyone you want to invite!

---

<details>
<summary>🛠️ <b>Self-Hosting & Local Development</b> (Click to expand)</summary>

<br />

If you'd like to run or self-host your own instance of Stash:

### Prerequisites
- Node.js (v18+)
- Supabase account (for database & storage bucket)

### 1. Clone the repository
```bash
git clone https://github.com/Hamzaisadev/Stash.git
cd Stash
```

### 2. Set up the database
Run `backend/schema.sql` against your Supabase project (SQL Editor), and create
a storage bucket named `stash-files`.

Upgrading an existing instance? Run `backend/migrations/001_hash_room_keys_and_atomic_downloads.sql` instead.

### 3. Configure the backend
Copy `backend/.env.example` to `backend/.env` and fill it in:
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key

# Required — the server refuses to start without it (min 32 chars).
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_SECRET=

# Required in production — comma-separated frontend origins.
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### 4. Install & run
```bash
cd backend && npm install && npm run dev
# separate terminal
cd frontend && npm install && npm run dev
```
Open `http://localhost:5173`. In development the frontend talks to
`http://<hostname>:5000` automatically.

### 5. Deploying

The frontend is static (Vercel works well). **The backend must be deployed
separately** — it needs a persistent process for WebSockets, so Vercel is not
suitable. Railway, Fly.io and Render all work. Avoid hosts that sleep on
inactivity: that drops socket connections and clears in-memory room state.

Then set the frontend's environment variables (copy `frontend/.env.example`):

```env
# Required. Without it, production builds call /api on the frontend's own
# origin, which returns the SPA's HTML instead of JSON, and nothing works.
VITE_BACKEND_URL=https://your-backend.up.railway.app

# Optional but strongly recommended: without a TURN relay, peer-to-peer
# transfer and screen sharing fail behind symmetric NAT (most mobile networks).
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

### Running tests
```bash
cd backend && npm test
```

### Known limitations
- Single backend instance only. Room host and clipboard state is in-process, so
  scaling out requires moving it to Redis plus the socket.io Redis adapter.
- Uploads and downloads are proxied through the server's memory, so large
  concurrent transfers are memory-bound. Presigned direct-to-storage uploads
  are the fix.
- Peer-to-peer transfer needs TURN to work on most real networks.

</details>

---

## 📄 License

Stash is open-source software licensed under the [MIT License](LICENSE).
