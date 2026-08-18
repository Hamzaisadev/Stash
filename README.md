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
- **Fast Transfers**: Direct peer-to-peer transfers for blazing-fast local device handoffs, backed by secure cloud storage when peers are offline.
- **In-Browser Previews**: Listen to audio files, view images, and inspect files without downloading them first.

### 📋 Live Synced Clipboard
- Copy text, links, or code snippets on one device and see it appear instantly on every connected screen in the room.
- Clear or update the clipboard with a single click.

### 🖥️ 1-Click Screen & Camera Casting
- Broadcast your screen, browser tab, or webcam directly to everyone in your room with real-time WebRTC streaming.
- No third-party meeting software or plugins required.

### 🎙️ Quick Voice Memos
- Record voice notes right from your browser and stash them directly into the room for your peers or your other devices.

### 🔒 Privacy-First & Ephemeral Control
- **Burn After Download**: Set files to self-destruct immediately after being downloaded once.
- **Timed Expiry**: Files automatically expire and clean themselves up—no leftover digital clutter.
- **Room Protection**: Lock rooms with a 6-digit access pin or enable host approval (lobby mode) to control who gets in.
- **Local Network Auto-Discovery**: Automatically find and connect to devices on the same Wi-Fi/network without typing room codes.

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

### 2. Configure Backend Environment
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-key
```

### 3. Install & Run
```bash
# Install backend dependencies
cd backend
npm install
npm run dev

# In a separate terminal, install and run frontend
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

</details>

---

## 📄 License

Stash is open-source software licensed under the [MIT License](LICENSE).
