# Stash: Project Details, Architecture, & Core Concepts

Stash is an ephemeral, room-based file-sharing, live screen/webcam broadcasting, and real-time synchronized clipboard platform. It features a hybrid transmission system combining **direct Peer-to-Peer (P2P) WebRTC connections** for zero-cloud bandwidth costs with a secure **Supabase Cloud fallback** for offline storage.

---

## 1. Directory Tree & File Manifest

The application codebase is structured as a monorepo containing distinct `frontend` and `backend` services:

```text
Stash/
├── backend/
│   ├── migrations/
│   │   └── 001_hash_room_keys_and_atomic_downloads.sql
│   ├── src/
│   │   ├── utils/
│   │   │   ├── auth.js            # Room & host token signing, verification, access middleware
│   │   │   ├── errors.js          # AppError class & global express handler
│   │   │   └── limiter.js         # express-rate-limit configurations
│   │   ├── controller.js          # REST controllers (rooms, file uploads, previews, auth)
│   │   ├── routes.js              # Express endpoint bindings
│   │   ├── server.js              # Express app init, CORS policy, Socket.io events, cleanup timer
│   │   ├── state.js               # Shared in-memory room/clipboard maps
│   │   ├── supabase.js            # Supabase SDK instance
│   │   ├── upload.js              # Multer configuration (100MB x 10, memory storage)
│   │   ├── cors.test.js           # CORS origin policy tests
│   │   └── utils/auth.test.js     # Token signing/verification tests
│   ├── schema.sql                 # Postgres schema, indexes, RLS, claim_download()
│   ├── .env.example               # Required configuration template
│   ├── Dockerfile                 # Production backend container build file
│   └── package.json               # express, socket.io, supabase-js, bcryptjs, vitest
│
└── frontend/
    ├── src/
    │   ├── assets/                # CSS vectors & brand assets
    │   ├── components/            # Isolated React UI components
    │   │   ├── ui/                # Base design system components (sidebar, dialog, etc.)
    │   │   ├── ClipboardFeed.jsx  # Synced clipboard history list
    │   │   ├── ErrorBoundary.jsx  # Top-level render error trap
    │   │   ├── FileCard.jsx       # Card element representing shared files & custom audio player
    │   │   ├── FileListFeed.jsx   # List container managing file lists and download progress states
    │   │   ├── GateScreen.jsx     # Security interface (access codes & host approval lobby)
    │   │   ├── QrCode.jsx         # Client-side QR rendering (no third-party service)
    │   │   ├── ScreenShare.jsx    # WebRTC stream casting overlay & controls
    │   │   ├── Sidebar.jsx        # Navigation sidebar for switching rooms
    │   │   ├── UploadForm.jsx     # File drop-zone upload container
    │   │   └── VoiceRecorder.jsx  # Mic capture utility producing WebM audio files
    │   ├── hooks/
    │   │   └── useStash.js        # Core hook coordinating WebSockets, state, and WebRTC
    │   ├── pages/
    │   │   ├── AppPage.jsx        # Main layout dashboard orchestrating view modes
    │   │   ├── Landing.jsx        # Marketing landing page
    │   │   └── Legal.jsx          # Privacy policy and Terms / Acceptable Use
    │   ├── App.jsx                # Routing & root React state bindings
    │   ├── index.css              # Design system stylesheets
    │   └── main.jsx               # Entry-point bootstrap rendering index.html root
    ├── .env.example               # VITE_BACKEND_URL and TURN configuration
    ├── vite.config.js             # Vite configurations (bundler, ports, aliases)
    └── index.html                 # Main SPA HTML structure
```

---

## 2. Comprehensive REST API Specifications

All HTTP REST endpoints operate under the host address `/api` (dev port `3000`).

