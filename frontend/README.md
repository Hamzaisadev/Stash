# Stash Frontend

This repository contains the Stash web frontend: a responsive React + Vite application built for secure temporary file rooms and instant device-to-device sharing.

## What it does

- Hosts the landing page and main app UI
- Manages room creation, joining, and access control
- Uploads files with drag-and-drop or clipboard paste
- Streams room events via Socket.io for live collaboration
- Handles preview and download flows for protected files

## Development

```bash
cd frontend
npm install
npm run dev
```

Open the local app URL to launch the app.

## Production build

```bash
npm run build
npm run preview
```

## Notes

- The frontend expects the backend API to be available under `/api`.
- Use `VITE_BACKEND_URL` in `.env` to configure the production backend origin.
- Main entry file: `src/main.jsx`
- Landing page component: `src/pages/Landing.jsx`
