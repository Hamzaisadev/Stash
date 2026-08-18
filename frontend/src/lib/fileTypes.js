/**
 * Canonical file-kind resolution.
 *
 * These extension lists previously existed in three places: FileCard.getMediaType,
 * FileListFeed.getFileCategory, and backend/src/controller.js (getPreview).
 * MIME type is checked first with an extension fallback, because mobile browsers
 * frequently upload with generic or wrong MIME types.
 */

const EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "svg", "bmp", "avif"],
  video: ["mp4", "mov", "webm", "ogg", "mkv", "avi", "m4v"],
  audio: ["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus"],
  pdf: ["pdf"],
  doc: ["doc", "docx", "odt", "rtf", "pages"],
  sheet: ["xls", "xlsx", "csv", "ods", "numbers"],
  slides: ["ppt", "pptx", "odp", "key"],
  code: ["json", "js", "jsx", "ts", "tsx", "html", "css", "py", "java", "c", "cpp", "go", "rs", "sh", "yml", "yaml", "xml"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2"],
  text: ["txt", "md", "log"],
};

/** Voice notes are uploaded as `voice-drop-*.webm` — a video/* MIME that must read as audio. */
export function isVoiceNote(filename) {
  return Boolean(filename?.toLowerCase().startsWith("voice-drop-"));
}

export function getExtension(filename) {
  const name = filename?.toLowerCase() || "";
  if (!name.includes(".")) return "";
  return name.split(".").pop() || "";
}

/**
 * Resolve a file to a single kind.
 * Returns one of: image video audio pdf doc sheet slides code archive text other
 */
export function getFileKind(file) {
  const filename = file?.filename || "";
  const mime = file?.mime_type?.toLowerCase() || "";
  const ext = getExtension(filename);
  const voice = isVoiceNote(filename);

  // Quirk (preserved): voice notes carry a video/webm MIME but must read as audio.
  if (voice) return "audio";

  if (mime.startsWith("image/") || EXTENSIONS.image.includes(ext)) return "image";
  if (mime.startsWith("video/") || EXTENSIONS.video.includes(ext)) return "video";
  if (mime.startsWith("audio/") || EXTENSIONS.audio.includes(ext)) return "audio";

  if (mime === "application/pdf" || EXTENSIONS.pdf.includes(ext)) return "pdf";
  if (EXTENSIONS.sheet.includes(ext)) return "sheet";
  if (EXTENSIONS.slides.includes(ext)) return "slides";
  if (EXTENSIONS.doc.includes(ext)) return "doc";
  if (EXTENSIONS.archive.includes(ext)) return "archive";
  if (mime.startsWith("application/json") || EXTENSIONS.code.includes(ext)) return "code";
  if (mime.startsWith("text/") || EXTENSIONS.text.includes(ext)) return "text";

  return "other";
}

/**
 * Map a kind to its filter-pill bucket.
 * Quirk (preserved): video groups under `images`, which reads as "visual media".
 */
export function getFilterCategory(kind) {
  switch (kind) {
    case "image":
    case "video":
      return "images";
    case "audio":
      return "audio";
    case "pdf":
    case "doc":
    case "sheet":
    case "slides":
    case "text":
    case "code":
      return "documents";
    default:
      return "other";
  }
}

/** Only these kinds have a server-side signed preview URL worth fetching. */
export function isPreviewable(kind) {
  return kind === "image" || kind === "video" || kind === "audio";
}

/** Convenience booleans for components that branch on media behaviour. */
export function getMediaFlags(file) {
  const kind = getFileKind(file);
  return {
    kind,
    isImage: kind === "image",
    isVideo: kind === "video",
    isAudio: kind === "audio",
    isMedia: isPreviewable(kind),
    isVoiceNote: isVoiceNote(file?.filename),
  };
}
