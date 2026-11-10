# Stash: Two-Person Presentation & Project Defense Guide

This guide outlines a slide-by-slide presentation strategy for **two presenters**. It is structured to balance the presentation workload:
*   **Presenter A (Technical Lead / Developer)**: Handles low-level engineering details, architecture diagrams, WebRTC chunking protocols, signed URL tokens, and live technical demos.
*   **Presenter B (Product Lead / Co-Presenter)**: Handles high-level project introductions, problem statements, UI/UX aesthetics, product features overview, and future roadmap directions.

---

## Presentation Breakdown Summary

| Slide / Topic | Primary Speaker | Focus / Key Talking Points |
| :--- | :--- | :--- |
| **1. Title & Introduction** | **Presenter B** | App name, team introduction, project hook. |
| **2. Problem Statement** | **Presenter B** | Friction of current file/screen sharing methods. |
| **3. Project Vision & Solution** | **Presenter B** | High-level summary of Stash (ephemeral rooms, P2P). |
| **4. Feature Showcase (Overview)** | **Presenter B** | List of core modules: Files, Video Call, Clipboard. |
| **5. Technical Architecture** | **Presenter A** | Hybrid WebRTC + Supabase model, signaling. |
| **6. Security & Token Auth** | **Presenter A** | Room tokens, access gates, passcode security. |
| **7. Live Demo (Walkthrough)** | **Both (B leads UI, A leads technical)** | Presenter B clicks through UI, A explains what happens behind the scenes. |
| **8. Deep-Dive: WebRTC P2P Chunking** | **Presenter A** | How 16KB binary array buffer chunking works. |
| **9. Deep-Dive: WebM Duration Fix** | **Presenter A** | Resolving the browser `Infinity` duration bug. |
| **10. Future Roadmap & QA** | **Presenter B** | Mobile native wraps, TURN servers, concluding QA. |

---

## Slide-by-Slide Script & Talking Points

### Slide 1: Title Slide & Project Intro
*   **Speaker**: **Presenter B**
*   **Slide Visuals**: Premium dark mockups of Stash UI.
*   **Script / Talking Points**:
    *   *Presenter B*: "Good morning members of the panel. Today, we are excited to present **Stash**—a room-based real-time file sharing, screen broadcasting, and synchronized clipboard web application designed for instant, secure collaboration."
    *   *Presenter B*: "My name is [Presenter B Name], and I will be walking you through our project vision, features, and UX. Joining me is [Presenter A Name], who will cover our system architecture, WebRTC signaling protocol, and database engineering details."

### Slide 2: The Problem
*   **Speaker**: **Presenter B**
*   **Slide Visuals**: Icons representing Google Drive, email attachments, and strict OS limitations (like AirDrop).
*   **Script / Talking Points**:
    *   *Presenter B*: "Sharing files, text clippings, or live screens across different operating systems (like Windows, iOS, and Android) is surprisingly difficult. It typically requires creating accounts, uploading files to cloud storage where they sit indefinitely, or relying on hardware ecosystems like AirDrop that lock you into specific devices."
    *   *Presenter B*: "This creates privacy issues and clutters cloud drives with temporary files that users forget to clean up."

### Slide 3: Our Solution (Project Vision)
*   **Speaker**: **Presenter B**
*   **Slide Visuals**: Flowchart showing: *Open URL ➔ Hashed Local Network Room ➔ Share instantly ➔ Expiration ➔ Deleted.*
*   **Script / Talking Points**:
    *   *Presenter B*: "Stash is our solution. It is a fully web-based platform. By hashing the client's network IP address, users on the same local network are automatically routed into the same room—enabling zero-configuration auto-discovery."
    *   *Presenter B*: "Rooms are ephemeral, files expire and auto-prune, and transfers are conducted peer-to-peer over WebRTC whenever possible, keeping cloud storage costs zero."

### Slide 4: Features Overview
*   **Speaker**: **Presenter B**
*   **Slide Visuals**: Icons representing Files list, Live Screen/Webcam Stream player, and Sync Clipboard text field.
*   **Script / Talking Points**:
    *   *Presenter B*: "Stash is divided into three key workspaces: First, **Files Hub**, which supports drag-and-drop file uploads and browser-recorded Voice Notes. Second, **Live Stream**, supporting screen sharing or webcam broadcasts. Third, **Sync Clipboard**, enabling copy-pasting of text snippets across devices in real-time."
    *   *Presenter B*: "To secure these rooms, we support three modes: Public, Password-Protected, and Host-Approval (Accept-Only) modes."