| HTTP Method | Endpoint | Headers Required | Request Payload / Params | Response Payload (Success) | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/rooms` | `x-host-id` (grouping only) | `body: { id, name, description, is_protected, accept_only, password }` | `{ status: 'success', data: { room, token, host_token } }` | Creates a room. Returns the host token (store it — it is the only proof of ownership) and, if protected, the plaintext access code **once**. |
| **GET** | `/rooms/:room_id` | `x-host-token`, `x-room-access-token` | `params: { room_id }` | `{ status: 'success', data: { room } }` | Fetches room parameters. Protected/accept-only rooms return `403` with minimal metadata when unauthorized. Never returns `creator_socket_id` or the access code. |
| **POST** | `/rooms/:room_id/join` | None | `body: { password }` | `{ status: 'success', data: { token } }` | Verifies the access code against its bcrypt hash and enforces its expiry. Returns a signed room access token. |
| **POST** | `/rooms/:room_id/update` | `x-host-token` | `body: { name, description, is_protected, accept_only, password }` | `{ status: 'success', data: { room } }` | Updates room configuration. Returns a new plaintext code only if this call set one. |
| **POST** | `/rooms/:room_id/rotate-key` | `x-host-token` | `params: { room_id }` | `{ status: 'success', data: { room } }` | Rotates the 6-digit access code and returns the new one once. |
| **DELETE** | `/rooms/:room_id` | `x-host-token` | `params: { room_id }` | `{ status: 'success', data: { message } }` | Purges a room and all files linked to it from database & object bucket. |
| **GET** | `/room` | None | None | `{ status: 'success', data: { room_id } }` | Auto-discovery route. Resolves caller public IP and returns the hashed room ID. |
| **GET** | `/files/:room_id` | `x-room-access-token` | `params: { room_id }` | `{ status: 'success', data: { files } }` | Fetches lists of active files in that room. Passes through `checkRoomAccess` guard. |
| **POST** | `/upload` | `x-room-access-token` | `multipart/form-data: { files, roomId, expiresHours }` | `{ status: 'success', data: { files } }` | Parses files via Multer and streams them directly into Supabase Storage under room-scoped folders. |
| **GET** | `/preview/:id` | `x-room-access-token` | `params: { id }` | `{ status: 'success', data: { url } }` | Generates a 10-minute temporary S3 signed download/preview URL for images/videos/audios. |
| **POST** | `/download/:id` | `x-room-access-token` | `params: { id }` | `{ status: 'success', data: { url } }` | Increments file's `download_count`. If burn-after-download is set and counter matches threshold, triggers file deletion. |
| **DELETE** | `/files/:id` | `x-room-access-token` | `params: { id }` | `{ status: 'success', data: { id } }` | Deletes file metadata from Postgres and purges source object binary from Supabase bucket. |

---

## 3. Real-Time WebSocket Event Flows (Socket.io)

WebSockets manage live messaging, room state updates, signaling metadata, and access approval loops:

```mermaid
sequenceDiagram
    participant Guest as Guest Client
    participant Server as Socket.io Server
    participant Host as Host Client

    Guest->>Server: join-room { roomId, clientId }
    alt Room is Accept-Only
        Server->>Host: join-request { guestSocketId, guestClientId, guestName }
        Note over Host: Host clicks "Approve"
        Host->>Server: join-approve { roomId, guestSocketId, guestClientId }
        Server->>Guest: join-approved { token, roomId }
        Note over Guest: Guest joins room channel
    else Room is Public / Key Verified
        Server->>Guest: join-approved { token, roomId }
    end
