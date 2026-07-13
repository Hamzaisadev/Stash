import React, { useState, useEffect, useRef } from 'react';

// Helper function to resolve media types based on MIME type AND file extension fallbacks.
// This is critical for mobile browsers which often upload files with generic mime types.
const getMediaType = (filename, mimeType) => {
  const mime = mimeType?.toLowerCase() || '';
  const ext = filename?.split('.').pop()?.toLowerCase() || '';
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'bmp'];
  const videoExtensions = ['mp4', 'mov', 'webm', 'ogg', 'mkv', 'avi', 'm4v'];
  const audioExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
  
  const isVoiceNote = Boolean(filename?.startsWith('voice-drop-'));

  if (mime.startsWith('image/') || imageExtensions.includes(ext)) {
    return { isImage: true, isVideo: false, isAudio: false, isMedia: true, isVoiceNote };
  }
  if (mime.startsWith('video/') || videoExtensions.includes(ext)) {
    // If it's a voice-drop file, treat it as audio
    if (isVoiceNote) {
      return { isImage: false, isVideo: false, isAudio: true, isMedia: true, isVoiceNote };
    }
    return { isImage: false, isVideo: true, isAudio: false, isMedia: true, isVoiceNote };
  }
  if (mime.startsWith('audio/') || audioExtensions.includes(ext) || isVoiceNote) {
    return { isImage: false, isVideo: false, isAudio: true, isMedia: true, isVoiceNote };
  }
  return { isImage: false, isVideo: false, isAudio: false, isMedia: false, isVoiceNote };
};

