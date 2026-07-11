import React, { useState, useEffect, useCallback } from 'react';

function FileCard({ file, isOwner, downloadProgress, onDownload, onDelete, onQr, fetchPreviewUrl, refreshFiles }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");

  const isImage = file.mime_type?.startsWith('image/');
  const isVideo = file.mime_type?.startsWith('video/');
  const isAudio = file.mime_type?.startsWith('audio/');
  const isMedia = isImage || isVideo || isAudio;

  // Load preview URL for media files
  useEffect(() => {
    if (isMedia && fetchPreviewUrl) {
      fetchPreviewUrl(file.id).then(url => {
        if (url) setPreviewUrl(url);
      });
    }
  }, [file.id, isMedia]);

  // Countdown timer
  useEffect(() => {
    const calc = () => {
      const diff = file.expires_at - Date.now();
      if (diff <= 0) { refreshFiles?.(); return "Expired"; }
      const s = Math.floor(diff / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const parts = [];
      if (h > 0) parts.push(`${h}h`);
      parts.push(`${m}m`);
      parts.push(`${sec}s`);
      return parts.join(" ");
    };
    setTimeLeft(calc());
    const t = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [file.expires_at]);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const progress = downloadProgress?.[file.id];

  return (
    <div className="animate-fadeUp bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-all duration-300">
      
      {/* Inline media preview */}
      {isImage && previewUrl && (
        <div className="w-full bg-black/40">
          <img 
            src={previewUrl} 
            alt={file.filename} 
            className="w-full max-h-80 object-contain"
            loading="lazy"
          />
        </div>
      )}

      {isVideo && previewUrl && (
        <div className="w-full bg-black">
          <video 
            src={previewUrl} 
            controls 
            controlsList="nodownload"
            className="w-full max-h-80"
            preload="metadata"
          />
        </div>
      )}

      {isAudio && previewUrl && (
        <div className="px-5 pt-5">
          <audio 
            src={previewUrl} 
            controls 
            controlsList="nodownload"
            className="w-full"
            preload="metadata"
          />
        </div>
      )}

      {/* File info bar */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white truncate" title={file.filename}>
            {file.filename}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-[#555] font-medium">
            <span>{formatBytes(file.file_size)}</span>
            <span className="text-[#6366f1] font-mono animate-pulse-soft">{timeLeft}</span>
            
            {file.is_locked && (
              <span className="text-amber-500">Locked</span>
            )}

            {file.max_downloads === 1 && (
              <span className="text-orange-400">Burns after download</span>
            )}

            {file.max_downloads && file.max_downloads > 1 && (
              <span>{file.download_count}/{file.max_downloads} downloads</span>
            )}

            {file.download_count > 0 && !file.max_downloads && (
              <span>Downloaded {file.download_count}x</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isOwner && (
            <button 
              onClick={() => onDelete(file.id)}
              className="p-2 rounded-lg text-[#444] hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Delete"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          )}

          <button 
            onClick={() => onQr(file)}
            className="p-2 rounded-lg text-[#444] hover:text-white hover:bg-white/[0.06] transition-all"
            title="QR Code"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><path d="M21 14h-3v3h3v4h-4v-4"/></svg>
          </button>

          {/* Download button — only for non-media files */}
          {!isMedia && (
            <>
              {progress ? (
                <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1] text-[10px] font-bold font-mono">
                  {progress.status === "connecting" && (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                  )}
                  {progress.status === "streaming" && <span>{progress.percent}%</span>}
                  {progress.status === "cloud" && (
                    <svg className="w-4 h-4 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>
                  )}
                  {progress.status === "complete" && (
                    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => onDownload(file)}
                  className="p-2 rounded-lg text-[#444] hover:text-[#6366f1] hover:bg-[#6366f1]/10 transition-all"
                  title="Download"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileCard;
