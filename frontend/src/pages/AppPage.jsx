import React, { useState, useEffect, useRef } from 'react';
import { useStash } from '../hooks/useStash.js';
import FileCard from '../components/FileCard.jsx';
import ActionBar from '../components/ActionBar.jsx';
import VoiceRecorder from '../components/VoiceRecorder.jsx';
import ScreenShare from '../components/ScreenShare.jsx';
import Sidebar from '../components/Sidebar.jsx';
import SettingsDrawer from '../components/SettingsDrawer.jsx';
import GateScreen from '../components/GateScreen.jsx';

function AppPage() {
  const {
    room,
    status,
    downloadProgress,
    clipboard,
    screenShare,
    gate,
    myRooms,
    joinedRooms,
    setRoomId,
    fetchDefaultRoom,
    fetchRoomDetails,
    refreshFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    createRoom,
    joinRoomWithKey,
    requestAccessAcceptOnly,
    approveGuest,
    denyGuest,
    updateRoomSettings,
    rotateStackKey,
    sendClipboard,
    clearClipboard,
    fetchPreviewUrl,
    startScreenShare,
    stopScreenShare
  } = useStash();

  // Mode and form states
  const [activeMode, setActiveMode] = useState('files'); // files, clipboard, voice, screen
  const [showSettings, setShowSettings] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    files: [],
    password: "",
    expiresIn: "20", // default to 20 mins for security
    maxDownloads: "",
    burnAfterDownload: false
  });

  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [unlockingFile, setUnlockingFile] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [downloadError, setDownloadError] = useState(null);
  const [activeQrFile, setActiveQrFile] = useState(null);
  const [clipboardText, setClipboardText] = useState("");

  const fileInputRef = useRef(null);

  // Helper: Verify if current browser uploaded file
  const isOwner = (fileId) => {
    const myUploads = JSON.parse(localStorage.getItem('stash_my_uploads') || '[]');
    return myUploads.includes(fileId);
  };

  // URL Interception for QR code scans
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const downloadId = params.get('download');

    if (downloadId && room.files.length > 0) {
      const file = room.files.find(f => f.id === downloadId);
      if (file) {
        handleDownloadInitiation(file);
        // Clean URL query
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [room.files]);

  // Copy friendly share link
  const handleCopyRoomId = () => {
    if (!room.id) return;
    const shareableUrl = `${window.location.origin}/${encodeURIComponent(room.id)}`;
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Create a brand new unique private room
  const handleCreateNewRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 10);
    window.history.pushState({}, '', `/${newRoomId}`);
    setRoomId(newRoomId);
  };

  // Drag and drop entry flatting
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const readAllEntries = async (entry) => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((f) => resolve([f]));
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise((resolve) => {
        dirReader.readEntries((results) => resolve(results));
      });
      const allFiles = [];
      for (const child of entries) {
        const childFiles = await readAllEntries(child);
        allFiles.push(...childFiles);
      }
      return allFiles;
    }
    return [];
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const allFiles = [];
      const entries = [];

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }

      if (entries.length > 0) {
        for (const entry of entries) {
          const files = await readAllEntries(entry);
          allFiles.push(...files);
        }
      }

      if (allFiles.length > 0) {
        setUploadForm(prev => ({ ...prev, files: allFiles }));
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setUploadForm(prev => ({ ...prev, files: Array.from(e.dataTransfer.files) }));
      }
    }
  };

  // Submit file upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.files || uploadForm.files.length === 0) return;

    const success = await uploadFile(uploadForm.files, {
      password: uploadForm.password,
      expiresIn: uploadForm.expiresIn,
      maxDownloads: uploadForm.burnAfterDownload ? "1" : uploadForm.maxDownloads
    });

    if (success) {
      setUploadForm({
        files: [],
        password: "",
        expiresIn: "20",
        maxDownloads: "",
        burnAfterDownload: false
      });
      setShowSettings(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Initiate download checks
  const handleDownloadInitiation = (file) => {
    if (file.is_locked) {
      setUnlockingFile(file);
      setUnlockPassword("");
      setDownloadError(null);
    } else {
      downloadFile(file);
    }
  };

  // Locked files submit unlock password
  const handleUnlockSubmit = async () => {
    const result = await downloadFile(unlockingFile, unlockPassword);
    if (result.success) {
      setUnlockingFile(null);
      setUnlockPassword("");
      setDownloadError(null);
    } else {
      setDownloadError(result.error);
    }
  };

  // Clipboard message trigger
  const handleClipboardSend = (e) => {
    e.preventDefault();
    if (!clipboardText.trim()) return;
    sendClipboard(clipboardText);
    setClipboardText("");
  };

  // Format size bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Qr codes server URL
  const getQrCodeUrl = (fileId) => {
    const link = `${window.location.origin}?download=${fileId}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=6366f1&bgcolor=0f172a&data=${encodeURIComponent(link)}`;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#07070a] text-slate-200 font-sans selection:bg-indigo-500/30">
      <Sidebar 
        myRooms={myRooms}
        joinedRooms={joinedRooms}
        currentRoomId={room.id}
        setRoomId={setRoomId}
        createRoom={createRoom}
        fetchDefaultRoom={fetchDefaultRoom}
      />
      <div 
        className="flex-1 flex flex-col relative h-full overflow-y-auto"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        {gate ? (
          <GateScreen 
            gate={gate} 
            joinRoomWithKey={joinRoomWithKey} 
            requestAccessAcceptOnly={requestAccessAcceptOnly} 
            fetchRoomDetails={fetchRoomDetails} 
          />
        ) : (
          <div className="pb-32 pt-6 px-4">
            <div className="max-w-2xl mx-auto space-y-6">

        {/* Minimal Collapsible Header Menu */}
        <header className="flex items-center justify-between bg-slate-900/40 backdrop-blur-xl border border-slate-900 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-black tracking-tighter text-white">Stash</span>
            <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-900">v2.0</span>
          </div>

          <div className="flex items-center bg-slate-950/60 border border-slate-900 rounded-xl px-3 py-1.5 space-x-2">
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Active Room</span>
              <span className="font-mono text-xs text-indigo-400 font-bold select-all leading-normal">
                {room.id || "Resolving..."}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 border-l border-slate-900 pl-2.5">
              {/* Create New Room Button */}
              <button
                onClick={handleCreateNewRoom}
                className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-900/50 transition-colors"
                title="Create New Private Room"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              <button
                onClick={handleCopyRoomId}
                className={`p-1 rounded-md transition-all ${copied ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-200'}`}
                title="Copy Invite Link"
              >
                {copied ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-1 rounded-md text-slate-500 hover:text-slate-200"
                title="Room Settings"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
              </button>

              <button
                onClick={refreshFiles}
                className="p-1 rounded-md text-slate-500 hover:text-slate-200"
                title="Refresh feed"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" /></svg>
              </button>
            </div>
          </div>
        </header>

        {/* Global errors banner */}
        {status.error && (
          <div className="bg-red-950/20 border border-red-500/20 text-red-400 rounded-xl p-3 flex items-center space-x-2 text-xs">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span>{status.error}</span>
          </div>
        )}

        {/* ==========================================
            Interactive Content Feeds Switcher
            ========================================== */}
        <main className="space-y-6">

          {/* A. Files Mode viewport */}
          {activeMode === 'files' && (
            <div className="space-y-6">

              {/* Expanding Upload Form */}
              <form onSubmit={handleUploadSubmit} className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 space-y-4" onDragEnter={handleDrag}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-950/20 hover:bg-slate-950/40 ${dragActive ? 'border-indigo-400 bg-indigo-500/5' : (uploadForm.files && uploadForm.files.length > 0) ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-slate-850 hover:border-slate-800'}`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={(e) => setUploadForm(prev => ({ ...prev, files: e.target.files ? Array.from(e.target.files) : [] }))}
                    className="hidden"
                  />
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mb-2 ${dragActive || (uploadForm.files && uploadForm.files.length > 0) ? 'text-indigo-400' : 'text-slate-600'}`}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                  <span className="text-xs font-semibold text-center truncate max-w-xs px-2">
                    {uploadForm.files && uploadForm.files.length > 0
                      ? (uploadForm.files.length === 1
                        ? uploadForm.files[0].name
                        : `${uploadForm.files.length} items ready to stash`)
                      : "Drag files, folders or select to upload"}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 font-mono">
                    {uploadForm.files && uploadForm.files.length > 0
                      ? formatBytes(uploadForm.files.reduce((acc, f) => acc + f.size, 0))
                      : "Max total archive size 100MB"}
                  </span>
                </div>

                {uploadForm.files && uploadForm.files.length > 0 && (
                  <div className="space-y-4 pt-2">
                    {/* Collapsible details toggler */}
                    <button
                      type="button"
                      onClick={() => setShowSettings(!showSettings)}
                      className="flex items-center justify-between w-full text-[10px] uppercase tracking-wider font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <span>Security Upload Configuration</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transform transition-transform ${showSettings ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
                    </button>

                    {showSettings && (
                      <div className="space-y-4 p-3 bg-slate-950/40 rounded-xl border border-slate-900 animate-slideDown">
                        {/* Burn Limit Toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-medium">Burn after download</span>
                          <button
                            type="button"
                            onClick={() => setUploadForm(prev => ({ ...prev, burnAfterDownload: !prev.burnAfterDownload }))}
                            className={`relative inline-flex h-4.5 w-8.5 items-center rounded-full transition-colors duration-300 focus:outline-none ${uploadForm.burnAfterDownload ? 'bg-orange-500/80' : 'bg-slate-800'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 ${uploadForm.burnAfterDownload ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>

                        {/* Password input */}
                        <div className="space-y-1 text-left">
                          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Access Password</label>
                          <input
                            type="password"
                            value={uploadForm.password}
                            onChange={(e) => setUploadForm(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Optional lock password"
                            className="w-full bg-slate-950 border border-slate-900 focus:border-indigo-500/40 rounded-lg py-2 px-3 text-xs outline-none text-slate-200 placeholder:text-slate-700 font-mono"
                          />
                        </div>

                        {/* Expiration dropdown */}
                        <div className="space-y-1 text-left">
                          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Auto-Destroy Expiration</label>
                          <select
                            value={uploadForm.expiresIn}
                            onChange={(e) => setUploadForm(prev => ({ ...prev, expiresIn: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-900 focus:border-indigo-500/40 rounded-lg p-2 text-xs outline-none text-slate-400 cursor-pointer"
                          >
                            <option value="5">5 Minutes</option>
                            <option value="20">20 Minutes</option>
                            <option value="60">1 Hour</option>
                          </select>
                        </div>

                        {/* Max downloads */}
                        {!uploadForm.burnAfterDownload && (
                          <div className="space-y-1 text-left">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Max download limit</label>
                            <input
                              type="number"
                              value={uploadForm.maxDownloads}
                              onChange={(e) => setUploadForm(prev => ({ ...prev, maxDownloads: e.target.value }))}
                              placeholder="e.g. 5 (Optional)"
                              min="1"
                              className="w-full bg-slate-950 border border-slate-900 focus:border-indigo-500/40 rounded-lg py-2 px-3 text-xs outline-none text-slate-200 placeholder:text-slate-700"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stash submission CTA */}
                    <button
                      type="submit"
                      disabled={status.isUploading}
                      className="w-full bg-white hover:bg-slate-200 text-slate-950 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {status.isUploading ? "Uploading archive..." : uploadForm.burnAfterDownload ? "Stash & Burn" : "Stash Archive"}
                    </button>
                  </div>
                )}
              </form>

              {/* Shared Files list feed */}
              <div className="space-y-4">
                {room.files.length === 0 ? (
                  <div className="py-20 text-center text-slate-600">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-slate-800"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                    <p className="text-xs font-semibold">Feed is empty</p>
                    <p className="text-[10px] text-slate-700 mt-1">Files uploaded in this room will list here in real-time.</p>
                  </div>
                ) : (
                  room.files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      isOwner={isOwner(file.id)}
                      downloadProgress={downloadProgress}
                      onDownload={handleDownloadInitiation}
                      onDelete={deleteFile}
                      onQr={setActiveQrFile}
                      fetchPreviewUrl={fetchPreviewUrl}
                      refreshFiles={refreshFiles}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* B. Clipboard sync viewport */}
          {activeMode === 'clipboard' && (
            <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 space-y-4 animate-scaleUp">
              <form onSubmit={handleClipboardSend} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={clipboardText}
                  onChange={(e) => setClipboardText(e.target.value)}
                  placeholder="Paste a code snippet, link or text to sync..."
                  className="flex-grow bg-slate-950 border border-slate-900 focus:border-indigo-500/40 rounded-xl py-2.5 px-4 text-xs outline-none text-slate-200 placeholder:text-slate-700"
                />
                <button
                  type="submit"
                  disabled={!clipboardText.trim()}
                  className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 rounded-xl active:scale-95 transition-all disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </form>

              {clipboard.length === 0 ? (
                <div className="py-12 text-center text-slate-600">
                  <p className="text-xs">No clipboard clips shared yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {clipboard.slice().reverse().map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start justify-between text-xs p-3 rounded-xl border transition-all ${item.fromRemote ? 'bg-indigo-500/5 border-indigo-500/15 text-indigo-300' : 'bg-slate-950/40 border-slate-900 text-slate-400'}`}
                    >
                      <span className="break-all font-mono leading-relaxed select-all cursor-text text-left flex-grow">{item.text}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(item.text)}
                        className="ml-3 p-1 hover:bg-slate-900 rounded text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0"
                        title="Copy clip"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* C. Voice Drop viewport */}
          {activeMode === 'voice' && (
            <div className="animate-scaleUp">
              <VoiceRecorder
                onUpload={uploadFile}
                isUploading={status.isUploading}
              />
            </div>
          )}

          {/* D. Screen Share viewport */}
          {activeMode === 'screen' && (
            <div className="animate-scaleUp">
              <ScreenShare
                isSharing={screenShare.isSharing}
                stream={screenShare.stream}
                remoteStream={screenShare.remoteStream}
                onStart={startScreenShare}
                onStop={stopScreenShare}
              />
            </div>
          )}

        </main>

        {/* Bottom Switcher Navigation Bar */}
        <ActionBar
          activeMode={activeMode}
          onChangeMode={setActiveMode}
          roomFileCount={room.files.length}
          clipboardCount={clipboard.length}
        />

        {/* 5. Password modal overlay */}
        {unlockingFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="w-full max-w-xs bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4 animate-scaleUp">
              <div className="flex items-center space-x-2 text-amber-500 border-b border-slate-850 pb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-bounce"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <h3 className="text-sm font-bold">Unlocking File</h3>
              </div>

              <p className="text-[10px] text-slate-500 text-left leading-normal">
                This file <span className="font-semibold text-slate-300 font-mono">{unlockingFile.filename}</span> is protected. Enter the decryption password.
              </p>

              {downloadError && (
                <div className="bg-red-950/40 border border-red-500/20 text-red-400 rounded-lg p-2.5 text-[10px] text-left">
                  {downloadError}
                </div>
              )}

              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
                placeholder="Password"
                autoFocus
                className="w-full bg-slate-950 border border-slate-900 focus:border-amber-500/50 rounded-lg py-2 px-3 text-xs outline-none text-slate-200 placeholder:text-slate-700 font-mono"
              />

              <div className="flex items-center space-x-2 pt-1 text-xs">
                <button
                  onClick={() => setUnlockingFile(null)}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 text-slate-400 py-2 rounded-xl font-semibold border border-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlockSubmit}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-xl font-semibold"
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. QR Code popover modal */}
        {activeQrFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="w-full max-w-xs bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-2xl text-center relative animate-scaleUp">
              <button
                onClick={() => setActiveQrFile(null)}
                className="absolute top-4 right-4 p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>

              <div className="flex flex-col items-center space-y-1.5 mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><path d="M21 14h-3v3h3v4h-4v-4" /></svg>
                <h3 className="text-sm font-bold">Scan to Download</h3>
                <p className="text-[10px] text-slate-500 max-w-xs px-2 leading-normal">
                  Point any phone camera to download <span className="font-semibold text-slate-300 font-mono">{activeQrFile.filename}</span> directly.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 border border-slate-850 rounded-xl inline-block shadow-inner mb-3">
                <img
                  src={getQrCodeUrl(activeQrFile.id)}
                  alt="QR code"
                  className="w-40 h-40 rounded-lg"
                />
              </div>

              <div className="text-[9px] font-mono text-slate-600 truncate max-w-xs mx-auto select-all">
                {`${window.location.origin}?download=${activeQrFile.id}`}
              </div>
            </div>
          </div>
        )}
      </div>

      <SettingsDrawer 
        room={room} 
        updateRoomSettings={updateRoomSettings} 
        rotateStackKey={rotateStackKey} 
        approveGuest={approveGuest} 
        denyGuest={denyGuest} 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  );
}

export default AppPage;
