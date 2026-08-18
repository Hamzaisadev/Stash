import { Loader2, Pause, Play, PlayCircle } from "lucide-react";
import FileTypeIcon from "./FileTypeIcon";
import { cn } from "@/lib/utils";

/**
 * The kind-specific slot inside a FileCard.
 *
 * One component resolves every file kind so the card shell itself never
 * branches on type. Replaces the old `if (isAudio) return <wholeOtherLayout/>`
 * fork that produced two divergent cards.
 *
 * Video renders a poster frame, never `<video controls>` — a grid of live
 * video elements will hammer the browser.
 */
export default function FileMedia({
  file,
  kind,
  view,
  previewUrl,
  previewLoading,
  audio,
  onOpenPreview,
}) {
  const isGrid = view === "grid";

  // ── Audio: the play/pause control *is* the thumbnail ──
  if (kind === "audio") {
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center bg-slate-100",
          isGrid ? "aspect-[4/3] w-full" : "size-10 rounded-lg",
        )}
      >
        <button
          type="button"
          onClick={audio?.toggle}
          aria-label={audio?.isPlaying ? "Pause" : "Play"}
          className={cn(
            "flex items-center justify-center rounded-full bg-brand-500 text-white shadow-sm transition-transform hover:bg-brand-600 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none",
            isGrid ? "size-12" : "size-8",
            audio?.isPending && "cursor-wait bg-brand-500/40",
          )}
        >
          {audio?.isPending ? (
            <Loader2
              className={cn("animate-spin", isGrid ? "size-5" : "size-4")}
              aria-hidden="true"
            />
          ) : audio?.isPlaying ? (
            <Pause
              className={cn(isGrid ? "size-5" : "size-3.5")}
              aria-hidden="true"
            />
          ) : (
            <Play
              className={cn("translate-x-px", isGrid ? "size-5" : "size-3.5")}
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    );
  }

  // ── Image ──
  if (kind === "image") {
    if (previewLoading) {
      return <MediaSkeleton isGrid={isGrid} />;
    }
    if (!previewUrl) {
      return <TypeSlot file={file} kind={kind} isGrid={isGrid} />;
    }

    return (
      <button
        type="button"
        onClick={onOpenPreview}
        aria-label={`Open preview of ${file.filename}`}
        className={cn(
          "group/media relative shrink-0 cursor-zoom-in overflow-hidden bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none",
          isGrid
            ? "aspect-[4/3] w-full border-b border-slate-100"
            : "size-10 rounded-lg",
        )}
      >
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover/media:scale-[1.03]"
        />
      </button>
    );
  }

  // ── Video: poster frame + play badge, opens in the lightbox ──
  if (kind === "video") {
    if (previewLoading) {
      return <MediaSkeleton isGrid={isGrid} />;
    }
    if (!previewUrl) {
      return <TypeSlot file={file} kind={kind} isGrid={isGrid} />;
    }

    return (
      <button
        type="button"
        onClick={onOpenPreview}
        aria-label={`Play ${file.filename}`}
        className={cn(
          "group/media relative shrink-0 overflow-hidden bg-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none",
          isGrid
            ? "aspect-[4/3] w-full border-b border-slate-100"
            : "size-10 rounded-lg",
        )}
      >
        {/* preload="metadata" fetches only the first frame, not the whole file */}
        <video
          src={previewUrl}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          className="size-full object-cover opacity-90"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <PlayCircle
            className={cn(
              "text-white/90 drop-shadow transition-transform group-hover/media:scale-110",
              isGrid ? "size-10" : "size-5",
            )}
            aria-hidden="true"
          />
        </span>
      </button>
    );
  }

  // ── Documents, archives, everything else ──
  return <TypeSlot file={file} kind={kind} isGrid={isGrid} />;
}

function TypeSlot({ file, kind, isGrid }) {
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden",
        isGrid
          ? "aspect-[4/3] w-full border-b border-slate-100"
          : "size-10 rounded-lg",
      )}
    >
      <FileTypeIcon file={file} kind={kind} size={isGrid ? "md" : "sm"} />
    </div>
  );
}

function MediaSkeleton({ isGrid }) {
  return (
    <div
      className={cn(
        "shrink-0 animate-pulse bg-slate-100",
        isGrid
          ? "aspect-[4/3] w-full border-b border-slate-100"
          : "size-10 rounded-lg",
      )}
    />
  );
}
