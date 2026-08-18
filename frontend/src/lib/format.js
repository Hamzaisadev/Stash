/**
 * Shared formatting helpers.
 *
 * `formatBytes` previously existed twice (FileCard.jsx and UploadForm.jsx) with
 * differing zero-cases ("0 B" vs "0 Bytes"). This is the canonical version.
 */

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes, decimals = 1) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const scaled = value / 1024 ** exponent;

  // Whole numbers read better without a trailing ".0"
  const precision = exponent === 0 || Number.isInteger(scaled) ? 0 : decimals;

  return `${scaled.toFixed(precision)} ${BYTE_UNITS[exponent]}`;
}

/** Seconds → "m:ss". Used by the audio player scrubber. */
export function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "0:00";

  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Milliseconds remaining → compact countdown ("2d", "3h 12m", "45s").
 * Returns null once elapsed so callers can branch on expiry.
 */
export function formatCountdown(msRemaining) {
  const ms = Number(msRemaining);
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Timestamp → "just now" / "5m ago" / "3h ago" / "2d ago". */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";

  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";

  const diff = Date.now() - then;
  if (diff < 45_000) return "just now";

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
