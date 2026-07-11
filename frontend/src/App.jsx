import React, { useState, useRef } from 'react';
import { useStash } from './hooks/useStash.js';
import { 
  FolderIcon, 
  UploadIcon, 
  LockIcon, 
  UnlockIcon, 
  ClockIcon, 
  DownloadIcon, 
  RefreshCwIcon, 
  KeyIcon, 
  UserCheckIcon, 
  FileTextIcon, 
  ImageIcon, 
  VideoIcon, 
  ArchiveIcon, 
  AlertCircleIcon
} from 'lucide-react';

function App() {
  // 1. Consume our custom hook containing all room, sockets, and network logic
  const { 
    room, 
    status, 
    setRoomId, 
    refreshFiles, 
    uploadFile, 
    downloadFile 
  } = useStash();

  // 2. Local UI states (Form inputs & temporary modals)
  const [uploadForm, setUploadForm] = useState({
    file: null,
    password: "",
    expiresIn: "1440", // default to 24 hours
    maxDownloads: ""
  });

  const [unlockingFile, setUnlockingFile] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [downloadError, setDownloadError] = useState(null);

  const fileInputRef = useRef(null);

  // Helper: Format byte counts to human-readable size formats
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper: Resolve relevant file extension icons
  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-6 h-6 text-emerald-400" />;
    if (mimeType.startsWith('video/')) return <VideoIcon className="w-6 h-6 text-pink-400" />;
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document')) {
      return <FileTextIcon className="w-6 h-6 text-blue-400" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) {
      return <ArchiveIcon className="w-6 h-6 text-amber-400" />;
    }
    return <FolderIcon className="w-6 h-6 text-slate-400" />;
  };

  // Handle file upload submit
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) return;

    const success = await uploadFile(uploadForm.file, {
      password: uploadForm.password,
      expiresIn: uploadForm.expiresIn,
      maxDownloads: uploadForm.maxDownloads
    });

    if (success) {
      // Reset upload form
      setUploadForm({
        file: null,
        password: "",
        expiresIn: "1440",
        maxDownloads: ""
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle download triggers
  const handleDownloadInitiation = (file) => {
    if (file.is_locked) {
      setUnlockingFile(file);
      setUnlockPassword("");
      setDownloadError(null);
    } else {
      downloadFile(file.id);
    }
  };

  // Handle password submission for locked files
  const handleUnlockSubmit = async () => {
    const result = await downloadFile(unlockingFile.id, unlockPassword);
    if (result.success) {
      setUnlockingFile(null);
      setUnlockPassword("");
      setDownloadError(null);
    } else {
      setDownloadError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-tr from-slate-950 via-slate-900 to-indigo-950 text-slate-100 font-sans antialiased py-12 px-4 selection:bg-indigo-500/30">
      
      {/* Container Card */}
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Block */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3 text-left">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl shadow-lg shadow-indigo-500/5">
              <FolderIcon className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-linear-to-r from-indigo-200 via-indigo-400 to-purple-400 bg-clip-text text-transparent">STASH</h1>
              <p className="text-xs text-slate-400">Secure Network Sharing</p>
            </div>
          </div>

          {/* Room configuration display */}
          <div className="flex items-center bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2 space-x-3">
            <UserCheckIcon className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Active Room ID</span>
              <input 
                type="text" 
                value={room.id} 
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Resolving..."
                className="bg-transparent border-none outline-none font-mono text-sm text-indigo-300 w-36 font-semibold focus:text-indigo-400"
              />
            </div>
            <button 
              onClick={refreshFiles} 
              className="p-1 hover:bg-slate-800/50 rounded-lg transition-colors text-slate-400 hover:text-slate-100"
              title="Refresh Room files"
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {status.error && (
          <div className="bg-red-950/40 border border-red-500/30 text-red-300 rounded-xl p-4 flex items-center space-x-3 shadow-lg">
            <AlertCircleIcon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{status.error}</span>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left panel: Upload settings */}
          <section className="md:col-span-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 text-left">
              <UploadIcon className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold">Upload File</h2>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-5">
              {/* File Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 bg-slate-950/30 hover:bg-slate-950/60 ${uploadForm.file ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-700'}`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files[0] || null }))}
                  className="hidden" 
                />
                <UploadIcon className={`w-8 h-8 mb-3 transition-colors ${uploadForm.file ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="text-sm font-semibold text-center truncate max-w-xs">
                  {uploadForm.file ? uploadForm.file.name : "Select or Drop File"}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  {uploadForm.file ? formatBytes(uploadForm.file.size) : "Up to 100MB"}
                </span>
              </div>

              {/* Password Setting Input */}
              <div className="space-y-1 text-left">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <LockIcon className="w-3 h-3" /> Password Protection (Optional)
                </label>
                <div className="relative">
                  <KeyIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type="password" 
                    value={uploadForm.password}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Set download password" 
                    className="w-full bg-slate-950/50 border border-slate-800/80 focus:border-indigo-500/80 rounded-xl py-2 px-10 text-sm outline-none text-slate-100 transition-colors"
                  />
                </div>
              </div>

              {/* Expiration Settings */}
              <div className="space-y-1 text-left">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <ClockIcon className="w-3 h-3" /> Expire After
                </label>
                <select 
                  value={uploadForm.expiresIn}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, expiresIn: e.target.value }))}
                  className="w-full bg-slate-950/50 border border-slate-800/80 focus:border-indigo-500/80 rounded-xl p-2.5 text-sm outline-none text-slate-300 transition-colors cursor-pointer"
                >
                  <option className="bg-slate-950" value="5">5 Minutes</option>
                  <option className="bg-slate-950" value="60">1 Hour</option>
                  <option className="bg-slate-950" value="1440">24 Hours</option>
                </select>
              </div>

              {/* Download limit configurations */}
              <div className="space-y-1 text-left">
                <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <DownloadIcon className="w-3 h-3" /> Max Download Count (Optional)
                </label>
                <input 
                  type="number" 
                  value={uploadForm.maxDownloads}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, maxDownloads: e.target.value }))}
                  placeholder="e.g. 1 (Burn after reading)" 
                  min="1"
                  className="w-full bg-slate-950/50 border border-slate-800/80 focus:border-indigo-500/80 rounded-xl py-2 px-4 text-sm outline-none text-slate-100 transition-colors"
                />
              </div>

              {/* Submit Trigger */}
              <button 
                type="submit" 
                disabled={!uploadForm.file || status.isUploading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-3 text-sm font-semibold shadow-lg shadow-indigo-500/20 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {status.isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCwIcon className="w-4 h-4 animate-spin" /> Uploading...
                  </span>
                ) : "Stash File"}
              </button>
            </form>
          </section>

          {/* Right panel: Active files list */}
          <section className="md:col-span-7 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <FolderIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold">Shared Files</h2>
              </div>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {room.files.length} Item(s)
              </span>
            </div>

            {/* List area */}
            {status.isLoading ? (
              <div className="flex-grow flex flex-col items-center justify-center text-slate-400">
                <RefreshCwIcon className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                <p className="text-sm">Fetching files...</p>
              </div>
            ) : room.files.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-slate-500 py-12">
                <FolderIcon className="w-12 h-12 mb-3 text-slate-600/60" />
                <p className="text-sm font-medium">No files stashed in this room.</p>
                <p className="text-xs text-slate-600 mt-1">Upload a file or type a custom room ID to join sharing.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {room.files.map((file) => (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 hover:border-slate-700/80 transition-all duration-300 hover:translate-x-1"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-4">
                      {getFileIcon(file.mime_type)}
                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold truncate text-slate-200" title={file.filename}>
                          {file.filename}
                        </p>
                        
                        {/* Metadata labels */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 items-center mt-1 text-[10px] text-slate-500">
                          <span>{formatBytes(file.file_size)}</span>
                          
                          {/* Expiration label */}
                          <span className="flex items-center gap-0.5 text-indigo-400">
                            <ClockIcon className="w-2.5 h-2.5" />
                            {new Date(file.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {/* Lock status label */}
                          {file.is_locked ? (
                            <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                              <LockIcon className="w-2.5 h-2.5" /> Locked
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-emerald-500">
                              <UnlockIcon className="w-2.5 h-2.5" /> Open
                            </span>
                          )}

                          {/* Access constraints label */}
                          {file.max_downloads && (
                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.2 rounded-md">
                              {file.download_count}/{file.max_downloads} dl
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Download Button */}
                    <button 
                      onClick={() => handleDownloadInitiation(file)}
                      className="p-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/10 rounded-xl text-slate-400 hover:text-indigo-400 shadow-sm active:scale-95 transition-all flex-shrink-0"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Password Modal Dialog for Unlocking Files */}
      {unlockingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-500">
              <LockIcon className="w-5 h-5" />
              <h3 className="text-lg font-bold">Password Required</h3>
            </div>
            
            <p className="text-xs text-slate-400 text-left">
              The file <span className="font-semibold text-slate-200">{unlockingFile.filename}</span> is protected. Enter the password to unlock download.
            </p>

            {downloadError && (
              <div className="bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg p-2.5 text-xs text-left">
                {downloadError}
              </div>
            )}

            <input 
              type="password" 
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/80 rounded-xl py-2.5 px-4 text-sm outline-none text-slate-100"
              autoFocus
            />

            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setUnlockingFile(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUnlockSubmit}
                className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
