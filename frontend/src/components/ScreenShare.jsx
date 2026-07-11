import React, { useEffect, useRef } from 'react';

function ScreenShare({ isSharing, stream, remoteStream, onStart, onStop }) {
  const videoRef = useRef(null);

  // Bind local/remote stream to video tag srcObject
  useEffect(() => {
    if (videoRef.current) {
      if (isSharing && stream) {
        videoRef.current.srcObject = stream;
      } else if (remoteStream) {
        videoRef.current.srcObject = remoteStream;
      }
    }
  }, [isSharing, stream, remoteStream]);

  return (
    <div className="w-full bg-slate-950/40 border border-slate-850 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
      <div className="text-center text-slate-400">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Live Screen Share</h4>
        <p className="text-xs max-w-xs leading-normal mx-auto">
          {isSharing 
            ? "You are currently casting your screen to other peers in this room." 
            : remoteStream 
              ? "A peer is sharing their screen. Watching stream live." 
              : "Share your screen in real-time. Zero sign-up, zero installation."}
        </p>
      </div>

      {/* Live Stream Viewport */}
      {(isSharing && stream) || remoteStream ? (
        <div className="w-full relative bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl max-w-xl mx-auto">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSharing} // Mute local preview to prevent feedback loops
            className="w-full h-auto object-contain max-h-[360px]"
          />
          {/* Status Badge Overlay */}
          <div className="absolute top-3 left-3 bg-red-500/80 border border-red-400/20 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            {isSharing ? "Sharing" : "Live Feed"}
          </div>
        </div>
      ) : null}

      {/* Control Triggers */}
      <div className="flex items-center justify-center">
        {isSharing ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-semibold px-5 py-2.5 rounded-xl transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop Sharing
          </button>
        ) : !remoteStream ? (
          <button
            type="button"
            onClick={onStart}
            className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold px-5 py-2.5 rounded-xl hover:scale-[1.02] active:scale-98 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Start Sharing Screen
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default ScreenShare;
