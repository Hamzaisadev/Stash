import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Full-screen preview overlay for images and video.
 *
 * The previous implementation was a bare div with no dialog semantics, no
 * Escape handler and no focus management, so keyboard users tabbed straight
 * into the page behind it.
 */
export default function FileLightbox({ file, src, kind, onClose }) {
  const closeRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      // Minimal focus trap: only the close button is focusable in here.
      if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    // Prevent the page behind from scrolling while the overlay is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={file?.filename || "File preview"}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
      >
        <X className="size-5" aria-hidden="true" />
      </button>

      <figure
        className="flex max-h-full max-w-5xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "video" ? (
          <video
            src={src}
            controls
            autoPlay
            controlsList="nodownload"
            className="max-h-[85vh] max-w-full rounded-xl shadow-2xl"
          />
        ) : (
          <img
            src={src}
            alt={file?.filename || ""}
            className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        )}

        <figcaption className="max-w-full truncate text-2xs text-white/70">
          {file?.filename}
        </figcaption>
      </figure>
    </div>
  );
}
