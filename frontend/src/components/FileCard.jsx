import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Download, QrCode, Trash2 } from "lucide-react";
import { getExtension, getFileKind } from "@/lib/fileTypes";
import { formatBytes, formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/useNow";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import FileMedia from "./files/FileMedia";
import FileLightbox from "./files/FileLightbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Unified file card. One shell for every file kind — grid or list orientation —
 * with the type-specific part confined to the media slot and an optional audio
 * control strip. Replaces the old file that branched into two divergent layouts
 * at `if (isAudio)`.
 */

function FileCard({
  file,
  view = "grid",
  isOwner = false,
  isSelected = false,
  onToggleSelect,
  downloadProgress,
  onDownload,
  onDelete,
  onQr,
  fetchPreviewUrl,
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const kind = getFileKind(file);
  const isMedia = kind === "image" || kind === "video" || kind === "audio";

  // Seeded from `isMedia` so the effect below never has to setState synchronously.
  const [previewLoading, setPreviewLoading] = useState(isMedia);

  // One shared 1s clock for the countdown (was one setInterval per card).
  const now = useNow(Boolean(file.expires_at));
  const countdown = formatCountdown(file.expires_at - now);

  // audioRef/audioProps are pulled out so the remaining `audio` object holds
  // only render-safe values — passing a ref-bearing object into JSX trips
  // react-hooks/refs.
  const { audioRef, audioProps, ...audio } = useAudioPlayer({
    src: kind === "audio" ? previewUrl : null,
    isLoading: previewLoading,
  });

  // Fetch the signed preview URL once per file.
  useEffect(() => {
    if (!isMedia || !fetchPreviewUrl) return;
    let cancelled = false;

    fetchPreviewUrl(file.id)
      .then((url) => {
        if (!cancelled && url) setPreviewUrl(url);
      })
      .catch(() => {
        /* preview is best-effort — a failure just falls back to the type tile */
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, isMedia]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete(file.id);
    } catch {
      /* the caller surfaces errors via toast */
    } finally {
      setIsDeleting(false);
    }
  }, [file.id, onDelete]);

  const isGrid = view === "grid";

  const meta = [];
  meta.push(formatBytes(file.file_size));
  if (countdown) meta.push(`expires in ${countdown}`);
  else if (file.expires_at) meta.push("Expired");
  if (file.is_locked) meta.push("Locked");
  if (file.max_downloads === 1) meta.push("Burns after download");
  else if (file.max_downloads) meta.push(`${file.download_count ?? 0}/${file.max_downloads} downloads`);
  else if (file.download_count) meta.push(`Downloaded ${file.download_count}x`);

  const progressEntry = downloadProgress?.[file.id];

  return (
    <div
      className={cn(
        "group relative bg-white transition-colors duration-200",
        isGrid
          ? "overflow-hidden rounded-[10px] border-2 border-slate-900 shadow-[2px_2px_0_0_var(--color-slate-900)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--color-slate-900)] transition-[translate,box-shadow] duration-150"
          : "flex min-h-16 items-center gap-3 border-b border-slate-100 px-3 py-2.5 hover:bg-slate-50/70",
      )}
    >
      {/* Selection checkbox */}
      {onToggleSelect && (
        <div
          className={cn(
            "z-10",
            isGrid ? "absolute top-2 left-2" : "order-first shrink-0",
          )}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Select ${file.filename}`}
            className="size-4 cursor-pointer accent-brand-500"
          />
        </div>
      )}

      {/* Media / type slot */}
      <FileMedia
        file={file}
        kind={kind}
        view={view}
        previewUrl={previewUrl}
        previewLoading={previewLoading}
        audio={audio}
        onOpenPreview={() => setShowLightbox(true)}
      />

      {/* Audio element driving the play/pause control and seek bar. Hidden:
          the card renders its own transport, not the native controls. */}
      {kind === "audio" && previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          preload="metadata"
          className="hidden"
          {...audioProps}
        />
      )}

      {/* Info column */}
      <div className={cn("min-w-0 flex-1", isGrid && "p-3")}>
        <div className={cn("flex items-center gap-1.5", isGrid ? "mb-1" : "mb-0.5")}>
          {!isGrid && (
            <span className="shrink-0 font-mono text-3xs font-semibold text-slate-400">
              {getExtension(file.filename).toUpperCase() || "FILE"}
            </span>
          )}
          <p
            className="truncate text-sm font-semibold text-slate-800"
            title={file.filename}
          >
            {file.filename}
          </p>
        </div>

        {file.description && (
          <p className="mb-1 line-clamp-2 text-2xs text-slate-500">
            {file.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-slate-500">
          {meta.map((m) => (
            <span key={m} className={cn(m.startsWith("expires") && "font-mono text-red-500")}>
              {m}
            </span>
          ))}
        </div>

        {/* Audio control strip — only for audio/voice kinds */}
        {kind === "audio" && (
          <div className="mt-2 flex items-center gap-2">
            <div
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(audio.progress)}
              onClick={audio.seekToEvent}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") audio.nudge(-5);
                if (e.key === "ArrowRight") audio.nudge(5);
              }}
              tabIndex={0}
              className="group/bar h-1.5 flex-1 cursor-pointer rounded-full bg-slate-200 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
            >
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${audio.progress}%` }}
              />
            </div>
            <span className="font-mono text-3xs text-slate-500">
              {audio.currentTime} / {audio.duration}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-1",
          isGrid ? "actions-reveal absolute top-2 right-2 rounded-lg bg-white/90 p-0.5 backdrop-blur-sm" : "actions-reveal",
        )}
      >
        {onDownload && (
          <IconAction label={`Download ${file.filename}`} onClick={() => onDownload(file)}>
            <Download className="size-4" aria-hidden="true" />
          </IconAction>
        )}
        {onQr && (
          <IconAction label={`QR code for ${file.filename}`} onClick={() => onQr(file)}>
            <QrCode className="size-4" aria-hidden="true" />
          </IconAction>
        )}
        {isOwner && onDelete && (
          <IconAction
            label={`Delete ${file.filename}`}
            onClick={handleDelete}
            destructive
          >
            {isDeleting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
          </IconAction>
        )}
      </div>

      {/* Download progress ring/state */}
      {progressEntry && (
        <div className={cn(isGrid && "absolute inset-x-3 bottom-2")}>
          <DownloadState state={progressEntry.status} percent={progressEntry.percent} />
        </div>
      )}

      {/* Lightbox for image/video */}
      {showLightbox && previewUrl && (
        <FileLightbox
          file={file}
          src={previewUrl}
          kind={kind}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </div>
  );
}

function IconAction({ label, onClick, destructive, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none",
            destructive
              ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function DownloadState({ state, percent }) {
  const pct = Math.round(percent ?? 0);
  const radius = 14;
  const circumference = 2 * Math.PI * radius;

  if (state === "complete") {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-600">
        <CheckSquare className="size-3.5" aria-hidden="true" /> Saved
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 text-2xs text-slate-500">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200" />
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * pct) / 100}
          className="text-brand-500"
          transform="rotate(-90 16 16)"
        />
      </svg>
      <span className="font-mono">{state === "streaming" ? pct : state}</span>
    </div>
  );
}

export default FileCard;
