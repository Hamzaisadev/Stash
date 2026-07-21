# Stash

Stash is a lightweight file sharing and collaboration web app for quickly stashing files (EPUBs, images, video, archives) to a short-lived room. It provides a Vite + React frontend and an Express + Socket.io backend that stores metadata in Supabase (Postgres + S3-compatible storage) and uses SQLite for local metadata utilities.

## Table of contents

- Overview
- Architecture
- Backend (what's included)
- Frontend (what's included)
- Environment variables
- Local development
- API routes
- Deployment and Docker
- Contributing & next steps

---

## Overview

Stash lets users create or auto-derive a room (based on client IP), upload files to that room, share invite links, and collaborate in real-time via WebSockets. Files are uploaded from the browser (drag & drop, paste, file select) and stored in Supabase storage; metadata and room records live in Supabase Postgres. The backend also exposes preview signed URLs and supports password-protected files and download limits.

## Architecture

- Backend: `backend/` — Express server in `backend/src`, Socket.io signaling, upload handling with `multer` (in-memory), Supabase client integration, and a lightweight SQLite helper at `backend/src/db.js` for on-disk state.
- Frontend: `frontend/` — Vite + React application in `frontend/src` (components, pages, hooks). Uses `socket.io-client` for realtime features and supports drag/drop and paste uploads.
- Storage: Supabase Storage bucket named `stash-files` (configured in `backend/src/supabase.js`).
- Local uploads: the repository includes an `uploads/` folder with sample EPUB files.

## Backend — key files and behavior

- Entry: `backend/src/server.js` — Express app with Socket.io initialization, request injection of `io` on `req`, global error handler, and `/api` mount for routes.
- Routes: `backend/src/routes.js` — endpoints for rooms, file listing, upload, preview, download, and deletion.
- Upload handling: `backend/src/upload.js` — `multer` configured to use memory storage (uploads available in `req.file.buffer` / `req.files[*].buffer`).
- Supabase client: `backend/src/supabase.js` — reads `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from env and instantiates the client.
- DB utilities: `backend/src/db.js` — initializes an SQLite DB at `backend/stach.db` and provides lightweight helpers `dbRun`, `dbGet`, and `dbAll`.
- Controllers: `backend/src/controller.js` — core business logic: creating rooms, uploading files (single or multi-file zipped), generating signed preview URLs, secure download flow, burn-after-read semantics, and room cleanup.

Security & behaviors:

- Rooms may be auto-created based on hashed client IPs to support quick local network sharing.
- Protected rooms support passcodes or manual approval. Access verification uses tokens (`x-room-access-token`) and `x-host-id` headers.
- Files can be password-protected, have expiration times, and limited download counts.

## Frontend — key files and behavior

- Entry: `frontend/src/main.jsx` and `frontend/src/App.jsx` — simple router that shows `Landing` or `AppPage` depending on path.
- Main app: `frontend/src/pages/AppPage.jsx` — uses the `useStash` hook for API interactions and Socket.io; supports drag/drop uploads, clipboard sync, screen share, file list, uploading, downloading, and room management.
- Components: `frontend/src/components/` contains `UploadForm.jsx`, `FileListFeed.jsx`, `FileCard.jsx`, `Sidebar.jsx`, `GateScreen.jsx` and many UI primitives under `frontend/src/components/ui/`.
- Hooks: `frontend/src/hooks/useStash.js` — centralizes API calls, socket management, and stateful interactions used across the UI.

Features visible in the UI:

- Drag & drop and paste uploads
- Live file list with upload and download progress
- Password-protected files and burn-after-read support
- Room creation, share link copy, manual guest approval
- Clipboard sync between devices in the same room

## Environment variables

Create a `.env` file in the `backend/` folder with the following minimum variables:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SECRET_KEY` — Service/anon key with storage and DB permissions
- `PORT` — (optional) port for backend server (default: `5000`)

Example `.env` contents:

```
SUPABASE_URL=https://xyzcompany.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
PORT=5000
```

Notes: `backend/src/supabase.js` will exit the process if `SUPABASE_URL` or `SUPABASE_SECRET_KEY` are missing.

## Local development

1. From project root, install dependencies:

```bash
cd backend
npm install

cd ../frontend
npm install
```

2. Start backend in watch mode (server restarts on changes):

```bash
cd backend
npm run dev
```

3. Start frontend (Vite dev server):

```bash
cd frontend
npm run dev
```

4. Open the frontend URL shown by Vite (typically `http://localhost:5173`).

## API routes (summary)

All routes are mounted under `/api` by default in `server.js`.

- POST `/api/rooms` — create a room
- GET `/api/rooms/:room_id` — get room details
- POST `/api/rooms/:room_id/join` — join room with key
- POST `/api/rooms/:room_id/update` — update settings
- POST `/api/rooms/:room_id/rotate-key` — rotate access key
- DELETE `/api/rooms/:room_id` — delete room
- GET `/api/room` — resolve client room id (auto-create local room)
- GET `/api/files/:room_id` — list files in a room (requires access check middleware)
- POST `/api/upload` — multipart upload (field: `files`)
- GET `/api/preview/:id` — signed preview URL
- POST `/api/download/:id` — download file (password in body if required)
- DELETE `/api/files/:id` — delete file

Refer to `backend/src/routes.js` and `backend/src/controller.js` for full behavior and header-based auth fields: `x-room-access-token` and `x-host-id`.

## Deployment & Docker

- A `backend/Dockerfile` is included for containerizing the backend. Ensure environment variables are injected into the container at runtime (e.g., via Docker secrets or env file).
- For production, use Supabase (or any S3-compatible storage + Postgres) and secure your `SUPABASE_SECRET_KEY`.

## Contributing & next steps

- Add a `.env.example` file listing the required env vars.
- Add automated tests for backend controllers and route behavior.
- Add CI workflow for linting and builds for frontend and backend.
- Consider adding migration scripts for Supabase DB schema or a SQL file with required `rooms` and `files` tables.

## Where to look in the codebase

- Backend entry: `backend/src/server.js`
- Routes: `backend/src/routes.js`
- Upload handling: `backend/src/upload.js`
- Supabase client: `backend/src/supabase.js`
- Controllers/business logic: `backend/src/controller.js`
- Frontend entry: `frontend/src/main.jsx` and `frontend/src/App.jsx`
- Frontend main page: `frontend/src/pages/AppPage.jsx`

---

If you want, I can:

- Add a `.env.example` file to the repository.
- Create a `CONTRIBUTING.md` with development guidelines.
- Add a short API example demonstrating uploading a file via `curl`.
