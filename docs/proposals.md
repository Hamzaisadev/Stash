# Stash — Technical Audit & Product Proposal

**Audited:** 2026-08-10 against commit `6b26c0e` · **Codebase:** ~7,958 LOC (frontend 6,753 / backend 1,205)

This document covers four things:

1. **The stack we're on now, and what we should be on** (including the database question)
2. **Everything wrong with it** — security, functional bugs, UX, UI, code, architecture
3. **Where the product should go** — features to add, cut, and restructure
4. **Things worth fixing that weren't asked about**

Every finding below was verified against the actual code. Line numbers refer to commit `6b26c0e`. Findings are labelled **[verified]** when I reproduced them directly (build output, lint output, compiled CSS, or by tracing the exact code path).

---

## Part 1 — Tech stack

### What we're running now

| Layer | Current | Verdict |
|---|---|---|
| **Frontend framework** | React 19.2 + Vite 8, **JavaScript (no TypeScript)** | Keep React+Vite. **Add TypeScript.** |
| **Styling** | Tailwind CSS v4 + shadcn/ui (on Base UI) | Keep. Good choice. |
| **Animation** | **framer-motion 12 AND GSAP 3** — both | **Cut one.** Redundant. |
| **Icons / toasts** | lucide-react, sonner | Keep. |
| **Theming** | `next-themes` in a non-Next app | Replace with a 10-line class toggle. |
| **Realtime** | socket.io-client 4 | Keep. |
| **Backend** | Node + Express 5, ESM | Keep. |
| **Realtime server** | Socket.io 4 | Keep, but see scaling note. |
| **Uploads** | Multer 2, **memory storage**, 100 MB × 10 files | **Change** — see below. |
| **Zip** | archiver 8 (in-memory buffer) | Change with uploads. |
| **Passwords** | bcryptjs | Keep (for files). Room keys are plaintext — fix. |
| **Database** | **Supabase Postgres** | **Keep.** Right choice. |
| **Storage** | Supabase Storage (S3-compatible), bucket `stash-files` | Keep. |
| **Also present** | **sqlite3 + `stach.db`** | **Dead code — delete.** Nothing imports `db.js`. [verified] |
| **Deploy** | Frontend → Vercel (`vercel.json`), Backend → Docker (`EXPOSE 7860`, Hugging Face Spaces) | Backend host is wrong for this workload. |
| **Tests / CI / migrations** | **None. Zero. None.** | Add. |

### Verdict: the stack is fine. The *implementation* of the stack is the problem.

This is worth saying plainly, because it's the most useful thing in this document: **you do not need to rewrite this in Next.js, or swap Postgres for Mongo, or move to tRPC.** React + Vite + Express + Socket.io + Postgres is a completely legitimate stack for this product. Almost every serious problem below is a bug or a missing guardrail, not a framework choice.

The stack changes actually worth making, in order of value:

**1. Add TypeScript (highest value by a wide margin).**
`useStash.js` is 1,512 lines of untyped state, sockets, WebRTC, and IndexedDB. The single worst bug in this codebase — drag-and-drop upload being completely broken (F1 below) — is a function called with 1 argument where 2 are required. TypeScript catches that at compile time, for free, forever. Migrate incrementally: `allowJs: true`, type the API layer and `useStash`'s return value first.

**2. Fix the upload architecture.**
Files currently go: browser → **Express server RAM** → Supabase Storage. Downloads go: Supabase → **Express server RAM** → browser. With `100MB × 10 files` in memory storage plus in-memory zipping, a handful of concurrent uploads will OOM the box. Move to **presigned direct-to-storage uploads** (browser uploads straight to Supabase, server only issues the URL and records metadata) and **redirect downloads to signed URLs** instead of proxying bytes. This removes your single biggest scaling and cost bottleneck and deletes a lot of code.

