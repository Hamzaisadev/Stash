import React, { useEffect, useRef, useState } from 'react';
import { 
  Monitor, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Maximize2, 
  Minimize2, 
  Tv, 
  X, 
  Square,
  Volume2,
  VolumeX
} from 'lucide-react';
import { toast } from 'sonner';

function ScreenShare({ isSharing, stream, remoteStream, shareType, onStart, onStartWebcam, onStop }) {
  const videoRef = useRef(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVolumeMuted, setIsVolumeMuted] = useState(false);

  // Bind local/remote stream to video tag srcObject
  useEffect(() => {
    if (videoRef.current) {
      if (isSharing && stream) {
        videoRef.current.srcObject = stream;
      } else if (remoteStream) {
        videoRef.current.srcObject = remoteStream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [isSharing, stream, remoteStream]);

  // Turn off focus mode if sharing stops
  useEffect(() => {
    if (!isSharing && !remoteStream) {
      setIsFocusMode(false);
    }
  }, [isSharing, remoteStream]);

  // Toggle Microphone Track
  const toggleMic = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        toast.warning("No audio tracks found in this stream.");
        return;
      }
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(!audioTracks[0].enabled);
      toast.success(audioTracks[0].enabled ? "Microphone Unmuted" : "Microphone Muted");
    }
  };

  // Toggle Volume for Remote Streams
  const toggleVolume = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsVolumeMuted(videoRef.current.muted);
    }
  };

  // Native Browser Fullscreen
  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        toast.error("Error enabling full screen mode.");
        console.error(err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const isActiveStream = (isSharing && stream) || remoteStream;
  const currentShareLabel = isSharing 
    ? (shareType === 'webcam' ? 'My Webcam Feed' : 'My Screen Share') 
    : 'Live Remote Stream';

  // Render Video Container and Floating Controls overlay
  const renderStreamViewport = () => (
    <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-xl flex items-center justify-center group/video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSharing || isVolumeMuted} // Always mute local to prevent feed loops
        className="w-full h-full object-contain max-h-[80vh]"
      />

      {/* Red live overlay indicator */}
      <div className="absolute top-4 left-4 bg-red-500/95 border border-red-400/20 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-2 select-none z-10 shadow-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
        {currentShareLabel}
      </div>

      {/* Glassmorphic floating control center overlays on video hover (or always in Focus mode) */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-2xl backdrop-blur-md bg-white/90 border border-slate-200 shadow-md transition-all duration-300 z-10 ${isFocusMode ? 'opacity-100' : 'opacity-0 group-hover/video:opacity-100'}`}>
        
        {/* Toggle Microphone (Presenter only, webcam type) */}
        {isSharing && shareType === 'webcam' && (
          <button
            onClick={toggleMic}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${isMicMuted ? 'bg-red-50 border-red-200 text-red-500' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* Volume Controls (Viewer only) */}
        {remoteStream && (
          <button
            onClick={toggleVolume}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${isVolumeMuted ? 'bg-red-550/15 border-red-200 text-red-500' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            title={isVolumeMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isVolumeMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}

        {/* Switch Source Button (Presenter only) */}
        {isSharing && (
          <button
            onClick={shareType === 'screen' ? onStartWebcam : onStart}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100 transition-all cursor-pointer"
            title={shareType === 'screen' ? "Switch to Webcam Share" : "Switch to Screen Share"}
          >
            {shareType === 'screen' ? <Video className="w-4 h-4 text-red-500" /> : <Monitor className="w-4 h-4 text-red-500" />}
          </button>
        )}

        {/* Stop Stream Button */}
        {isSharing && (
          <button
            onClick={onStop}
            className="p-2 rounded-xl bg-red-500 hover:bg-red-650 border border-red-500 text-white transition-all cursor-pointer"
            title="Stop Sharing"
          >
            <Square className="w-4 h-4 fill-white" />
          </button>
        )}

        {/* Toggle Theater/Focus Mode */}
        <button
          onClick={() => setIsFocusMode(!isFocusMode)}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${isFocusMode ? 'bg-red-50 border-red-200 text-red-500' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          title={isFocusMode ? "Exit Focus Mode" : "Focus Mode"}
        >
          {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
        </button>

        {/* Fullscreen Trigger */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-650 hover:bg-slate-100 transition-all cursor-pointer"
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // If in Focus Mode, render fullscreen layout overlay
  if (isFocusMode && isActiveStream) {
    return (
      <div className="fixed inset-0 z-[999] bg-slate-50 flex flex-col justify-center items-center p-4 md:p-8 animate-fadeIn text-slate-800">
        {/* Close/Exit Focus Page button on top right */}
        <button 
          onClick={() => setIsFocusMode(false)}
          className="absolute top-6 right-6 p-2 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-550 hover:text-slate-800 transition-all cursor-pointer z-20 shadow-sm"
          title="Exit Focus Page"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-full h-full max-w-5xl flex items-center justify-center">
          {renderStreamViewport()}
        </div>
      </div>
    );
  }

  // Normal Inline Viewport
  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-5 shadow-sm animate-scaleUp">
      <div className="text-center text-slate-500">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-red-550 mb-1">Live Call & Screen Share</h4>
        <p className="text-xs max-w-md leading-normal mx-auto text-slate-400">
          {isSharing 
            ? `You are currently casting your ${shareType === 'webcam' ? 'camera' : 'screen'} stream to this room.` 
            : remoteStream 
              ? "A peer is sharing their stream. Watch or expand focus below." 
              : "Cast your screen or camera feed in real-time. Zero configuration, secure sharing."}
        </p>
      </div>

      {isActiveStream ? (
        <div className="w-full max-w-xl mx-auto">
          {renderStreamViewport()}
        </div>
      ) : (
        /* Options to start sharing: side by side premium selectors */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
          {/* Screen Share option */}
          <button
            type="button"
            onClick={onStart}
            className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 hover:border-red-300 hover:bg-red-50/10 text-slate-650 hover:text-slate-800 rounded-2xl cursor-pointer transition-all duration-300 shadow-sm group"
          >
            <div className="p-3 bg-red-50 rounded-full text-red-500 group-hover:scale-110 transition-transform duration-300 mb-3 shadow-inner">
              <Monitor className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider mb-1">Share Screen</span>
            <span className="text-[10px] text-slate-400 text-center leading-normal">Cast your desktop window or chrome tab</span>
          </button>

          {/* Webcam Share option */}
          <button
            type="button"
            onClick={onStartWebcam}
            className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 hover:border-red-300 hover:bg-red-50/10 text-slate-650 hover:text-slate-800 rounded-2xl cursor-pointer transition-all duration-300 shadow-sm group"
          >
            <div className="p-3 bg-red-50 rounded-full text-red-500 group-hover:scale-110 transition-transform duration-300 mb-3 shadow-inner">
              <Video className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider mb-1">Share Webcam</span>
            <span className="text-[10px] text-slate-400 text-center leading-normal">Turn on your camera and microphone</span>
          </button>
        </div>
      )}

      {/* Controls under inline viewport when active */}
      {isActiveStream && !isFocusMode && (
        <div className="flex justify-center">
          {isSharing ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-500 hover:bg-red-100/60 text-xs font-semibold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop Sharing
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ScreenShare;
