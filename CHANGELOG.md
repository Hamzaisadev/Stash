# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-11-10

A security, honesty and interface release. Room keys are no longer stored in plaintext, the
server refuses to start without a signing secret, the landing page no longer makes claims the
code does not support, and the app interface was rebuilt rather than restyled.

**This release contains breaking changes and requires a database migration and new environment
variables.** See [Upgrading](#upgrading-to-200) below.

### Security

- **Removed the hardcoded token signing fallback.** `TOKEN_SECRET` was defaulting to a literal
  string in source, so anyone with the repository could mint valid room tokens. The server now
  exits at boot if `TOKEN_SECRET` is missing or shorter than 32 characters.
- **Room keys are hashed.** `rooms.stack_key` stored the room password in plaintext; it is
  replaced by `rooms.stack_key_hash` (bcrypt, cost 10). Verification is constant-time.
- **Host actions are authenticated.** Deleting files, rotating keys, kicking members and
  changing room settings were authorized by a client-supplied room id alone. They now require
  an HMAC-SHA256 host token (`generateHostToken` / `verifyHostToken`, compared with
  `crypto.timingSafeEqual`) passed as `x-host-token`.
- **CORS actually rejects.** The origin check logged a warning and then allowed the request.
  It now denies origins outside `ALLOWED_ORIGINS`.
- **Socket events are scoped to joined rooms.** Any connected client could emit into any room.
  Handlers are now gated on per-socket `joinedRooms` / `hostOfRooms` sets.
- **Download limits are enforced atomically.** The read-then-increment pattern let concurrent
  requests exceed `max_downloads`. Replaced by a `claim_download` Postgres function that
  claims a slot in a single statement.

### Added

- New landing page, concept **"Toss it across"**: a 2D canvas playground where file chips obey
  real physics and can be flung across the page into a laptop that catches them. Hand-written
  solver (~15 kB) on GSAP's ticker, with a static non-physics layout under reduced motion.
- A 2.5 s intro loader with a **Skip** control, a `sessionStorage` flag so it plays once per
  tab, and a full bypass under reduced motion.
- **The Desk**: the room's file surface is now draggable physical chips with live expiry
  countdowns and fling-to-delete, with positions seeded from the file id so every member sees
  the same arrangement. A keyboard- and screen-reader-friendly **List view** sits behind a
  toggle and is the default on touch and under reduced motion.
- Screen share is presentation-grade: picture-in-picture for viewers, pause, and a live
  resolution readout taken from the track rather than a label.
- Live unread counts on the Files, Clipboard and Screen modes, so activity in one is visible
  from another.
- A designed 404 page, legal pages, `robots.txt`, `sitemap.xml` and an OG image.
- `CHANGELOG.md`, [`ROADMAP.md`](docs/ROADMAP.md) (the next 14 updates), [`DESIGN.md`](docs/DESIGN.md)
  (design system and decisions log) and a `LICENSE`.
- GitHub Actions CI: backend tests, frontend lint and a production build on every push and PR.
- 22 unit tests covering token generation, host verification, key hashing and CORS.

### Changed

- **The app shell was rebuilt, not restyled.** The 260 px permanent sidebar and all eight
  modals are gone, on a product whose pitch is ten seconds. Rooms are a switcher pill; create,
  join, settings and the room list are inline panels that push content down. Only the QR code
  and the file unlock prompt still float, both deliberately. This deleted ~12 pieces of
  component state and 7 handlers that existed only to drive dialogs.
- **The room link is always on screen.** Sharing was previously two clicks deep inside a
  dialog.
- Join requests are answered inline instead of in a modal, so you can keep working.
- The three modes stay separate. Files persist, clipboard is a running log, screen share is a
  live stream; they are genuinely different surfaces, not three views of one list.
- Design tokens retuned to the landing page's warm paper palette and electric blue, so the
  marketing page and the product read as one thing.
- Room cleanup moved from a per-request check to a 15-minute interval with `unref()`, plus
  graceful shutdown on `SIGTERM` / `SIGINT`.
- Shared `roomHosts` / `roomClipboards` state extracted to `backend/src/state.js`, which also
  broke an ESM circular import between `server.js` and `controller.js`.

### Fixed

- **Honest copy.** The landing page claimed "no cloud", "no size limits ever" and "100% direct
  device transfer". None of these were true: files pass through the server to Supabase storage
  and are not end-to-end encrypted. Every number on the page is now sourced to the code that
  enforces it, and the limits (100 MB per file, 10 files per upload, 24 h rooms) are stated
  plainly alongside a disclosure of what the operator can see.
- Protected rooms read as unprotected after the key rename, because authorization still
  referenced the removed `stack_key` column.
- The 404 page was unreachable: path normalisation rewrote every unknown path to a room id.
- A 1750 ms frame stall while scrolling on mobile, caused by `ResizeObserver` firing as the
  browser chrome slid and changed `svh`-based heights.
- Several contrast failures, unnamed buttons and sub-24 px tap targets. Both the landing page
  and the app now report zero axe violations.

### Performance

| Metric | Before | After |
|---|---|---|
| Initial JS (gzip) | 228 kB | 114 kB |
| Mobile LCP (throttled) | 5040 ms | ~1800 ms |
| CLS (app) | 0.067 | 0.031 |
| axe violations (app) | 11 | 0 |

Achieved by code-splitting the app and legal routes behind `React.lazy`, moving providers out
of the entry bundle, and preloading the hashed Latin font subsets from a Vite plugin.

### Upgrading to 2.0.0

1. **Back up the database.** The migration is destructive.
2. Apply `backend/migrations/001_hash_room_keys_and_atomic_downloads.sql`. It drops
   `rooms.stack_key`, adds `rooms.stack_key_hash`, and replaces `increment_download_count`
   with `claim_download`. **Existing protected rooms become unprotected**, because plaintext
   keys are deliberately not migrated into hashes.
3. Set `TOKEN_SECRET` in `backend/.env` to at least 32 random characters. The server will not
   start without it:
   ```
   node -e "console.log('TOKEN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> backend/.env
   ```
4. Set `ALLOWED_ORIGINS` to your frontend origins, comma-separated. Requests from anywhere
   else are now rejected rather than warned about.
5. Set `VITE_BACKEND_URL` for the frontend build.

### Known limitations

Carried into [`ROADMAP.md`](docs/ROADMAP.md) rather than hidden:

- WebRTC uses STUN only, so peer-to-peer and screen share fail behind symmetric NAT, which
  includes most mobile carriers. A TURN relay is roadmap item 02.
- Uploads stream through server memory, so concurrent 100 MB transfers can exhaust the
  process. Presigned direct-to-storage uploads are item 03.
- Host and clipboard state live in process-local maps, so the backend cannot run more than one
  instance. Redis is item 11.
- Files are not end-to-end encrypted. Opt-in E2EE is item 09.

## [1.3.0] and earlier

Initial implementation: ephemeral rooms, file upload and download, synced clipboard, WebRTC
screen share, voice notes, QR invitations, and automated room cleanup. Not individually
tracked.