**3. Cut a dependency each from three redundant pairs.**
- framer-motion **or** GSAP, not both (they're both in the 806 KB bundle) [verified]
- `next-themes` → a `document.documentElement.classList.toggle('dark')` helper
- `shadcn` is a **CLI**, not a runtime library — it does not belong in `dependencies`

**4. Delete SQLite entirely.** `backend/src/db.js`, `backend/stach.db`, `backend/src/inspect_db_temp.js`. Nothing imports any of it [verified]. `sqlite3` is a native module that slows every Docker build for zero benefit.

**5. Add the missing security middleware.** `helmet`, `express-rate-limit`, and `app.set('trust proxy', 1)`. All three are one-liners and all three are load-bearing (see S8, S10, S11).

**6. Move the backend off Hugging Face Spaces.** The Dockerfile targets HF Spaces (`EXPOSE 7860`). Spaces sleeps on inactivity, which kills WebSocket sessions and in-memory room state. For a persistent Socket.io server you want **Railway, Fly.io, or Render** — anything with a persistent process and WebSocket support. Frontend on Vercel is correct.

**7. Add a router.** `App.jsx` hand-rolls routing with `window.location.pathname` + `popstate` + a `replaceState` rewrite hack (`App.jsx:21-27`). Deep links, the back button, and 404s are all unreliable. React Router is an afternoon of work.

### One stack change worth genuinely considering later

If Stash ever needs to scale past one server, the in-memory `roomHosts` and `roomClipboards` Maps (`server.js:29-30`) break immediately — two instances won't share room state, and a restart wipes every room's host. Two paths:

- **Conventional:** add Redis (Upstash) + `@socket.io/redis-adapter`. Well-trodden, low risk.
- **Interesting:** **Cloudflare Workers + Durable Objects + R2.** Durable Objects are almost a perfect match for "one ephemeral room = one stateful object with WebSockets attached," and R2 has zero egress fees, which matters a lot for a file-sharing product. This is a rewrite, not a migration — file it under "if this becomes a real product," not "next sprint."

Don't do either yet. One server is fine for now; just know the ceiling exists and it's the in-memory Maps.

---

## Part 2 — The database

### What we're using

**Supabase Postgres** for metadata (two tables: `rooms`, `files`) and **Supabase Storage** for the file bytes. Plus a **vestigial SQLite database** that is entirely dead code.

### What we should use: **Postgres. Keep it.**

Postgres is the right database for this. Relational data (rooms → files), transactional needs (download counters), TTL semantics, and free managed hosting via Supabase. There is no reason to change engines.

**But the schema and its usage have serious problems**, and these are the ones that matter:

| # | Issue | Detail |
|---|---|---|
| **D1** | **No migrations. No schema file. Anywhere.** | There is not a single `.sql` file in this repo [verified]. The schema exists *only* inside the live Supabase project. That means: no code review of schema changes, no way to reproduce the DB, no rollback, and no way for a second developer to run this project. **This is the most serious database problem.** The only schema-as-code (`db.js`) is dead, describes SQLite, and doesn't even include the `rooms` table. |
| **D2** | **Timestamps stored as epoch-millisecond integers** | `Date.now()` is written to `created_at`, `expires_at`, `uploaded_at`, `stack_key_expires_at` (`controller.js:157, 246, 645`). Should be `timestamptz`. Consequences: no date functions, no timezone semantics, no readable values in the Supabase dashboard, and awkward index usage. |
| **D3** | **Room access keys stored in plaintext** | `stack_key` is written raw (`controller.js:655`) and compared with `===` (`controller.js:805`). Meanwhile file passwords are correctly bcrypt-hashed. Anyone with DB read access — or any future SQL injection / leaked backup — reads every room passcode. **Inconsistent with the security the app claims.** |
| **D4** | **No foreign key from `files.room_id` → `rooms.id`** | Room deletion is done manually in app code (`deleteRoomData`, `controller.js:964-986`). If any of those steps fails midway, you get orphaned rows and orphaned S3 objects that nothing will ever clean up. Should be `ON DELETE CASCADE`. |
| **D5** | **Download counter is a read-modify-write race** | `controller.js:378` reads `download_count`, adds 1, writes it back. Two concurrent downloads both read the same value. **This defeats burn-after-read and `max_downloads`** — the headline security feature. Needs an atomic `UPDATE ... SET download_count = download_count + 1 RETURNING`. |
| **D6** | **Cleanup runs on every request** | `cleanupExpiredFiles()` is called at the top of `getFiles` **and** `downloadFile` (`controller.js:290, 328`). Every file listing triggers a full expiry scan plus deletes across two tables and S3. This is latency and cost on the hot path. Should be `pg_cron` / a Supabase scheduled function. |
| **D7** | **No RLS policies** | The backend uses the **service-role key**, which bypasses RLS entirely. Defensible for a server-only architecture, but there's zero defense-in-depth, and the moment anyone adds a client-side Supabase call the whole database is public. Enable RLS with a deny-all default. |
| **D8** | **Missing indexes** | No declared indexes on `files(expires_at)` (scanned on every request via D6), `files(room_id)`, `rooms(created_at)`, or `rooms(creator_socket_id)` (queried on every room creation). |
| **D9** | **Filename typo + committed artifact** | The SQLite file is `stach.db` (not `stash.db`), and it was committed before `.gitignore` covered it. |

**Recommended database work, in order:**

1. Write `schema.sql` documenting what exists today, commit it. *(Do this first — it makes everything else reviewable.)*
2. Add the FK with `ON DELETE CASCADE`, and the four missing indexes.
3. Convert timestamp columns to `timestamptz`.
4. Hash `stack_key` (bcrypt, same as file passwords).
5. Replace the counter increment with an atomic Postgres function.
6. Move expiry cleanup to `pg_cron`; delete it from the request path.
7. Enable RLS, deny-all, service-role only.
8. Adopt Supabase CLI migrations for everything after that.

---

## Part 3 — Everything wrong with it

### 🔴 Security — critical

These are ordered by how badly they break the product's core promise ("secure, private rooms").

**S1 — Host identity is client-controlled: total room takeover.** [verified]
The "host" credential is `creator_socket_id` — a string the **browser generates** (`"client_" + Math.random()...`, `useStash.js:18`), stores in localStorage, and sends as the `x-host-id` header. The server trusts it verbatim (`controller.js:148, 350, 515, 585, 736, 841, 922, 1008`).

Worse: **the server hands this credential out.** `getRoomDetails` returns `creator_socket_id` in its response body (`controller.js:759`) to anyone who can read the room. So the attack is:

```
GET /api/rooms/some-room     → read creator_socket_id from the JSON
<any request> x-host-id: <that value>  → you are now the host
```

That grants: change room settings, rotate the access key, delete the room and all its files, upload to protected rooms, delete anyone's files. There is no fix short of **server-issued host secrets that are never returned to non-hosts**.

**S2 — Anyone can hijack or delete any auto-created room.** [verified]
Rooms created automatically (the IP-derived room, and any room auto-created by visiting a share link) get `creator_socket_id: 'system'`. Two endpoints special-case that value:

- `deleteRoom` (`controller.js:1008`): `if (room.creator_socket_id !== host_id && room.creator_socket_id !== 'system')` → **any user can delete any `system` room** and every file in it.
- `updateRoomSettings` (`controller.js:841-848`): allows the update, then **assigns ownership to the caller**. An attacker takes over the room, enables protection, sets a passcode, and locks out everyone who was using it.

**S3 — Room ID is derived from a hashed IP, and collapses to a single global room in production.** [verified]
`hashIp()` (`controller.js:13-35`) maps **every** private-range address (`10.*`, `192.168.*`, `172.16.*`, `::1`, `127.0.0.1`, link-local) to the literal constant `'local-stash-room'`. Separately, `app.set('trust proxy')` is **never called** [verified], so behind any reverse proxy `req.ip` is the *proxy's* address, identical for every user on the planet.

Deployed behind Vercel/Railway/HF Spaces, that means **every user who opens the app without a room link lands in the same shared room and sees each other's uploaded files.** This is a catastrophic privacy failure and it is the default path through the app. (Bonus bug: the `172.16.` check only covers `172.16.*`, not the full `172.16–172.31` private range.)

**S4 — Socket.io has no authentication at all.** [verified]
`join-room` (`server.js:37-48`) accepts any `roomId` from any client, joins them to the room, and **immediately sends the room's entire clipboard history**. No token check, no room-password check, nothing. Any client that knows or guesses a room ID receives every synced clipboard entry — which is exactly where users paste passwords and private links. Room IDs are often user-chosen words, so guessing is realistic.

The same applies to every other socket event: file-upload broadcasts, screen-share signaling, and WebRTC offers are all unauthenticated.

**S5 — Host approval can be stolen by whoever connects first.** [verified]
`roomHosts` is populated first-come-first-served: `if (isHost && !roomHosts.has(roomId)) roomHosts.set(roomId, clientId)` (`server.js:40-42`). The claim is never checked against the database. An attacker who connects before the real host becomes the approval authority for that room and can approve themselves, deny everyone else, and kick members. The Map is also in memory, so **every server restart re-opens the race for every room.**

**S6 — File passwords are bypassable via the preview endpoint.** [verified]
`getPreview` (`controller.js:495-557`) checks room-level access but **never checks `password_hash`, `max_downloads`, or `expires_at`**. It returns a 10-minute signed URL to the raw object in storage. So for any image, video, or audio file: password-protected files can be fetched without the password, burn-after-read files can be read without incrementing the counter, and expired files are still served.

**S7 — Weak and non-expiring credentials.**
- Room passcodes use `Math.random()` (`controller.js:655, 856, 926`) — not cryptographically secure, and only 6 digits. `crypto.randomInt` is already imported in the same file.
- `stack_key_expires_at` is written in three places and **checked in zero** [verified]. "Expiring keys" don't expire. It's also set to `Date.now() + 3153600000000` — about **100 years**.
- Access tokens (`auth.js:12-18`) contain no timestamp and no expiry, so **they are valid forever**. Rotating a room's key does not invalidate previously issued tokens.
- The HMAC signing secret is the **Supabase service-role key** (`auth.js:7`) — key reuse across unrelated purposes — with a hardcoded fallback (`'stash-secret-fallback-key'`) that would make tokens trivially forgeable.
- `verifyRoomToken` compares signatures with `===` (`auth.js:31`) rather than `crypto.timingSafeEqual`.

**S8 — No rate limiting anywhere.** [verified: no `express-rate-limit`, no `helmet`]
Nothing throttles uploads, downloads, room creation, or passcode attempts. A 6-digit passcode falls to brute force in minutes. Room creation is capped at 5 per `host_id` (`controller.js:640`) — but `host_id` is attacker-controlled, so the cap is decorative.

**S9 — `getRoomDetails` auto-creates a room for any ID requested.** (`controller.js:715-732`)
`GET /api/rooms/<anything>` inserts a new row. An attacker can fill the `rooms` table with a simple loop.

**S10 — CORS reflects any origin with credentials enabled.** (`server.js:19-25, 154-160`)
`callback(null, origin || true)` echoes whatever origin asked. Combined with `credentials: true`, any website can call this API from a visitor's browser. Impact is reduced because auth is header-based rather than cookie-based, but this is still a misconfiguration and it is trivially fixable with an allowlist.

**S11 — Stack traces leaked to clients.** (`errors.js:18-28`)
The global error handler returns `error: err` and `stack: err.stack` on every failure, in production, unconditionally — including raw Supabase errors with schema details.

**S12 — Memory-based upload pipeline is a trivial DoS.** (`upload.js:9-14`, `controller.js:186-206`)
`upload.array('files', 10)` with a 100 MB per-file cap = up to **1 GB of RAM per request**, and multi-file uploads then build the entire zip in memory and `Buffer.concat` it, roughly doubling that. A few concurrent uploads OOM the process. There is also no file-type validation and no scanning.

**S13 — `originalname` is used unsanitized** as the zip entry name (`controller.js:198`) and in `Content-Disposition` (`controller.js:402`).

**S14 — Known vulnerable dependencies.** [verified via `npm audit`]
Backend: 4 vulnerabilities (2 high) — including `socket.io-parser` **Zero-attachment Memory Exhaustion**, directly reachable given S4's unauthenticated sockets. Frontend: 11 vulnerabilities (8 high). Both fixable with `npm audit fix`.

---

### 🐞 Functional bugs

**F1 — Drag-and-drop upload and paste-to-upload are completely broken, and both report success.** [verified — this is the most user-visible bug in the app]

`uploadFile(selectedFiles, options)` (`useStash.js:869`) has no default for `options`, and dereferences it unconditionally at `useStash.js:894`:

```js
formData.append("password", options.password);   // TypeError if options is undefined
```

All three drop/paste call sites pass **only one argument** (`AppPage.jsx:252, 256, 300`). The `TypeError` is thrown inside the `try` block, caught at `useStash.js:970`, and swallowed into `status.error` — so it isn't a visible crash, it's a **silent total failure**. Meanwhile:

- **Drop path** (`AppPage.jsx:252-258`): `toast.success("Stashing N dropped item(s)")` fires unconditionally on the next line, because the upload isn't awaited.
- **Paste path** (`AppPage.jsx:300`): wrapped in `toast.promise`, but the catch block `return false`s instead of rethrowing — so the promise **resolves**, and sonner shows *"Pasted file X stashed successfully!"*

Net effect: the app's two headline "magic" interactions never upload anything and tell the user they worked. Only the upload modal (`UploadForm.jsx:113`, which passes a full options object) actually works. **One-line fix:** `options = {}` default.

**F2 — Room expiry never runs.** `cleanupExpiredRooms` (`controller.js:45`) compares `created_at` against an epoch-millisecond threshold. Combined with D2's storage format ambiguity, this silently prunes nothing — rooms and their files accumulate forever.

**F3 — `max_downloads` / burn-after-read is racy.** See D5. Two concurrent requests both pass the check.

**F4 — `rotateRoomKey` is impossible for auto-created rooms.** It requires `creator_socket_id === host_id` (`controller.js:922`), but auto-created rooms are owned by `'system'`, so the host can never rotate the key on the room type most users actually get.

**F5 — Expired files are still previewable.** `getPreview` doesn't check `expires_at`.

**F6 — Unvalidated numeric inputs.** `expires_in` and `max_downloads` are `parseInt`'d with no clamping (`controller.js:156, 159`). A large `expires_in` produces a file that never expires. A negative `max_downloads` causes the file to be deleted on first download.

**F7 — WebRTC has no TURN server.** [verified] All four `RTCPeerConnection` configs use only `stun:stun.l.google.com:19302` (`useStash.js:406, 439, 1161, 1217`). STUN alone fails behind symmetric NAT — i.e. most mobile networks and many corporate networks. P2P file transfer and screen sharing will fail for a large fraction of real users, with no fallback message.

**F8 — P2P file transfer is dead code and can never succeed.** [verified — event name mismatch]
The client requests a file by emitting it **wrapped inside** a `p2p-signal` envelope (`useStash.js:1148-1155`):

```js
socketRef.current.emit("p2p-signal", {
  roomId: room.id,
  signal: { type: "p2p-request-file", fileId, requesterId: ... },
});
```

The backend relays `p2p-signal` verbatim (`server.js:139-145`), so peers receive a `p2p-signal` whose `signal.type` is `"p2p-request-file"`. But the receiving handler (`useStash.js:367-379`) only branches on `p2p-ready`, `signal.sdp`, and `signal.candidate` — **this type is silently dropped**. Meanwhile the backend's dedicated `p2p-request-file` channel (`server.js:116-118`) is never emitted to by the client, so the `socket.on("p2p-request-file")` listener at `useStash.js:355` is unreachable.

Net effect: **every P2P attempt times out at 1.5s** (`useStash.js:1116-1122`) and falls back to cloud. The headline P2P feature is dead code that adds 1.5s of latency to every download under 15 MB. This compounds F7 — even if you add a TURN server, P2P still wouldn't work until this is fixed.

**F9 — WebRTC helpers are frozen by a stale closure.** [verified]
Socket listeners are registered in a `useEffect` with `[]` deps (`useStash.js:162-496`, with an `eslint-disable` at 495). The socket-level handlers correctly read `roomRef.current.id` — a ref added specifically to dodge this problem — but the WebRTC helpers were never converted and still read `room.` directly. They permanently capture the **first render's** empty room object (`useStash.js:87-94`):
- `useStash.js:1169` — `room.files.find(...)` always searches `[]`, so P2P progress never advances past 0%.
- `useStash.js:1197, 1207, 1224, 1249` — `roomId: room.id` emits `""`, so the backend has no room to relay into.

The fix was applied inconsistently — half the code uses the ref, half doesn't.

**F10 — Unbounded memory leaks in the P2P path.** [verified]
- **`window` pollution, never cleaned:** `useStash.js:1131, 1139` attach `window['p2p_resolve_' + fileId]` and `window['p2p_reject_' + fileId]` per download attempt. There is no `delete window[...]` anywhere in the file. Each closure retains a `Blob`/chunk array — unbounded growth over a session.
- **Peer connections never closed:** `cleanupPC` (`useStash.js:1124-1129`) deletes `activePeerConnections.current[fileId]`, but connections are stored under `[uploaderId]` (`useStash.js:1163`) and `[senderId]` (`useStash.js:1219`). **The keys never match**, so no `RTCPeerConnection` is ever closed by the timeout path.
- **Uncleared `setInterval`:** the backpressure poller in `streamFileBufferP2P` (`useStash.js:1285-1290`) polls `channel.bufferedAmount` forever if the data channel closes mid-transfer.
- **Uncleared `setTimeout`s** that fire after unmount: `useStash.js:168, 965-968, 1003-1009, 1077-1084`.

**F11 — No `res.ok` checks on 9 of 10 fetch calls.** [verified]
`useStash.js:503, 545, 614, 639, 680, 734, 763, 785, 1360` each call `await res.json()` directly. A 500 that returns an HTML error page throws a confusing `SyntaxError` instead of surfacing the real message. Only `deleteFile` (`useStash.js:1311`) checks `res.ok`. There's also no `AbortController` anywhere, so a slow response for room A can land after the user switches to room B and overwrite state.

**F12 — Server-side in-memory state leaks and resets.** `roomClipboards` (`server.js:30`) is never cleaned up when a room is deleted or empties — it grows unbounded for the process lifetime. Both it and `roomHosts` vanish on restart.

**F13 — Routing is broken in both directions.** [verified]
`useStash.js:833-841` changes the URL with `history.pushState` on every room change, but `pushState` **does not fire `popstate`** — and `App.jsx:8-15` only listens for `popstate`. So `App`'s `currentRoute` never updates when switching rooms. Consequences:
- **Back button desynchronizes URL from state.** Back fires `popstate` → `App` re-renders, but `useStash`'s room state is untouched (its mount effect has `[]` deps, `useStash.js:810-830`).
- **There is no 404.** `App.jsx:21-27` rewrites any unrecognized path to `/rooms<path>`, so `/nonsense` silently becomes room `nonsense`.
- **Landing links are broken.** `Landing.jsx:297, 367, 739` link to `/rooms` (no trailing slash or ID), which `useStash.js:812` doesn't match (`startsWith("/rooms/")`), silently falling through to `fetchDefaultRoom()`.
- Room ID parsing is a magic offset — `path.substring(7)` (`useStash.js:813`) hardcoded to the length of `"/rooms/"`.

---

### 😤 UX problems

**U1 — Destructive actions have no confirmation and no undo.** Deleting a file is one click (`FileCard.jsx`) → immediate S3 delete. No confirm dialog, no undo toast. By contrast, room deletion *does* have a dialog — so the app is inconsistent about which destructive actions it guards.

**U2 — File ownership is decided by localStorage, so the delete button lies.** `FileListFeed.jsx:16-19` decides "is this my file" by checking whether the file ID is in the `stash_my_uploads` localStorage array. Clear your browser data and you lose the delete button on your own files; more importantly the server has **no ownership check at all** on delete (`controller.js:562`), so any room member can delete anyone's files by calling the API directly.

**U3 — The primary loading state is never rendered.** `status.isLoading` is set throughout `useStash.js` but **read nowhere** in any page or component [verified]. While a room is loading, users see the "Feed is empty" empty state — a false empty state that reads as a broken room.

**U4 — Empty and error states are thin.** "Feed is empty" is a bare line of text with no guidance, and it appears both when the room is genuinely empty and when it's still loading (U3) or failed to load.

**U5 — Socket disconnects are invisible.** Connection loss is only `console.log`'d (`useStash.js:162-179`). There's no "reconnecting…" indicator, so a user whose socket dropped sees a silently stale room.

**U6 — Clipboard sync has no privacy affordance.** Copying syncs to everyone in the room instantly, and "Clear board" wipes history for all members with no confirmation. Nothing warns the user before their first sync that clipboard content leaves their device.

**U7 — Advanced upload options are hidden behind a 10px disclosure.** Password protection, expiry, and burn-after-download — the app's actual differentiators — live behind a tiny "Advanced Settings" toggle (`UploadForm.jsx:195-206`). Most users will never find the features the product is built around.

**U8 — Nothing shows when a room or file expires.** "Ephemeral" is the core promise, and there is no countdown or expiry indicator on the room. The data (`expires_at`) is already in the API response — it just isn't surfaced.

**U9 — Kicked/denied users get no explanation** and no path to re-request access.

**U10 — QR codes are generated by hotlinking `api.qrserver.com`** (`AppPage.jsx:467, 879`), which sends every room URL to a third party and breaks entirely on LAN-only or offline use — the exact scenario this app targets.

**U11 — Voice note upload failures are silent.** `VoiceRecorder.jsx` discards the boolean returned by `onUpload`, so a failed recording upload shows no error.

---

### 🎨 UI problems

**V1 — 40 invalid Tailwind color classes across 9 files.** [verified against compiled CSS]
Classes like `text-slate-650`, `bg-red-550`, `text-slate-450`, `bg-orange-550`, `border-slate-205` don't exist — Tailwind's scale is 50/100/200/.../900. I confirmed these compile to **nothing**: `dist/assets/index-*.css` contains **zero** occurrences of every one of them, while a valid class like `slate-500` is present.

Full breakdown (40 occurrences): `slate-650` (11×), `slate-750` (5×), `slate-550` (4×), `slate-850` (3×), `red-550` (3×), `slate-655` (2×), `slate-55` (2×), `slate-450` (2×), `red-650` (2×), and one each of `slate-855`, `slate-805`, `slate-350`, `slate-255`, `slate-205`, `orange-550`. Affected files: `FileCard.jsx`, `Sidebar.jsx`, `UploadForm.jsx`, `AppPage.jsx`, `FileListFeed.jsx`, `ClipboardFeed.jsx`, `GateScreen.jsx`, `VoiceRecorder.jsx`, `ScreenShare.jsx`.

**Impact:** those elements silently inherit whatever color they'd otherwise have. Some text ends up near-invisible; many hover states do nothing. This single fix will change how the app looks more than any other item in this document.

**V2 — 806 KB JS in one chunk (254 KB gzip).** [verified from build output] No code splitting, no lazy loading, both animation libraries bundled. Vite explicitly warns about it on every build.

**V3 — Fonts are loaded twice, incorrectly.** Geist is bundled via `@fontsource-variable/geist`, *and* `index.css:3` `@import`s Inter + JetBrains Mono from Google Fonts. That's ~90 KB of unnecessary font data, a render-blocking external request, and an invalid `@import` position that produces a build warning [verified].

**V4 — No accessibility work has been done.** Zero `aria-label` attributes in application code. The app is largely icon-only buttons that rely on `title`, which is not an accessible name. Clickable `<div>`s are used instead of `<button>` in several places (image zoom, audio seekbar, the upload dropzone itself — `UploadForm.jsx:141-153`, whose `<input>` is `hidden`, making upload unreachable by keyboard). No focus-visible styles on custom buttons, no focus trap in the custom image-zoom modal, no skip link, no `prefers-reduced-motion` handling despite infinite marquee/parallax/pulse animations.

**V5 — Touch targets are too small.** Icon buttons use `p-0.5`/`p-1` (≈20–28 px) and several action buttons are `h-6` (24 px), against a 44 px guideline.

**V6 — Mobile mode-switching is hidden.** The Files/Clipboard/Screen-share switcher lives only in the sidebar, which is behind a hamburger on mobile. Meanwhile `ActionBar.jsx` — a bottom mode switcher that would solve this — is **dead code, never imported**.

**V7 — Dark mode is defined but unreachable.** `index.css` ships a complete `.dark` token set and `next-themes` is installed, but nothing ever toggles the class. Meanwhile `ui/sonner.jsx` hardcodes `theme="dark"`, so toasts render dark on a permanently light UI.

**V8 — Placeholder metadata will ship.** `index.html` declares `og:url` and `canonical` as `https://stash.app/` (a domain you don't own), and `og:image`/`twitter:image` point at a 465-byte SVG, which most social scrapers won't render.

**V9 — The PWA manifest is incomplete.** `manifest.webmanifest` declares `display: standalone` with a single 48×48 SVG icon — Android requires 192px and 512px PNGs to offer installation — and there's no service worker, so there's no offline capability [verified].

**V10 — Landing page copy overstates the product.** "No Size Limits" (contradicted by the 100 MB cap shown in the upload form), "no cloud" (there is a cloud fallback, and it's the default path), plus hardcoded fake stats in the mockup. `Landing.jsx:597` also calls `Math.random()` during render, which ESLint flags as a purity violation.

**V11 — Dead code ships in the repo.** `ActionBar.jsx` (76 lines) and `SettingsDrawer.jsx` (253 lines) are never imported. `SettingsDrawer` carries an entirely different visual language (dark theme, blue accents, `window.confirm`) — a landmine if anyone re-enables it.

---

### 🧱 Code quality

**C1 — God objects.** `useStash.js` is **1,512 lines** mixing HTTP calls, socket lifecycle, WebRTC signaling, IndexedDB persistence, room state, upload progress, and toasts. `AppPage.jsx` is **1,326**. `Landing.jsx` is **771**. `FileCard.jsx` is **679**. `controller.js` is **1,020**. This is why bugs like F1 survive: no one can hold these files in their head.

**C2 — `eslint .` fails: 56 problems (50 errors, 6 warnings) on a clean checkout.** [verified]
Breakdown: 37 unused variables, 8 `react-hooks/set-state-in-effect`, 6 `react-hooks/exhaustive-deps`, 2 `react-refresh/only-export-components`, 1 `no-empty`, 1 `react-hooks/immutability`, 1 `react-hooks/purity`. The `set-state-in-effect` and `exhaustive-deps` warnings are the ones most likely hiding real render-loop and stale-closure bugs. CI is impossible until this is green.

**C3 — Unguarded `JSON.parse` of localStorage** in at least three places (`useStash.js:30, 649, 923`). One corrupted key permanently bricks the app for that user with no recovery path.

**C4 — No error boundary** anywhere (`main.jsx`). Any render error white-screens the entire app.

**C5 — Duplicated authorization logic.** The identical room-auth block (`hasNoSecurity` / `isHost` / `isAuthorized`) is copy-pasted **five times** in `controller.js` (lines 146-154, 348-356, 513-521, 583-591, and again in `auth.js:63-78`). Five copies of security-critical logic is five places to forget a fix — and indeed `getPreview`'s copy is the one missing the password check (S6).

**C6 — Dead code.** `db.js` + `stach.db` + `inspect_db_temp.js` (which contains a leftover `ALTER TABLE` experiment), `ActionBar.jsx` (76 lines, never imported), `SettingsDrawer.jsx` (253 lines, never imported, carries the abandoned dark theme and `window.confirm`), unused Vite scaffold assets, ~37 unused imports.

**C7 — Magic numbers throughout.** `3153600000000` (~100 years), 30 clipboard items, 5 rooms, 10 files, 50 MB JSON limit, 100 MB file limit, 600 s signed URLs, 1440-minute default expiry, P2P's `15 * 1024 * 1024` size cap, `1500` timeout, `16384` chunk size, `1048576` backpressure threshold — none named, none configurable.

**C8 — No formatter, no pre-commit hooks, no `.env.example`, no `.dockerignore`** (so `docker build` copies `.env` and `node_modules` into the image).

**C9 — Debug logging in production paths**, including `console.log("UPLOAD: Resolved room_id to:", room_id)` (`controller.js:120`), plus 12+ leftover console statements in `useStash.js`, `FileCard.jsx`, `ScreenShare.jsx`, `VoiceRecorder.jsx`.

**C10 — No error boundary anywhere.** [verified] `main.jsx` has none. Any render-time throw (the F1 TypeError is one wrong code path away from reaching render) white-screens the entire app with no recovery.

**C11 — Cross-component communication via global DOM events.** `useStash.js:208, 248, 268, 278, 328` dispatch `CustomEvent`s on `window`, consumed at `AppPage.jsx:160, 171-173`, `GateScreen.jsx:30-31`, `SettingsDrawer.jsx:36`. Untyped, untestable, and they leak across component instances.

**C12 — Duplicated logic.** `getMediaType` (`FileCard.jsx:5-73`) vs `getFileCategory` (`FileListFeed.jsx:21-46`) — same extension arrays, divergent rules; `formatBytes` duplicated with different zero-cases (`"0 B"` vs `"0 Bytes"`); `readAllEntries` byte-identical in `AppPage.jsx:224-242` and `UploadForm.jsx:53-71`; the notification-permission request block appears twice.

**C13 — Index-as-key in lists.** Worst case `ClipboardFeed.jsx:71-72` — `.slice().reverse().map((item, i) => key={i})`, so keys invert whenever an item is prepended, causing full remounts. Also `VoiceRecorder.jsx:183`, `Landing.jsx:413, 443, 503, 660, 693`.

**C14 — `handleDownloadInitiation` used before declaration** — `AppPage.jsx:330` calls it inside a `useEffect`; it's declared at `AppPage.jsx:440`. Works at runtime only because effects run after render; flagged as a hard error by `react-hooks/immutability`.

---

### 🏗️ Architecture

**A1 — There is no real authentication model.** Every "security" check reduces to a client-supplied string. There is no user, no session, and no server-issued credential that the client can't forge. This is the root cause of S1, S2, S5, and U2 — they're symptoms, not separate bugs.

**A2 — Two sources of truth for room hosting.** The database has `creator_socket_id`; Socket.io has an in-memory `roomHosts` Map populated by client claims. They can disagree, and only one survives a restart.

**A3 — No API client layer.** `fetch` calls are inlined throughout `useStash.js` with duplicated header construction, hand-rolled error parsing, and no cancellation — so navigating away mid-request leaves promises resolving into unmounted components.

**A4 — Two client-side caches with no invalidation.** IndexedDB `files_cache` and localStorage `stash_my_uploads` overlap, and neither is ever pruned.

**A5 — The "hybrid P2P" architecture does not work at all.** P2P file transfer is unreachable due to an event-name mismatch (F8), frozen by a stale closure (F9), and leaks peer connections (F10) — and even once those are fixed, STUN-only ICE (F7) would still fail behind common NATs. Every download silently pays a 1.5s P2P timeout before falling back to cloud. The honest description of the current architecture is "cloud file sharing with a broken P2P optimization attached."

**A6 — Server-side state prevents horizontal scaling.** See F8 / the Redis note in Part 1.

---

## Part 4 — Where this should go

### The strategic read

Stash currently has **eight half-features** (file sharing, rooms, passwords, burn-after-read, clipboard sync, screen share, P2P transfer, voice notes) and **zero fully-trustworthy ones**. As a startup, that's the core problem: nothing here is yet good enough that a stranger would rely on it, and the breadth is what's preventing depth.

The strongest version of this product is **narrow and genuinely secure**: *"Drop a file, get a link, it disappears. No account. Works on your local network without touching the internet."* That's a real, differentiated product. Screen sharing and P2P WebRTC are not what make it valuable — and they're consuming most of the complexity budget.

**Recommendation: cut scope to the core, make the core excellent, then re-expand deliberately.**

### Phase 0 — Stop the bleeding (2–3 days)

Non-negotiable before this is exposed to any real user.

1. **Fix F1** (one-line `options = {}` default) — drag-drop and paste are the product's main interactions and they don't work.
2. **Fix S3** — set `trust proxy`, and stop deriving room identity from IP by default. This is the "every user shares one room" bug.
3. **Fix S1/S2** — issue a real host secret at room creation, never return it in `getRoomDetails`, and remove the `'system'` bypasses.
4. **Fix S4** — require a room token in the socket handshake; stop broadcasting clipboard history to unauthenticated sockets.
5. **Fix S6** — check password, download count, and expiry in `getPreview`.
6. **Add** `helmet` + `express-rate-limit`; **remove** the stack trace leak (S11); **run** `npm audit fix` (S14).
7. **Fix D5** — atomic download counter, so burn-after-read actually works.

### Phase 1 — Make it honest (3–5 days)

8. Delete SQLite, `inspect_db_temp.js`, `ActionBar.jsx`, `SettingsDrawer.jsx`, unused imports and assets.
9. Commit `schema.sql` with FKs, indexes, and `timestamptz`; enable RLS; move cleanup to `pg_cron`.
10. Hash `stack_key`; use `crypto.randomInt`; add expiry to access tokens; enforce `stack_key_expires_at` or remove the column and stop advertising it.
11. Fix the false success toasts (F1's second half) and surface per-file upload failures.
12. Guard every `JSON.parse` of localStorage; add an error boundary.

### Phase 2 — Make it feel real (1 week)

13. **Fix the 40 invalid color classes** — highest visual impact per minute of work in the entire document.
14. Add React Router; get deep links, back button, and 404 working.
15. Confirmation + undo on file delete; real server-side ownership checks.
16. Real loading states (wire up the `isLoading` that already exists), real empty states, a reconnecting indicator.
17. **Surface expiry in the UI** — a countdown on rooms and files. The data already exists and it's the most on-brand feature you're not showing.
18. Promote password / expiry / burn-after-read out of the hidden "Advanced" panel — these are the product, not an afterthought.
19. Cut one animation library; add code splitting; drop the Google Fonts import; generate QR codes client-side.
20. Accessibility pass: `aria-label`s on icon buttons, real `<button>` elements, focus-visible styles, keyboard-reachable upload.

### Phase 3 — Make it maintainable (1–2 weeks)

21. TypeScript at the seams: extract an API client module, type it and `useStash`'s return value.
22. Split `useStash.js` into `useRoom`, `useFiles`, `useSocket`, `useClipboard`, `useWebRTC`. Split `AppPage.jsx` by mode.
23. Extract the five duplicated authorization blocks into one middleware.
24. Vitest tests for token signing/verification, the authorization middleware, and the room lifecycle. Playwright for the upload → download → burn flow.
25. GitHub Actions: lint → test → build. Get ESLint to zero.
26. Presigned direct-to-storage uploads; redirect downloads to signed URLs.
27. `.env.example`, `.dockerignore`, Prettier, pre-commit hook.
28. Move the backend to a host with persistent WebSockets (Railway / Fly / Render).

### Phase 4 — Product direction

**Features worth adding (high value, low complexity):**
- **Expiry countdown UI** — already-collected data, strongest brand fit.
- **Text/snippet sharing as a first-class object**, not just clipboard sync. Pasting a code snippet and getting a link is a genuinely useful, cheap feature.
- **Room activity log** — "3 files, 2 downloads, expires in 4h."
- **Bulk download** as a zip of a whole room (the zip machinery already exists).
- **"Local-only mode"** — a real, verifiable LAN mode that never touches Supabase. This is the most defensible differentiator against WeTransfer/Dropbox, and the app is already half-built for it.
- **Progressive Web App completion** — service worker + proper icons. For a "quick share between my devices" tool, installability matters.

**Features to freeze or cut:**
- **P2P WebRTC file transfer — cut it, at least for now.** It is not "partially working": it is unreachable (F8), frozen by a stale closure (F9), leaking connections (F10), and has no TURN server (F7). Right now it costs every user a 1.5s timeout on every small download in exchange for nothing. Either delete it and reclaim the latency, or commit properly — fix the event mismatch, use the ref, add TURN, add fallback UX, and test on a real mobile network. Do not leave it in its current state.
- **Screen sharing** — the most complex feature and the least connected to the core promise. Freeze it.
- **Voice notes** — keep only if stable; it's cheap and reasonably on-theme.

**Structural changes:**
- **Rethink IP-derived rooms.** The idea (zero-setup LAN sharing) is genuinely good, but hashing an IP is the wrong mechanism — it's what causes S3. Consider explicit short room codes, or a proper local-network discovery mode.
- **Decide what "ephemeral" means and enforce it consistently.** Right now rooms expire in 24h (except the cleanup is broken), files default to 1440 minutes, and access keys claim to expire but never do.

---

## Part 5 — Things you didn't ask about, that I'd flag anyway

1. **`backend/.env` is not in git** [verified — checked the full history, no secrets were ever committed]. That's good. But `SUPABASE_SECRET_KEY` is a **service-role key**, which bypasses all RLS. It's also being reused as the HMAC signing secret. Separate these: one key for Supabase, a distinct `TOKEN_SECRET` for signing.

2. **There is no `.dockerignore`**, so `docker build` copies `.env` and `node_modules` into the image. If that image is ever pushed anywhere, the service-role key goes with it. **Fix this before building any image you plan to publish.**

3. **No backups.** Everything lives in one Supabase project with no export, and Phase 0–1 involves schema changes. Take a backup first.

4. **Git hygiene.** Recent commits are `"fix"` and `"new upadate"`. For a startup codebase that other people will eventually read (including investors doing technical diligence, and future hires), conventional commits and small PRs pay for themselves quickly.

5. **The `stach.db` typo** is in the committed filename and in `db.js`. Deleting the SQLite layer resolves it.

6. **No license file.** If this is going public, pick one deliberately.

7. **`PANEL_QUESTIONS.md`, `PRESENTATION_GUIDE.md`, and `PROJECT_DETAILS.md` describe features and architecture that don't match the code** — `PROJECT_DETAILS.md` describes `db.js` as "Postgres helper configurations" when it's dead SQLite. Documentation that contradicts the code is worse than no documentation; either update these or move them out of the repo root.

8. **Version numbers are `1.3.0` in both packages** but nothing is released and there are no tags. Either start tagging releases or reset to `0.x` to reflect reality.

---

## Summary

| Question | Answer |
|---|---|
| **Is the tech stack right?** | **Yes.** React + Vite + Express + Socket.io + Postgres is appropriate. Add TypeScript, cut redundant dependencies, delete SQLite. Don't rewrite. |
| **Is the database right?** | **Yes — Postgres is correct.** But it has no migrations, no schema in the repo, plaintext room keys, no foreign keys, a racy counter, and cleanup running on the request path. Fix the schema, keep the engine. |
| **What's the single worst bug?** | Drag-and-drop and paste uploads are completely broken and report success (F1). One-line fix. |
| **What's the single worst security issue?** | Tie: host identity is a client-supplied string the server hands out (S1), and IP-derived rooms collapse into one shared global room in production (S3). |
| **What's the highest-impact visual fix?** | Replacing the 40 invalid Tailwind color classes that currently compile to nothing (V1). |
| **What should we cut?** | P2P WebRTC file transfer (it's unreachable dead code costing every download 1.5s) and screen sharing. Freeze both until the core is trustworthy. |
| **Where should the product go?** | Narrow to "secure ephemeral file drops that work on your local network," make that genuinely excellent, then re-expand. |

**Overall assessment:** the ambition and feature breadth here are real, and several hard things (socket-based room sync, on-the-fly zipping, signed-URL previews, screen-share signaling) are wired up and working. But the gap between what the app claims and what it does is wide: the security model is built on client-supplied trust, the two flagship upload interactions silently don't work while reporting success, the P2P feature is unreachable dead code, and in production every user would land in the same shared room. Phase 0 is roughly three days and fixes the items that would actually hurt a real user.

**If you only do three things:** add `options = {}` at `useStash.js:869` (restores drag-drop and paste), set `trust proxy` and stop deriving rooms from IP (stops all users sharing one room), and stop returning `creator_socket_id` from `getRoomDetails` (closes the room-takeover hole).

*Audit performed 2026-08-10 against commit `6b26c0e`.*
