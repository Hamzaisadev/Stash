import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "stash_my_uploads";

/** Event this app dispatches when it mutates the upload list in the same tab. */
export const UPLOADS_CHANGED_EVENT = "stash-uploads-changed";

function readUploads() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    // A corrupted key previously threw on every render and blanked the app.
    return new Set();
  }
}

/** Notify listeners after writing to the upload list. */
export function notifyUploadsChanged() {
  window.dispatchEvent(new Event(UPLOADS_CHANGED_EVENT));
}

/**
 * Tracks which files this browser uploaded.
 *
 * Previously `isOwner` re-parsed localStorage once per file per render. This
 * parses once into a Set and re-reads only when the list actually changes.
 *
 * Note: this is a client-side convenience only. The server authorises deletes
 * by room access, not per-file ownership, so this controls affordances — not
 * permissions.
 */
export function useMyUploads() {
  const [uploads, setUploads] = useState(readUploads);

  useEffect(() => {
    const sync = () => setUploads(readUploads());

    window.addEventListener(UPLOADS_CHANGED_EVENT, sync);
    // `storage` fires only in *other* tabs, which is exactly what we want here.
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(UPLOADS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isOwner = useCallback((fileId) => uploads.has(fileId), [uploads]);

  return { isOwner, uploads };
}
