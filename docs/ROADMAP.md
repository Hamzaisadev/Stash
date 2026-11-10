# Stash — the next 14 updates

**Strategy: be genuinely good at one thing.** Stash moves a file between two devices with no
account. Every update below either removes a reason that fails, or makes it better than the
free alternatives (PairDrop, LocalSend, Quick Share). Nothing here chases a feature list.

Ordering is deliberate: **fix what is broken → perfect the handoff → earn trust → do the one
thing nobody else does.** Shipping 09 before 04 would be building on sand.

Sizes are rough solo-developer estimates: **S** ≈ a day, **M** ≈ 2–4 days, **L** ≈ 1–2 weeks.

---

## Phase 1 · Fix what is broken (01–04)

Nothing else matters while the deployed product cannot do its job.

### 01 · Deploy the backend and make the live URL work — **S**
The live site has no backend attached, so nothing can upload. Deploy to a host with
persistent WebSockets (Railway, Fly, Render — not Vercel, not a host that sleeps), set
`TOKEN_SECRET` and `ALLOWED_ORIGINS`, set `VITE_BACKEND_URL` on the frontend, then upload a
file from a phone on cellular.
**Done when:** a stranger on 4G can complete a transfer.

### 02 · Add a TURN server — **S**
All WebRTC uses `stun:` only, so peer-to-peer and screen share fail behind symmetric NAT:
most mobile carriers, many offices. Add a TURN relay (`VITE_TURN_*` is already wired) and
test on a real cellular connection.
**Done when:** screen share works phone-to-laptop on mobile data, not just on one Wi-Fi.

### 03 · Presigned direct-to-storage uploads — **M**
Files currently go browser → server RAM → Supabase, with in-memory zipping. A handful of
concurrent 100 MB uploads will OOM the process. Move to presigned PUT straight to storage;
the server only signs the URL and records metadata. Redirect downloads to signed URLs too.
**Done when:** the server never holds a file body, and the 100 MB cap can rise.

### 04 · Raise the file size limit — **S**
Depends on 03. 100 MB is the lowest cap of any competitor and the most common reason someone
bounces. With direct uploads the ceiling becomes a storage-cost decision, not a memory one.
**Done when:** 1 GB works, and the landing page says so truthfully.

---

## Phase 2 · Perfect the handoff (05–08)

This is the product. Make it the best version of itself.

### 05 · Resumable uploads — **M**
A dropped connection currently loses the whole transfer. Chunked upload with resume turns a
phone walking out of Wi-Fi range from a failure into a pause.
**Done when:** killing Wi-Fi mid-upload and reconnecting finishes the file.

### 06 · Instant pairing: QR, 6-digit code, nearby — **M**
Typing a room name is the slowest step. Make pairing one scan or one short code, entered from
a single always-visible field. Keep LAN auto-discovery, but behind an explicit opt-in rather
than IP hashing.
**Done when:** phone-to-laptop takes under 10 seconds, measured with a stopwatch.

### 07 · Transfer progress people trust — **S**
Per-file speed, time remaining, and a clear done state on both devices. Sending a file to
someone and not knowing whether it arrived is the core anxiety of the category.
**Done when:** the sender can see the receiver got it.

### 08 · Make it installable (PWA) — **M**
Service worker, offline shell, share-target so Stash appears in the OS share sheet. For a
"send this from my phone" tool, being in the share sheet is worth more than any feature.
**Done when:** you can share a photo to Stash from the Android/iOS share menu.

---

## Phase 3 · Earn trust (09–11)

Ephemeral file hosting is only used by strangers if it is visibly trustworthy and visibly
operated.

### 09 · End-to-end encryption, opt-in per room — **L**
The honest disclosure currently reads "whoever runs the server can read what passes through
it." Browser-side AES-GCM with the key in the URL fragment (never sent to the server) removes
that caveat for anyone who wants it. Clearly label which rooms are E2EE, because previews and
server-side zipping stop working inside them.
**Done when:** the landing page can say "we cannot read your files" about E2EE rooms, truthfully.

### 10 · Abuse handling — **M**
An anonymous file host with no takedown path gets abused, and that is how these projects die.
Rate limits per IP, a report button on every room, an abuse queue, and a documented response
time. Unglamorous and load-bearing.
**Done when:** a reported room can be killed in minutes, with an audit trail.

### 11 · Reliability: Redis + monitoring — **M**
Room host and clipboard state are process-local `Map`s, so the server cannot scale past one
instance. Move to Redis with the socket.io adapter, add error tracking and an uptime check.
**Done when:** two backend instances serve the same room correctly.

---

## Phase 4 · The one thing nobody else does (12–14)

Everything above makes Stash as good as the free alternatives. This is the part that makes
someone choose it.

### 12 · Verifiable local-only mode — **L**
A room that provably never touches the internet: LAN-only discovery, direct peer connections,
a visible indicator, and a way for a sceptical user to confirm it (devtools network panel
shows no upload). PairDrop is local-only; LocalSend needs an install. **A browser tab that is
provably local, with no install, is a thing nobody currently offers.** This is the moat.
**Done when:** a security-minded user can verify the claim themselves in 30 seconds.

### 13 · Handoff history on your own devices — **M**
Not an account: a local record, stored in IndexedDB, of what you sent and where. Re-send in
one tap. Keeps the no-account promise while removing the "what was that file called" problem
that makes people fall back to messaging themselves.
**Done when:** you can re-send yesterday's file without re-uploading it.

### 14 · Self-host in one command — **M**
A single `docker compose up` with a documented reverse-proxy config and a one-page setup
guide. The audience that cares about local-only mode is the same audience that wants to run
its own instance, and it is how FOSS tools in this category actually spread.
**Done when:** someone else runs a Stash instance without asking you a question.

---

## What is deliberately not here

- **Accounts, teams, billing.** They contradict the product's premise. If the goal changes to
  revenue, that is a different roadmap aimed at a different buyer (see the B2B path in the
  original audit).
- **Multi-party video / Zoom-style calls.** Screen share is presentation-grade one-way, which
  suits "show me that bug." Real meetings need an SFU and a monthly media bill to compete with
  products that are free.
- **AI features.** There is no problem here that a model solves.

## How to tell if it is working

After 01–08 ship, the numbers that matter: **return rate at 30 days** (under 5% means it is a
feature, not a product), **transfer completion rate** (under 40% means the core loop is
broken), and **unsolicited** requests to self-host or pay. Survey intent is worthless here.
