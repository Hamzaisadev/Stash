# 50 Potential Panel Questions & Answers: Stash

This document contains 50 questions that evaluators or panelists might ask during a project defense, categorized by technical focus areas, along with precise answers.

---

## Category 1: Architecture & Technical Choices (1–10)

### Q1: What is the core problem that Stash solves, and why is it unique?
**A**: Stash addresses the friction of real-time multi-device sharing (files, clipboard, and screen/camera streams) within a temporary collaborative group. Unlike services like Google Drive or Dropbox that require long-term storage configurations and accounts, or Airdrop which is limited to device hardware ecosystems, Stash is fully web-based, zero-install, auto-discovers peers on the local network using hashed IP routing, and runs ephemeral rooms with automated file pruning.

### Q2: Why did you choose a hybrid WebRTC + S3 (Supabase) file transfer system instead of pure P2P?
**A**: A pure P2P WebRTC system requires both devices to be online concurrently. If the sender uploads a file and immediately goes offline or closes their browser, the receiver would never get it. Our hybrid approach attempts P2P first for zero-cloud bandwidth costs and high speed. If the peer is offline or blocked by symmetric NAT, it transparently falls back to Supabase Object Storage.

### Q3: What is the purpose of hashing the user's IP address?
**A**: We use SHA-256 (or MD5) to hash the client's local IP address and use it as a default room ID. This enables "zero-configuration auto-discovery." Users connected to the same Wi-Fi router share the same public/NAT IP, meaning they are automatically routed into the same default local room, allowing instant collaboration.

### Q4: Why Vite instead of Create React App (CRA)?
**A**: Vite uses native ES modules during development, resulting in near-instantaneous dev server startups and Hot Module Replacement (HMR) speeds. It also uses Rollup for highly optimized production builds, whereas CRA is deprecated and uses slower Webpack bundling.

### Q5: How do WebSockets and WebRTC coordinate during screen or webcam sharing?
**A**: WebRTC cannot establish a peer-to-peer connection without an out-of-band signaling mechanism to exchange connection metadata. Socket.io serves as our signaling server. It transfers the SDP (Session Description Protocol) offers, answers, and ICE (Interactive Connectivity Establishment) candidates between peers. Once signaling finishes, the video/audio data streams directly between the browsers, bypassing our backend server.

### Q6: What is S3-compatible storage, and how does Supabase fit in?
**A**: S3-compatible storage refers to cloud object storage APIs that mirror Amazon's Simple Storage Service (S3) protocols. Supabase Storage sits on top of this model, providing simple client and server SDK wrappers to write files to buckets, generate public or signed temporary URLs, and manage storage policies.

### Q7: Why are files deleted automatically? How does the cleanup (pruning) mechanism work?
**A**: Stash is an ephemeral sharing tool, not a cloud backup provider. Storage space is limited. Every file is inserted with an `expires_at` timestamp. During any room detail request, the backend lazily triggers a garbage collection worker that queries Postgres for records where `expires_at < Date.now()` (and `is_locked = false`), deletes the physical files from the Supabase bucket, and then deletes the metadata rows.

### Q8: What database did you use and why?
**A**: We used PostgreSQL (hosted via Supabase). Postgres is an ACID-compliant relation database. It is ideal for storing room records and file metadata because we can enforce foreign key constraints (e.g., deleting a room deletes all its associated files via `ON DELETE CASCADE`), ensuring database integrity.

### Q9: What is glassmorphism and how is it used in the UI?
**A**: Glassmorphism is a modern design aesthetic featuring semi-transparent frosted elements overlaying visual content, styled using backdrop-blur filters, thin white borders representing specularity, and soft drop shadows. We use Tailwind classes like `backdrop-blur-md bg-slate-950/70 border border-white/[0.08]` to style floating stream controls, setting dialogs, and cards.

### Q10: How does the application scale to support multiple active rooms?
**A**: On the HTTP layer, the Express server is stateless. On the WebSocket layer, Socket.io rooms are used to isolate message broadcasts, so client actions (uploads, clipboard syncs) in one room do not leak into others. To scale beyond a single Node process, we could introduce a Redis adapter for Socket.io to share messages across multiple backend instances.

---

## Category 2: WebRTC & Live Video/Data Streaming (11–20)

### Q11: What is an SDP (Session Description Protocol) offer/answer?
**A**: An SDP is a text-based description containing a device's media capabilities (supported video/audio codecs, network protocols, secure RTP profiles). Peer A creates an SDP *Offer* and sends it to Peer B via Socket.io. Peer B sets this as their remote description, generates an SDP *Answer* containing their matched settings, and sends it back to Peer A, establishing the media parameters.