// ─── File Card ────────────────────────────────────────────────────────────────
function FileCard({ file, isOwner, downloadProgress, onDownload, onDelete, onQr, fetchPreviewUrl, refreshFiles }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [showZoomModal, setShowZoomModal] = useState(false);

  // Deleting loading state
  const [isDeleting, setIsDeleting] = useState(false);

  // Audio/Player specific states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('--:--');
  const audioRef = useRef(null);

  // Resolve media details using extension fallback helper
  const { isImage, isVideo, isAudio, isMedia, isVoiceNote } = getMediaType(file.filename, file.mime_type);

  const downloadProgressEntry = downloadProgress?.[file.id];

  // Fetch signed preview URL for all media
  useEffect(() => {
    if (!isMedia || !fetchPreviewUrl) return;
    setPreviewLoading(true);
    fetchPreviewUrl(file.id)
      .then(url => { if (url) setPreviewUrl(url); })
      .finally(() => setPreviewLoading(false));
  }, [file.id]);

  // Countdown timer for file expiry
  useEffect(() => {
    const calc = () => {
      const diff = file.expires_at - Date.now();
      if (diff <= 0) { refreshFiles?.(); return 'Expired'; }
      const s = Math.floor(diff / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const parts = [];
      if (h > 0) parts.push(`${h}h`);
      parts.push(`${m}m`);
      parts.push(`${sec}s`);
      return parts.join(' ');
    };
    setTimeLeft(calc());
    const t = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [file.expires_at]);

  const formatTime = (t) => {
    if (!isFinite(t) || isNaN(t) || t === Infinity) return '--:--';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Autoplay/Play once the source URL arrives
  useEffect(() => {
    if (previewUrl && playRequested && audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setPlayRequested(false);
      }).catch(e => {
        console.error('Play requested error:', e);
      });
    }
  }, [previewUrl, playRequested]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (previewLoading || !previewUrl) {
      setPlayRequested(prev => !prev);
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setPlayRequested(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (e) {
        console.error('Playback error:', e);
      }
    }
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration;
    if (isFinite(dur) && dur > 0) {
      setProgress((audio.currentTime / dur) * 100);
    } else {
      setProgress(0);
    }
    setCurrentTime(formatTime(audio.currentTime));
  };

  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Fix Infinity duration issue on WebM files in Chrome/Firefox
    if (audio.duration === Infinity) {
      audio.currentTime = 1e101;
      audio.ontimeupdate = function() {
        this.ontimeupdate = null;
        audio.currentTime = 0;
        setDuration(formatTime(audio.duration));
      };
    } else {
      setDuration(formatTime(audio.duration));
    }
  };

  const onEnded = () => setIsPlaying(false);

  const seekTo = (e) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(audio.duration) || audio.duration === Infinity) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  };

  const showSpinner = previewLoading || (playRequested && !isPlaying);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Perform delete action and handle loading state
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(file.id);
    } catch (e) {
      console.error("Delete failed:", e);
    }
    setIsDeleting(false);
  };

  // ─── 1. Specialized Audio/Voice Note Layout (Single Integrated Row) ───
  if (isAudio) {
    return (
      <div className="group animate-fadeUp bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-red-200 transition-all duration-300 relative p-4 flex items-center gap-4 shadow-sm">
        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={previewUrl || undefined}
          preload="metadata"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
        />

        {/* Integrated Play Button */}
        <button
          type="button"
          onClick={togglePlay}
          title={showSpinner ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer
            transition-all duration-150 active:scale-95
            ${showSpinner
              ? 'bg-red-500/30 text-white/50 cursor-wait'
              : 'bg-red-500 hover:bg-red-600 text-white shadow-sm'
            }
          `}
        >
          {showSpinner ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.22-8.56" strokeLinecap="round"/>
            </svg>
          ) : isPlaying ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current translate-x-[1px]" viewBox="0 0 24 24">
              <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
          )}
        </button>

        {/* Content Column */}
        <div className="flex-grow min-w-0 flex flex-col gap-1.5 text-left">
          {/* Filename */}
          <p className="text-[13px] font-semibold text-slate-800 truncate" title={file.filename}>
            {file.filename}
          </p>

          {/* Inline Seekbar */}
          <div
            onClick={showSpinner ? undefined : seekTo}
            className={`h-1.5 bg-slate-100 rounded-full relative overflow-hidden group/bar ${showSpinner ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <div
              className="h-full bg-red-500 transition-all duration-100 rounded-full group-hover/bar:bg-red-400"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status Line */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium font-sans select-none">
            <div className="flex items-center gap-3">
              <span>{formatBytes(file.file_size)}</span>
              <span className="text-red-500 font-mono animate-pulse-soft">{timeLeft}</span>
              {file.is_locked && <span className="text-amber-600">Locked</span>}
            </div>
            <span className="font-mono text-[9px] text-slate-400">{currentTime} / {duration}</span>
          </div>
        </div>

        {/* Delete Action (only visible if owner) */}
        {isOwner && (
          <div className="flex-shrink-0 self-center">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
              title="Delete"
            >
              {isDeleting ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.22-8.56" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── 2. Standard Layout (Images, Videos, Documents) ───
  return (
    <div className="group animate-fadeUp bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-red-200 transition-all duration-300 relative shadow-sm">

      {/* Image Preview */}
      {isImage && previewUrl && (
        <div
          onClick={() => setShowZoomModal(true)}
          className="w-full bg-slate-50 overflow-hidden relative cursor-zoom-in border-b border-slate-100"
        >
          <img
            src={previewUrl}
            alt={file.filename}
            className="w-full max-h-80 object-contain transition-transform duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/90 border border-slate-200 text-slate-700 rounded-full p-2.5 shadow-lg backdrop-blur-sm hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview */}
      {isVideo && previewUrl && (
        <div className="w-full bg-slate-50 overflow-hidden relative border-b border-slate-100">
          <video
            src={previewUrl}
            controls
            controlsList="nodownload"
            className="w-full max-h-80 transition-transform duration-500 group-hover:scale-[1.01]"
            preload="metadata"
          />
        </div>
      )}

      {/* Zoom Modal */}
      {showZoomModal && (
        <div
          onClick={() => setShowZoomModal(false)}
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
        >
          <button
            onClick={() => setShowZoomModal(false)}
            className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full p-2.5 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <img
            src={previewUrl}
            alt={file.filename}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {/* Standard File Info Bar */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0 text-left">
          <p className="text-[13px] font-semibold text-slate-800 truncate" title={file.filename}>
            {file.filename}
          </p>
          {file.description && (
            <p className="text-[11px] text-slate-500 mt-1 italic break-words line-clamp-2" title={file.description}>
              {file.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-550 font-medium">
            <span>{formatBytes(file.file_size)}</span>
            <span className="text-red-500 font-mono animate-pulse-soft">{timeLeft}</span>

            {file.is_locked && <span className="text-amber-600">Locked</span>}

            {file.max_downloads === 1 && (
              <span className="text-orange-600">Burns after download</span>
            )}

            {file.max_downloads && file.max_downloads > 1 && (
              <span>{file.download_count}/{file.max_downloads} downloads</span>
            )}

            {file.download_count > 0 && !file.max_downloads && (
              <span>Downloaded {file.download_count}x</span>
            )}
          </div>
        </div>

        {/* Action icons (Delete, QR, Download) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 rounded-lg text-slate-400 hover:text-red-650 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
              title="Delete"
            >
              {isDeleting ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.22-8.56" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              )}
            </button>
          )}

          {!isVoiceNote && (
            <button
              onClick={() => onQr(file)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              title="QR Code"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="3" height="3"/>
                <path d="M21 14h-3v3h3v4h-4v-4"/>
              </svg>
            </button>
          )}

          {!isVoiceNote && (
            downloadProgressEntry ? (
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 text-[10px] font-bold font-mono">
                {downloadProgressEntry.status === 'connecting' && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                )}
                {downloadProgressEntry.status === 'streaming' && (
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <svg className="w-8 h-8 -rotate-90">
                      <circle
                        cx="16"
                        cy="16"
                        r="11"
                        className="stroke-slate-200 fill-none"
                        strokeWidth="2"
                      />
                      <circle
                        cx="16"
                        cy="16"
                        r="11"
                        className="stroke-red-500 fill-none transition-all duration-300"
                        strokeWidth="2"
                        strokeDasharray={2 * Math.PI * 11}
                        strokeDashoffset={2 * Math.PI * 11 * (1 - (downloadProgressEntry.percent || 0) / 100)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-[8px] font-bold font-mono text-slate-700">
                      {downloadProgressEntry.percent}%
                    </span>
                  </div>
                )}
                {downloadProgressEntry.status === 'cloud' && (
                  <svg className="w-4 h-4 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
                  </svg>
                )}
                {downloadProgressEntry.status === 'complete' && (
                  <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </div>
            ) : (
              <button
                onClick={() => onDownload(file)}
                className="p-2 rounded-lg text-slate-400 hover:text-red-550 hover:bg-red-50 transition-all cursor-pointer"
                title="Download"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default FileCard;