```

### Event Manifest & Payloads
*   `"join-room"` (Client ➔ Server): Sent when connecting. Payload: `{ roomId, clientId, isHost }`. Adds socket to room channel.
*   `"join-request"` (Server ➔ Host): Relays waiting guest information to host. Payload: `{ roomId, guestSocketId, guestClientId, guestName }`.
*   `"join-approve"` (Host ➔ Server): Sent by host to approve access. Payload: `{ roomId, guestSocketId, guestClientId, hostId }`.
*   `"join-approved"` (Server ➔ Guest): Informs guest they are approved and provides access token. Payload: `{ token, roomId }`.
*   `"join-deny"` (Host ➔ Server) & `"join-denied"` (Server ➔ Guest): Informs waiting guest they were rejected.
*   `"file-added"` (Server ➔ Room): Broadcast when a user uploads files, prompting others to append them to local state. Payload: `{ files }`.
*   `"file-deleted"` (Server ➔ Room): Broadcast when a file is deleted. Payload: `{ id }`.
*   `"clipboard-send"` (Client ➔ Server ➔ Room): Distributes copied text snippet to other room members. Payload: `{ text }`.
*   `"clipboard-clear"` (Client ➔ Server ➔ Room): Commands all clients in room to wipe active shared clipboard cache.
*   `"screen-share-start"` (Presenter ➔ Server ➔ Room): Broadcasts that a user has initiated a video stream. Payload: `{ roomId }`.
*   `"screen-share-signal"` (Client ➔ Server ➔ Target): Relays WebRTC SDP offers/answers or ICE candidates between presenter and viewer. Payload: `{ targetId, signal }`.
*   `"screen-share-stop"` (Presenter ➔ Server ➔ Room): Broadcasts stream end, shutting down peer connections. Payload: `{ roomId }`.
*   `"room-updated"` (Server ➔ Room): Broadcasts room setting changes or rotated passkeys. Payload: `{ id, name, description, is_protected, accept_only, has_stack_key, stack_key_expires_at, stack_key }`.

---

## 4. Key Architectural Engineering Details

### A. WebRTC P2P Data Channel Chunking
Because `RTCDataChannel` enforces maximum packet limits (usually 64KB, but capped at **16KB** for cross-browser safety), transferring a file requires fragmenting the buffer:
1.  **Read file**: The uploader browser reads the file as an `ArrayBuffer` using `FileReader`.
2.  **Fragmenting**: Slices the buffer into blocks:
    ```javascript
    const chunkSize = 16384; // 16KB
    let offset = 0;
    while (offset < file.size) {
        const chunk = fileData.slice(offset, offset + chunkSize);
        dataChannel.send(chunk);
        offset += chunkSize;
    }
    dataChannel.send("EOF"); // End of File signal
    ```
3.  **Assembly**: The downloader browser receives chunks in `dataChannel.onmessage` events, appends them to a memory array, and on receiving `"EOF"`, instantiates `new Blob(receivedChunks)` to download the file directly from memory.

### B. Access Token Cryptography (HMAC-SHA256)

There are **two** kinds of token, both signed statelessly with `TOKEN_SECRET`
(required at boot; the server exits if it is missing or under 32 chars).

**Room access tokens** grant entry to a room and expire after 24 hours:

```javascript
export const generateRoomToken = (roomId, clientId) => {
    const payload = `${roomId.trim()}:${clientId.trim()}:${Date.now()}`;
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    return `${payload}:${signature}`;
};
```

**Host tokens** (`host:<roomId>:<ts>:<sig>`) prove room ownership and are issued
once, at room creation. Every host-only operation — update settings, rotate key,
delete room — requires one.

Verification recomputes the HMAC and compares with `crypto.timingSafeEqual`,
asserts the token's `roomId` matches the URL parameter, checks the timestamp for
room tokens, and checks the `host:` prefix so the two token types can never be
substituted for one another.

**Why host tokens exist:** ownership was previously asserted with an
`x-host-id` header whose value the client generated in `localStorage`. Anyone
who learned a room's creator id could send it and take over the room. That id is
still sent, but only to group rooms for the per-creator room cap — it grants no
authority.

Room access codes are stored as bcrypt hashes. The plaintext code is returned
exactly once, to the creator, and is not recoverable afterwards.

### C. Voice Recorder Chromium WebM Duration Workaround
WebM streams created by browser microphones using `MediaRecorder` do not write duration metadata indices since the duration is unknown during recording. Chrome reads this duration as `Infinity`. We solve this on load with a seek-scan trick:
```javascript
const onLoadedMetadata = () => {
    if (audio.duration === Infinity) {
        // Seek to near-infinite time (10^101 seconds)
        audio.currentTime = 1e101;
        audio.ontimeupdate = function() {
            this.ontimeupdate = null; // Unbind to prevent loop
            audio.currentTime = 0;    // Reset to beginning
            setDuration(formatTime(audio.duration)); // Duration is now computed!
        };
    }
};
```

---

## 5. UI/UX & Styling Token Implementations

Stash is styled with a sleek glassmorphic theme inside [index.css](file:///c:/Users/HP/Desktop/codding%20projects/Stash/frontend/src/index.css):
*   **Palette**: Main background is deep `#07070a` / `#0a0a0f`, cards render at `#111118`, and hover borders utilize `white/[0.06]` to represent specular glass edges.
*   **Glow Accents**: Primary action buttons, ranges, and notifications utilize indigo (`#6366f1` / `text-indigo-400`).
*   **Animations**: Custom fade-ups (`animate-fadeUp`) and recording pulse shadows (`animate-recording`) provide responsive UI feedback.
*   **Micro-interactions**: Hover events trigger translation scale adjustments (`hover:scale-105`), and deleting a file replaces the trash icon with an active rotating spinner loading state.