### Q12: What is an ICE candidate, and what is its role?
**A**: ICE (Interactive Connectivity Establishment) candidates represent possible network paths (IP addresses, ports, protocols) through which a peer can be reached. Browsers generate candidate options locally and send them asynchronously to the other peer via the signaling server. The connections are tested in real-time until the best available path is established.

### Q13: What are STUN and TURN servers? Why do we need them?
**A**: Most devices sit behind a NAT (Network Address Translator) and do not have a public IP. A **STUN** server allows a device to discover its own public IP and port. However, STUN fails if a device is behind a strict "Symmetric NAT". In this case, we need a **TURN** (Traversal Using Relays around NAT) server, which acts as a media relay server.

### Q14: How does file sharing over WebRTC work compared to audio/video streaming?
**A**: While audio/video is streamed using UDP-like RTP channels where packet loss is acceptable, file sharing requires lossless, ordered data delivery. We use WebRTC's `RTCDataChannel`, which sits on top of SCTP (Stream Control Transmission Protocol) to guarantee reliable, in-order packet delivery.

### Q15: Why do you slice files into chunks during WebRTC data channel transfer?
**A**: Sending a large file (e.g., 50MB) as a single blob over `RTCDataChannel` will overflow the browser's network buffer and drop the connection. We chunk files into small binary blocks (usually 16KB ArrayBuffers), stream them sequentially, and reconstruct them on the receiving side inside a React-managed memory array before compiling them into a final download Blob.

### Q16: How do you prevent audio feedback loops during screen/webcam sharing?
**A**: Presenting a screen or webcam streams local audio. If the presenter's own browser plays this stream, their microphone will capture the output speaker sound, causing an escalating feedback loop. We prevent this by setting `muted={true}` on the local `<video>` tags of the presenter while keeping the volume unmuted for remote receivers.

### Q17: What happens when the presenter clicks "Stop Sharing" on the browser's native share bar?
**A**: When the browser's native share pill is closed, the operating system stops the media track. We capture this event by binding an listener to the video track: `stream.getVideoTracks()[0].onended = () => { stopScreenShare(); }`. This cleans up our local React states and notifies other room users via Socket.io to close their remote peer connections.

### Q18: Explain how you implemented the seamless hot-swapping between Screen and Webcam.
**A**: When the user clicks the switcher button in the control bar, the application calls the alternate media acquisition code (e.g. switching from screen display capture to webcam user media). It stops all active tracks on the old stream reference (releasing camera hardware), updates `setScreenStream` with the new capture, and emits `"screen-share-start"`. This forces all remote participants to discard their old peer connection and establish a fresh connection negotiating the new media tracks.

### Q19: What is the WebRTC `ontrack` event, and when does it fire?
**A**: The `ontrack` listener is triggered on the receiving `RTCPeerConnection` when the remote peer adds a media track (video/audio) to the connection. We hook into this event on the guest side to extract the track's media stream and bind it to our React video element: `videoRef.current.srcObject = event.streams[0]`.

### Q20: What happens if WebRTC fails to establish a direct P2P link?
**A**: If the ICE gathering protocol cannot find a route between two devices (usually due to strict firewalls), the connection fails. In Stash, our UI gracefully falls back to displaying a cloud download button, retrieving the file securely via Supabase Cloud Storage.

---

## Category 3: Security, Authentication, & Access Keys (21–30)

### Q21: How are passwords stored and checked in Stash?
**A**: The room passcode (called Stack Key) is a 6-digit numeric key. When the host toggles "Protected Room", the backend generates a random key and updates the `rooms` table in PostgreSQL. The key is never broadcast to unauthorized guests. When a guest tries to join, they submit the code via `POST /rooms/:room_id/join`. The backend compares it, and if it matches, signs and returns a temporary cryptographic access token.

### Q22: What is the Room Access Token and how does it prevent security bypass?
**A**: The room access token is a stateless, cryptographic JWT-like signature generated by the backend using a server-side secret key. It contains the `room_id` and the client's `client_id`. Every sensitive file operation (preview, download, list) requires this token in the headers. If an attacker guesses a file URL, the server rejects it with a `403 Forbidden` unless the request header contains a token signed by the server matching that room.

