import React, { useState, useRef, useEffect } from 'react';

function VoiceRecorder({ onUpload, isUploading }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Compile chunks to single webm blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Generate a custom filename with a timestamp
        const timestamp = Date.now().toString().substring(8);
        const audioFile = new File([audioBlob], `voice-drop-${timestamp}.webm`, {
          type: 'audio/webm',
          lastModified: Date.now()
        });

        // Auto upload the voice clip to the current room
        if (onUpload) {
          await onUpload(audioFile, { password: '', expiresIn: '20' });
        }

        // Release mic resources
        stream.getTracks().forEach(track => track.stop());
      };

      // Start capture
      mediaRecorder.start();
      setIsRecording(true);
      setRecordTime(0);

      // Start UI timer ticking
      timerRef.current = setInterval(() => {
        setRecordTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Microphone permission is required to drop voice notes.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-slate-950/30 border border-slate-850 rounded-2xl">
      <div className="text-center text-slate-400">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Context Voice Note</h4>
        <p className="text-xs max-w-xs leading-normal">
          {isRecording 
            ? "Recording audio... Tap again or release to drop into the room." 
            : "Drop a voice clip into the sharing feed to explain your files."}
        </p>
      </div>

      <div className="flex items-center space-x-4">
        {/* Dynamic Glowing Mic Button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isUploading}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 relative focus:outline-none ${isRecording ? 'bg-red-500 text-white animate-recording' : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'}`}
        >
          {isRecording ? (
            // Stop Icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          ) : (
            // Mic Icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>

        {isRecording && (
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-red-400 uppercase tracking-widest animate-pulse">Live</span>
            <span className="text-xl font-bold font-mono text-white leading-none mt-1">
              {formatTime(recordTime)}
            </span>
          </div>
        )}
      </div>

      {isUploading && (
        <span className="text-xs font-semibold text-slate-500 tracking-wider animate-pulse flex items-center gap-1.5 mt-2">
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          Stashing voice clip...
        </span>
      )}
    </div>
  );
}

export default VoiceRecorder;
