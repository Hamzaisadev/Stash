import React, { useState, useRef, useEffect } from 'react';

function VoiceRecorder({ onUpload, isUploading }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [barHeights, setBarHeights] = useState([16, 28, 20, 36, 24, 48, 30, 42, 22, 32, 16]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Clear timers and audio context on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      }
    };
  }, []);

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const cleanupVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    setBarHeights([16, 28, 20, 36, 24, 48, 30, 42, 22, 32, 16]);
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
        cleanupVisualizer();
        
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
          await onUpload(audioFile, { password: '', expiresIn: '20', isVoice: true });
        }

        // Release mic resources
        stream.getTracks().forEach(track => track.stop());
      };

      // Set up Audio Analyser for visualizer
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        const newHeights = [];
        for (let i = 0; i < 11; i++) {
          const dataIndex = Math.floor(i * 1.5) + 1;
          const val = dataArray[dataIndex] || 0;
          // Map range 0-255 to 4-56px height. Min 4px, Max 56px.
          const mappedHeight = 4 + (val / 255) * 52;
          newHeights.push(mappedHeight);
        }
        setBarHeights(newHeights);
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };

      animationFrameRef.current = requestAnimationFrame(updateVisualizer);

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
    <div className="flex flex-col items-center justify-between p-8 bg-white border border-slate-200 rounded-2xl shadow-sm animate-scaleUp h-full text-center min-h-[340px]">
      {/* Top Header Section */}
      <div className="text-center text-slate-500 w-full">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Context Voice Note</h4>
        <p className="text-xs text-slate-650 max-w-xs mx-auto leading-normal">
          {isRecording 
            ? "Recording live audio... Tap the stop button to save and drop." 
            : "Drop a voice clip into the sharing feed to explain your files."}
        </p>
      </div>

      {/* Middle Visualizer & Controls */}
      <div className="flex flex-col items-center justify-center w-full py-4 space-y-6 flex-grow">
        {/* Waveform Visualization */}
        <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-[220px]">
          {barHeights.map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-[height] duration-75 ease-out"
              style={{
                height: `${h}px`,
                backgroundColor: isRecording ? '#ef4444' : '#cbd5e1',
                transformOrigin: 'center'
              }}
            />
          ))}
        </div>

        {/* Mic / Stop Trigger Button */}
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isUploading}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 relative focus:outline-none cursor-pointer ${
              isRecording 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 scale-105 animate-pulse-soft' 
                : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-100 shadow-sm'
            }`}
          >
            {isRecording ? (
              // Stop Icon
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            ) : (
              // Mic Icon
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </button>

          {isRecording && (
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest animate-pulse">Live</span>
              <span className="text-lg font-bold font-mono text-slate-800 leading-none mt-0.5">
                {formatTime(recordTime)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Section */}
      <div className="w-full text-center h-8 flex items-center justify-center">
        {isUploading ? (
          <span className="text-xs font-semibold text-red-500 tracking-wider animate-pulse flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" stroke="currentColor" className="opacity-25" strokeWidth="4"></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"></path>
            </svg>
            Stashing voice note...
          </span>
        ) : isRecording ? (
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider animate-pulse">
            Speaking...
          </span>
        ) : (
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Ready to record
          </span>
        )}
      </div>
    </div>
  );
}

export default VoiceRecorder;