### Q23: Why do room passkeys (Stack Keys) expire and rotate?
**A**: To prevent static passwords from being shared indefinitely or brute-forced. When a password is created or checked, it is assigned a lifecycle window (e.g., 80 seconds). Once expired, any room check automatically rotates the key to a new 6-digit value and broadcasts the update to current authenticated occupants.

### Q24: What is the "Accept-Only" mode and how does it differ from password protection?
**A**: In Accept-Only mode, access is manual instead of key-based. When a guest visits, they type their name, triggering a Socket.io `"join-request"` sent to the Host. The Host sees a modal on their dashboard with "Approve" or "Deny" buttons. If approved, the server signs and returns the access token to the guest via WebSockets.

### Q25: How does the application prevent cross-site request forgery (CSRF) or token theft?
**A**: Tokens are locked into the browser's `localStorage` and map strictly to the room scope. Because they are only sent inside custom request headers (`x-room-access-token`), standard form submits or link clicks cannot execute forged state mutations, protecting against CSRF attacks.

### Q26: If the database is compromised, can an attacker decrypt the files in S3?
**A**: S3 bucket policies restrict public reads. The bucket can only be accessed through server-side Supabase API requests. If the database metadata is exposed, an attacker could see filenames and file paths, but they would still need server credentials or signed storage credentials to pull the raw physical files from S3.

### Q27: How does your backend identify which socket belongs to the room Host?
**A**: When a room is created or joined, the client registers a unique `clientId` (stored in their session). The database table `rooms` records the creator's identity in `creator_socket_id` (or maps it to the host identity). In API requests, the headers include the host identity, which the backend compares to verify administrative privileges (like rotating keys).

### Q28: How does the `checkRoomAccess` Express middleware work?
**A**: It retrieves the `room_id` from the request route. It queries the room settings in Postgres. If the room has security (is_protected or accept_only), it extracts the token from the headers (`x-room-access-token`), verifies its signature against the server secret, and checks if it matches the current `room_id`. If valid, it calls `next()`; otherwise, it returns a `401 Unauthorized` block.

### Q29: What happens to files belonging to a room that is deleted?
**A**: Postgres cascade rules handle DB records. When a room is deleted, Postgres automatically deletes all linked metadata rows in the `files` table. The backend also runs a storage bucket deletion command to purge all file paths under that room path prefix in the Supabase bucket.

### Q30: How do you prevent brute force attacks on the 6-digit room key?
**A**: Because room keys expire and rotate automatically every 80 seconds, a static brute-force dictionary attack becomes useless after a minute. Additionally, standard rate limiters can be mounted on the `/rooms/:room_id/join` Express endpoint.

---

## Category 4: Frontend State & Media Handling (31–40)

### Q31: How does the frontend handle file previews, and how did you resolve previews failing on mobile devices?
**A**: We request a temporary, 10-minute signed URL from Supabase and render it inside `<img />` or `<video>` elements. Previously, mobile browsers (like Safari on iOS) uploaded files with generic MIME types (`application/octet-stream`), so the frontend failed to categorize them as media. We resolved this by adding a helper `getMediaType` that checks the **file extension** (`.jpg`, `.mov`, `.mp3`) as a fallback if the MIME type is generic.

### Q32: Why did you implement a custom audio player instead of the native HTML5 audio tag?
**A**: Native audio players have thick, bulky browser-specific styles that clash with modern dark UI systems. We created a custom player in `FileCard.jsx` using React state to bind play/pause icons, render a custom range bar, and track current time and durations, integrating it cleanly inside the file details row.

### Q33: How does the voice note recorder capture audio in React?
**A**: We use the HTML5 `MediaRecorder` API. When the user clicks record, we request mic permissions (`navigator.mediaDevices.getUserMedia`), construct a `MediaRecorder` instance, and store recorded audio data chunks. Once stopped, we compile the chunks into a WebM blob and upload it to the backend.

### Q34: What is Chrome's WebM duration bug and how did you solve it?
**A**: Live WebM recordings created by `MediaRecorder` lack standard container metadata indices because the duration isn't known until recording stops. Chrome reads the duration as `Infinity`. To fix this, when metadata loads, we temporarily set `audio.currentTime = 1e101` (seeking to the end). The browser computes the actual duration at that boundary, triggering `ontimeupdate`, where we record the time, reset `currentTime` back to `0`, and render the final duration.

### Q35: How did you implement real-time clipboard sync across devices?
**A**: We monitor text changes in the Clipboard panel. When a user pastes or writes text and clicks "Send", it invokes the socket emit event `"clipboard-send"`. The backend receives this text and broadcasts it to all other sockets in the room, which updates their local React state.