### Slide 5: System Architecture & Tech Stack
*   **Speaker**: **Presenter A**
*   **Slide Visuals**: Hybrid Architecture Diagram (WebRTC peer connections, Express Node server, Socket.io signaling, and Supabase database/buckets).
*   **Script / Talking Points**:
    *   *Presenter A*: "To make this possible, we engineered a hybrid architecture. Our frontend is built on React and Vite for near-instant rendering. The backend is powered by Node.js, Express, and Socket.io."
    *   *Presenter A*: "WebRTC requires a signaling protocol to negotiate peer connections. We use Socket.io to transfer SDP offers and answers. Once negotiated, file chunks and video streams flow directly between the browsers P2P."
    *   *Presenter A*: "If firewalls or Symmetric NAT configurations block P2P connections, we fall back to Supabase Object Storage, serving files via encrypted signed storage links."

### Slide 6: Security & Token Verification
*   **Speaker**: **Presenter A**
*   **Slide Visuals**: Encryption icons and the mathematical token generation formula: `RoomToken = RoomId:ClientId:Signature`.
*   **Script / Talking Points**:
    *   *Presenter A*: "Security is core to Stash. We designed a cryptographic token verification middleware. When a user enters a password or gets approved, the server signs a room access token using HMAC-SHA256 based on a server secret key."
    *   *Presenter A*: "This token is stored locally in the guest's browser and attached to every API request header. If an unauthorized guest attempts to access room files directly, our backend middleware returns a `403 Forbidden` response, rendering our private Gate Screen."

### Slide 7: Live Demo
*   **Presenter B** controls the browser, clicks buttons, and displays the UI. **Presenter A** narrates the backend execution events.
*   **Script / Talking Points**:
    *   *Presenter B*: "Let's demonstrate this live. I will open a browser window and navigate to a new room slug. You'll notice I am placed on the Gate Screen because this room is password-protected. I will type in the 6-digit room key."
    *   *Presenter A*: "As [Presenter B] types the key, the React client initiates a `joinRoomWithKey` call. The backend validates the passcode, generates a room access token, and returns it. Once saved in local storage, our database hook automatically retrieves previously shared files and updates the files list."
    *   *Presenter B*: "Next, I will record a quick microphone voice drop and start screen sharing."
    *   *Presenter A*: "The voice drop is captured as WebM. Behind the scenes, the screen sharing initiates a WebRTC peer connection. The guest browser receives the stream track, muting the local playback to prevent feedback loops while rendering controls for mic and volume."

### Slide 8: Technical Deep-Dive: P2P File Chunking
*   **Speaker**: **Presenter A**
*   **Slide Visuals**: Code snippet or diagram showing slicing file blob ➔ array buffer ➔ 16KB chunks ➔ RTCDataChannel.
*   **Script / Talking Points**:
    *   *Presenter A*: "One major technical hurdle was transferring large files over WebRTC. Sending a single huge file crashes browser buffers. To solve this, we wrote a custom chunking algorithm."
    *   *Presenter A*: "We read files as array buffers, slice them into 16KB binary chunks, and stream them sequentially over the `RTCDataChannel`. On the receiving side, we reconstruct the array, monitor stream completion percentage, and output a downloadeable Blob."

### Slide 9: Technical Deep-Dive: Chromium WebM Duration Workaround
*   **Speaker**: **Presenter A**
*   **Slide Visuals**: Code snippet showing `audio.currentTime = 1e101` and `audio.ontimeupdate`.
*   **Script / Talking Points**:
    *   *Presenter A*: "Another bug we encountered was Chrome reporting `Infinity` as the duration of browser-recorded WebM audio files, rendering custom media timelines useless. This occurs because WebM streams don't record length metadata headers dynamically."
    *   *Presenter A*: "We engineered a seek-scan workaround: when media metadata loads, we seek the audio to a massive boundary (`1e101`). Once the browser queries the end of the byte stream, we retrieve the actual duration, reset `currentTime` to `0`, and present a fully seekable custom player."

### Slide 10: Future Roadmap & Concluding QA
*   **Speaker**: **Presenter B**
*   **Slide Visuals**: Bulleted future roadmap.
*   **Script / Talking Points**:
    *   *Presenter B*: "For future iterations, we plan to wrap Stash inside Capacitor/Tauri for native desktop and mobile application builds. We also aim to deploy high-throughput TURN servers to guarantee 100% WebRTC P2P success rates in corporate networks."
    *   *Presenter B*: "Thank you. We would now like to open the floor to any questions from the panel."