### Q36: How does the app display download progress bars for files?
**A**: During a P2P download, the receiver listens to the `RTCDataChannel` onmessage event, tracks the bytes received, computes the percentage against the target file size, and updates `downloadProgress` state. For cloud downloads, we fetch using standard HTTP Axios streams with an `onDownloadProgress` event hook.

### Q37: How do you handle unmounting cleanups in React (e.g. for WebRTC or timers)?
**A**: In React, cleanups are performed in the return function of `useEffect` blocks. For WebRTC, we close active peer connection channels and stop all media tracks. For timers, we clear intervals and timeouts (like the countdown timer for file expiry) to prevent memory leaks.

### Q38: How does the zoom modal for images work?
**A**: When an image preview is clicked, we set `showZoomModal(true)`. This mounts a fixed overlay div with `z-index: 9999` and a backdrop blur filter. Clicking the close icon or clicking the overlay background sets `showZoomModal(false)`.

### Q39: What React Hook is used to manage global app states, and why?
**A**: We wrote a custom hook named `useStash.js`. It encapsulates all Socket.io state listeners, room join logic, file uploading/downloading functions, and WebRTC streaming variables. This keeps the presentation components (`AppPage`, `Sidebar`) decoupled from complex business logic.

### Q40: What styling framework did you use and why?
**A**: We used Tailwind CSS. It is a utility-first CSS framework that allows rapid prototyping directly inside JSX files. It leverages Tailwind's performance optimizations (JIT compiler) to generate minimal compiled CSS.

---

## Category 5: Backend, DB, & Storage (41–50)

### Q41: What is Express and how does it route REST endpoints?
**A**: Express is a minimalist web framework for Node.js. It manages routes by linking URI paths and HTTP verbs (GET, POST, DELETE) to callback functions, passing request (`req`) and response (`res`) objects through middlewares.

### Q42: How does the backend upload files to Supabase?
**A**: When a file is uploaded (handled via `multer` to capture file stream buffers), the backend initiates a Supabase Storage client call: `supabase.storage.from('stash-files').upload(filePath, fileBuffer, { contentType })`. Once completed, it inserts a metadata row with the file details in PostgreSQL.

### Q43: How do you secure database credentials?
**A**: We use environment variables inside a `.env` file (e.g., `SUPABASE_URL`, `SUPABASE_KEY`). The `dotenv` package loads these into `process.env` during startup, keeping credentials secure and out of git repositories.

### Q44: What happens if a file upload exceeds the size limit?
**A**: We configure a file size limit check in our route handlers. If a file is too large, the middleware rejects it and calls `next(new AppError('File size exceeds limit', 400))`, which is caught by our global error handling middleware to send a clean error response.

### Q45: How did you implement error handling on the backend?
**A**: We created a custom `AppError` class that extends JS `Error` to set status codes. We run all route controllers inside an async wrapper. If an error occurs, it is passed to `next(err)`. A global error handling middleware catch-all formats the response to the user: `{ status: 'error', message: err.message }`.

### Q46: What is a signed URL and how does S3 generate it?
**A**: A signed URL is a secure temporary link generated by cryptographic hashing. It appends query parameters (expiration timestamp, access signature) to the object path. Anyone who holds this link can download the file directly from S3 without needing bucket credentials, but only until the link expires.

### Q47: Why is it important to delete metadata rows when a file is deleted from S3?
**A**: If metadata rows remain in PostgreSQL after physical files are removed, the frontend will show broken image previews or crash when trying to download non-existent files. We execute both S3 deletion and Postgres deletion inside a try-catch block to keep them in sync.

### Q48: What role does CORS (Cross-Origin Resource Sharing) play in the app?
**A**: Since the React app runs on port `5173` (Vite dev server) and the Node API runs on port `3000`, the browser blocks HTTP requests unless the server sends headers permitting access from that origin. We configure CORS middleware in Express and Socket.io to allow specific dev and production domains.

### Q49: How does the backend verify the integrity of files during uploads?
**A**: Multer parses multipart form data. We check file properties like mime-types and file extensions, and check size limits before sending the buffer to Supabase, protecting against corrupt uploads.

### Q50: How do you handle database connection issues in production?
**A**: The Supabase client connects over HTTP/HTTPS, using a connection pool for database transactions. We implement standard try-catch blocks and error handling middlewares to catch timeout exceptions and return user-friendly alert messages instead of crashing the server.
