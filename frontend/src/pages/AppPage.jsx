import React, { useState, useEffect, useRef } from 'react';
import { useStash } from '../hooks/useStash.js';
import FileCard from '../components/FileCard.jsx';
import VoiceRecorder from '../components/VoiceRecorder.jsx';
import ScreenShare from '../components/ScreenShare.jsx';
import Sidebar from '../components/Sidebar.jsx';
import GateScreen from '../components/GateScreen.jsx';
import UploadForm from '../components/UploadForm.jsx';
import FileListFeed from '../components/FileListFeed.jsx';
import ClipboardFeed from '../components/ClipboardFeed.jsx';

// Shadcn UI components
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Lucide Icons
import { 
  Pencil, 
  Share2, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  Unlock, 
  Lock, 
  QrCode, 
  Copy, 
  ExternalLink,
  Info,
  RotateCw,
  LogOut,
  X,
  Menu
} from "lucide-react";

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
    clientId,
    setRoomId,
    fetchDefaultRoom,
    fetchRoomDetails,
    refreshFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    createRoom,
    deleteRoom: deleteRoomHook,
    leaveRoom: leaveRoomHook,
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
    startWebcamShare,
    stopScreenShare
  } = useStash();

  const isRoomHost = room.creator_socket_id === clientId || room.creator_socket_id === 'system';

  // Mode and form states
  const [activeMode, setActiveMode] = useState('files'); // files, clipboard, voice, screen

  // Modals state variables
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [showShareModal, setShowShareModal] = useState(false);
  const [requests, setRequests] = useState([]);

  const [deleteTargetRoomId, setDeleteTargetRoomId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [leaveTargetRoomId, setLeaveTargetRoomId] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [unlockingFile, setUnlockingFile] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [downloadError, setDownloadError] = useState(null);
  const [activeQrFile, setActiveQrFile] = useState(null);

  // Sync access requests from socket
  useEffect(() => {
    const handleRequest = (e) => {
      const data = e.detail;
      if (data.roomId === room.id) {
        setRequests(prev => {
          if (prev.find(r => r.clientId === data.clientId)) return prev;
          return [...prev, data];
        });
      }
    };
    window.addEventListener('stash-join-request', handleRequest);
    return () => window.removeEventListener('stash-join-request', handleRequest);
  }, [room.id]);

  // Listen for custom events to switch active mode tabs
  useEffect(() => {
    const switchToFiles = () => setActiveMode('files');
    const switchToClipboard = () => setActiveMode('clipboard');
    const switchToScreen = () => setActiveMode('screen');

    window.addEventListener('stash-switch-to-files', switchToFiles);
    window.addEventListener('stash-switch-to-clipboard', switchToClipboard);
    window.addEventListener('stash-switch-to-screen', switchToScreen);

    return () => {
      window.removeEventListener('stash-switch-to-files', switchToFiles);
      window.removeEventListener('stash-switch-to-clipboard', switchToClipboard);
      window.removeEventListener('stash-switch-to-screen', switchToScreen);
    };
  }, []);

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

  // Copy Room Link Helper
  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/rooms/${room.id}`;
    navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied to clipboard!");
  };

  // Copy Room ID Helper
  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(room.id);
    toast.success("Room ID copied to clipboard!");
  };

  // Handle open Share Modal for a specific room
  const handleOpenShareForRoom = (roomId) => {
    if (room.id !== roomId) {
      setRoomId(roomId);
    }
    setShowShareModal(true);
  };

  // Native share sheet trigger
  const handleNativeShare = async () => {
    const inviteLink = `${window.location.origin}/rooms/${room.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join Stash Room: ${room.name || 'default'}`,
          text: `Use Stash to share files, clipboard items, and screens instantly in this private room!`,
          url: inviteLink
        });
        toast.success("Native share sheet opened!");
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast.error("Failed to trigger native sharing sheet");
        }
      }
    } else {
      navigator.clipboard.writeText(inviteLink);
      toast.success("Invite link copied! Native sharing not supported on this device.");
    }
  };

  // Rotate Stack Key
  const handleRotateKey = async () => {
    const res = await rotateStackKey(room.id);
    if (res.success) {
      toast.success(`Rotated Stack Key to: ${res.stack_key}`);
    } else {
      toast.error(res.error || "Failed to rotate stack key");
    }
  };

  // Handle Guest approvals
  const handleApprove = (guestClientId, guestSocketId) => {
    approveGuest(room.id, guestSocketId, guestClientId);
    setRequests(prev => prev.filter(r => r.clientId !== guestClientId));
    toast.success("Guest access approved!");
  };

  const handleDeny = (guestClientId, guestSocketId) => {
    denyGuest(room.id, guestSocketId);
    setRequests(prev => prev.filter(r => r.clientId !== guestClientId));
    toast.error("Guest access denied!");
  };

  // Edit Room Settings handler
  const handleEditRoomSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return toast.error("Room name is required");
    setIsSavingEdit(true);
    const res = await updateRoomSettings(room.id, {
      name: editName.trim(),
      description: editDescription.trim()
    });
    setIsSavingEdit(false);
    if (res.success) {
      toast.success("Room details updated successfully!");
      setShowEditModal(false);
    } else {
      toast.error(res.error || "Failed to update room details");
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
      toast.success("File unlocked and downloaded!");
    } else {
      setDownloadError(result.error);
      toast.error(result.error || "Incorrect password");
    }
  };

  // Qr codes server URL for files
  const getQrCodeUrl = (fileId) => {
    const link = `${window.location.origin}?download=${fileId}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=6366f1&bgcolor=0f172a&data=${encodeURIComponent(link)}`;
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#07070a] text-slate-200 font-sans selection:bg-indigo-500/30">
        <Sidebar 
          myRooms={myRooms}
          joinedRooms={joinedRooms}
          currentRoomId={room.id}
          setRoomId={setRoomId}
          createRoom={createRoom}
          deleteRoom={(id) => setDeleteTargetRoomId(id)}
          leaveRoom={(id) => setLeaveTargetRoomId(id)}
          onOpenJoinModal={() => setShowJoinModal(true)}
          fetchDefaultRoom={fetchDefaultRoom}
          activeMode={activeMode}
          onChangeMode={setActiveMode}
          roomFileCount={room.files.length}
          clipboardCount={clipboard.length}
          onOpenShareForRoom={handleOpenShareForRoom}
        />
        
        <div className="flex-grow flex flex-col relative h-full overflow-y-auto">
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

                {/* Notion-style Page Header */}
                <header className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4 sm:pb-4 sm:mb-6 text-left animate-fadeIn">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    {/* Mobile hamburger — only visible on small screens */}
                    <SidebarTrigger className="md:hidden text-slate-500 hover:text-slate-200 hover:bg-slate-900/60 rounded-lg p-1 sm:p-1.5 cursor-pointer shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate max-w-[120px] sm:max-w-none">{room.name || 'stash:default'}</h1>
                        {room.id && room.id !== 'undefined' && (
                          <button
                            onClick={() => {
                              setEditName(room.name || '');
                              setEditDescription(room.description || '');
                              setShowEditModal(true);
                            }}
                            className="text-slate-500 hover:text-slate-200 transition-colors p-0.5 sm:p-1 shrink-0"
                            title="Edit Room Info"
                          >
                            <Pencil className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </button>
                        )}
                      </div>
                      {room.description && (
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 truncate max-w-[140px] sm:max-w-none">{room.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 sm:space-x-3 bg-slate-950/60 border border-slate-900 rounded-lg sm:rounded-xl px-2 py-1 sm:px-3 sm:py-1.5 shadow-sm shrink-0">
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                      title="Share Room & Access Settings"
                    >
                      <Share2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                    </button>

                    {isRoomHost && room.id && room.id !== 'undefined' && (
                      <button
                        onClick={() => setDeleteTargetRoomId(room.id)}
                        className="p-1 sm:p-1.5 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete Room"
                      >
                        <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                      </button>
                    )}

                    <button
                      onClick={refreshFiles}
                      className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                      title="Refresh feed"
                    >
                      <RefreshCw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                    </button>
                  </div>
                </header>

                {/* Global errors banner */}
                {status.error && (
                  <div className="bg-red-950/20 border border-red-500/20 text-red-400 rounded-xl p-3 flex items-center space-x-2 text-xs">
                    <AlertCircle className="w-4 h-4" />
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <UploadForm 
                          uploadFile={uploadFile} 
                          isUploading={status.isUploading} 
                        />
                        <VoiceRecorder
                          onUpload={uploadFile}
                          isUploading={status.isUploading}
                        />
                      </div>
                      <FileListFeed 
                        room={room}
                        downloadProgress={downloadProgress}
                        onDownload={handleDownloadInitiation}
                        onDelete={deleteFile}
                        onQr={setActiveQrFile}
                        fetchPreviewUrl={fetchPreviewUrl}
                        refreshFiles={refreshFiles}
                      />
                    </div>
                  )}

                  {/* B. Clipboard sync viewport */}
                  {activeMode === 'clipboard' && (
                    <ClipboardFeed 
                      clipboard={clipboard}
                      sendClipboard={sendClipboard}
                    />
                  )}

                  {/* C. Screen Share viewport */}
                  {activeMode === 'screen' && (
                    <div className="animate-scaleUp">
                      <ScreenShare
                        isSharing={screenShare.isSharing}
                        stream={screenShare.stream}
                        remoteStream={screenShare.remoteStream}
                        shareType={screenShare.shareType}
                        onStart={startScreenShare}
                        onStartWebcam={startWebcamShare}
                        onStop={stopScreenShare}
                      />
                    </div>
                  )}

                </main>

                {/* File Password unlock modal */}
                <Dialog open={!!unlockingFile} onOpenChange={() => setUnlockingFile(null)}>
                  <DialogContent className="bg-[#111115] border-slate-900 max-w-xs text-slate-200">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-bold flex items-center gap-2 text-amber-500">
                        <Lock className="w-4 h-4 text-amber-500" />
                        Unlocking File
                      </DialogTitle>
                      <DialogDescription className="text-[10px] text-slate-500 leading-normal">
                        This file <span className="font-semibold text-slate-300 font-mono">{unlockingFile?.filename}</span> is protected. Enter the decryption password.
                      </DialogDescription>
                    </DialogHeader>

                    {downloadError && (
                      <div className="bg-red-950/40 border border-red-500/20 text-red-400 rounded-lg p-2.5 text-[10px] text-left">
                        {downloadError}
                      </div>
                    )}

                    <Input
                      type="password"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlockSubmit()}
                      placeholder="Password"
                      autoFocus
                      className="bg-slate-950 border-slate-900 text-xs focus:ring-amber-500/50"
                    />

                    <DialogFooter className="flex items-center space-x-2 pt-1">
                      <Button
                        variant="secondary"
                        onClick={() => setUnlockingFile(null)}
                        className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUnlockSubmit}
                        className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Unlock
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* QR Code popover modal */}
                <Dialog open={!!activeQrFile} onOpenChange={() => setActiveQrFile(null)}>
                  <DialogContent className="bg-[#111115] border-slate-900 max-w-xs text-slate-200 text-center">
                    <DialogHeader className="flex flex-col items-center text-center">
                      <QrCode className="w-5 h-5 text-indigo-400 mb-1" />
                      <DialogTitle className="text-sm font-bold">Scan to Download</DialogTitle>
                      <DialogDescription className="text-[10px] text-slate-500 max-w-xs px-2 leading-normal">
                        Point any phone camera to download <span className="font-semibold text-slate-300 font-mono">{activeQrFile?.filename}</span> directly.
                      </DialogDescription>
                    </DialogHeader>

                    {activeQrFile && (
                      <div className="bg-slate-950 p-3.5 border border-slate-850 rounded-xl inline-block shadow-inner mx-auto my-2">
                        <img
                          src={getQrCodeUrl(activeQrFile.id)}
                          alt="QR code"
                          className="w-40 h-40 rounded-lg"
                        />
                      </div>
                    )}

                    <div className="text-[9px] font-mono text-slate-600 truncate max-w-xs mx-auto select-all">
                      {activeQrFile && `${window.location.origin}?download=${activeQrFile.id}`}
                    </div>
                  </DialogContent>
                </Dialog>

              </div>
            </div>
          )}
        </div>

        {/* Modals & Popovers */}

        {/* 1. Join Room Modal */}
        <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
          <DialogContent className="bg-[#111115] border-slate-900 text-slate-200">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-white">Join Room Manually</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Enter the exact Room ID to sync and access its feed files.
              </DialogDescription>
            </DialogHeader>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (!joinRoomId.trim()) return toast.error("Room ID is required");
                setShowJoinModal(false);
                setRoomId(joinRoomId.trim());
                setJoinRoomId("");
              }}
              className="space-y-4 text-xs text-slate-300"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Room ID</label>
                <Input 
                  type="text" 
                  autoFocus
                  placeholder="Enter Room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="bg-slate-950 border-slate-900 text-xs focus:ring-indigo-500"
                />
              </div>
              <DialogFooter className="flex justify-end space-x-3 pt-2">
                <Button 
                  type="button"
                  variant="secondary"
                  onClick={() => setShowJoinModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Join
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 2. Edit Room Info Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="bg-[#111115] border-slate-900 text-slate-200">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-white">Edit Room Info</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Change the room name and workspace descriptions shown to guests.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditRoomSubmit} className="space-y-4 text-xs text-slate-300">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Room Name</label>
                <Input 
                  type="text" 
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-slate-950 border-slate-900 text-xs focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Description</label>
                <Textarea 
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-slate-950 border-slate-900 text-xs focus:ring-indigo-500 resize-none"
                />
              </div>
              <DialogFooter className="flex justify-end space-x-3 pt-2">
                <Button 
                  type="button"
                  variant="secondary"
                  disabled={isSavingEdit}
                  onClick={() => setShowEditModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isSavingEdit}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer min-w-[100px]"
                >
                  {isSavingEdit ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 3. Share Room & Security Settings Modal */}
        <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
          <DialogContent className="bg-[#111115] border-slate-900 text-slate-200 max-h-[90vh] overflow-y-auto pr-2">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-400" />
                Share Room & Security Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Generate invite options, QR scans, and protect access permissions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 text-xs text-slate-300">
              
              {/* Dynamic QR code section */}
              <div className="flex flex-col items-center space-y-2 bg-slate-950/40 border border-slate-900 rounded-2xl p-4 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=6366f1&bgcolor=0f172a&data=${encodeURIComponent(`${window.location.origin}/rooms/${room.id}`)}`}
                  alt="Room QR Code"
                  className="w-36 h-36 rounded-lg"
                />
                <span className="text-[10px] text-slate-500 font-medium">Scan QR to join room instantly</span>
              </div>

              {/* Share Link trigger */}
              <Button 
                onClick={handleNativeShare}
                className="w-full font-semibold cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Link
              </Button>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Invite Link</label>
                <div className="flex gap-2">
                  <Input 
                    type="text" 
                    readOnly 
                    value={`${window.location.origin}/rooms/${room.id}`}
                    className="flex-grow bg-slate-950 border-slate-900 text-[11px]"
                  />
                  <Button 
                    onClick={handleCopyInviteLink}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold cursor-pointer shrink-0"
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Room ID</label>
                <div className="flex gap-2">
                  <Input 
                    type="text" 
                    readOnly 
                    value={room.id}
                    className="flex-grow bg-slate-950 border-slate-900 text-[11px] font-mono"
                  />
                  <Button 
                    onClick={handleCopyRoomId}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold cursor-pointer shrink-0"
                  >
                    Copy
                  </Button>
                </div>
              </div>

              {isRoomHost && (
                <div className="border-t border-slate-900 pt-4 space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-left">Host Security Controls</label>
                  
                  {/* Private Room (Stash Key) Checkbox */}
                  <div className="space-y-3 border border-slate-900 bg-slate-950/20 p-3 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col text-left">
                        <span className="text-xs text-slate-200 font-semibold">Private Room (Stash Key)</span>
                        <span className="text-[10px] text-slate-500">Require guests to input a rotating Stash Key</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={!!room.is_protected}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          const res = await updateRoomSettings(room.id, { is_protected: checked });
                          if (res.success) {
                            toast.success(checked ? "Room set to Private" : "Private access disabled");
                          } else {
                            toast.error("Failed to update Private status");
                          }
                        }}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>
                    {room.is_protected && (
                      <div className="bg-[#1C1C22] border border-slate-800 rounded-xl p-3 space-y-2 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-medium">Stash Key Pin</span>
                          <span className="text-[11px] font-mono font-bold text-indigo-400 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">
                            {room.stack_key || "------"}
                          </span>
                        </div>
                        <Button 
                          onClick={handleRotateKey}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold cursor-pointer h-7"
                        >
                          Rotate Stack Key
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Manual Approval (Accept Only) Checkbox */}
                  <div className="space-y-3 border border-slate-900 bg-slate-950/20 p-3 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col text-left">
                        <span className="text-xs text-slate-200 font-semibold">Manual Approval (Accept Only)</span>
                        <span className="text-[10px] text-slate-500">Require host to approve each join request</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={!!room.accept_only}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          const res = await updateRoomSettings(room.id, { accept_only: checked });
                          if (res.success) {
                            toast.success(checked ? "Manual approval enabled" : "Manual approval disabled");
                          } else {
                            toast.error("Failed to update approval mode");
                          }
                        }}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>
                    {room.accept_only && requests.length > 0 && (
                      <div className="bg-[#1C1C22] border border-slate-850 rounded-xl p-3 space-y-2 text-left">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          Access Requests
                          <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{requests.length}</span>
                        </span>
                        <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                          {requests.map((req) => (
                            <li key={req.clientId} className="flex items-center justify-between text-[11px] p-2 bg-slate-950/40 rounded-lg">
                              <div className="flex flex-col truncate pr-2">
                                <span className="font-semibold text-slate-300 truncate">{req.guestName}</span>
                                <span className="text-[9px] text-slate-500 font-mono truncate">{req.clientId.substring(0, 10)}...</span>
                              </div>
                              <div className="flex gap-1.5">
                                <Button
                                  size="xs"
                                  onClick={() => handleApprove(req.clientId, req.guestSocketId)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] px-2 py-0.5 cursor-pointer h-6"
                                >
                                  Allow
                                </Button>
                                <Button
                                  size="xs"
                                  variant="destructive"
                                  onClick={() => handleDeny(req.clientId, req.guestSocketId)}
                                  className="text-white text-[9px] px-2 py-0.5 cursor-pointer h-6"
                                >
                                  Deny
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 4. Custom Delete Room Modal */}
        <Dialog open={!!deleteTargetRoomId} onOpenChange={(open) => { if (!isDeleting) setDeleteTargetRoomId(open ? deleteTargetRoomId : null); }}>
          <DialogContent className="bg-[#111115] border-slate-900 text-slate-200">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-white">Delete Room</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Are you sure you want to delete this room? This action is permanent and will immediately delete all files from storage.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end space-x-3 pt-2">
              <Button 
                variant="secondary"
                disabled={isDeleting}
                onClick={() => setDeleteTargetRoomId(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  const res = await deleteRoomHook(deleteTargetRoomId);
                  setIsDeleting(false);
                  setDeleteTargetRoomId(null);
                  if (res && res.success) {
                    toast.success("Room deleted successfully");
                  } else {
                    toast.error("Failed to delete room");
                  }
                }}
                className="text-white text-xs font-semibold cursor-pointer min-w-[90px]"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </span>
                ) : 'Yes, Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 5. Custom Leave Room Modal */}
        <Dialog open={!!leaveTargetRoomId} onOpenChange={(open) => { if (!isLeaving) setLeaveTargetRoomId(open ? leaveTargetRoomId : null); }}>
          <DialogContent className="bg-[#111115] border-slate-900 text-slate-200">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-white">Leave Room</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Are you sure you want to leave this room? It will be removed from your sidebar list but the room itself will continue to exist.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end space-x-3 pt-2">
              <Button 
                variant="secondary"
                disabled={isLeaving}
                onClick={() => setLeaveTargetRoomId(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                disabled={isLeaving}
                onClick={async () => {
                  setIsLeaving(true);
                  leaveRoomHook(leaveTargetRoomId);
                  await new Promise(r => setTimeout(r, 400));
                  setIsLeaving(false);
                  setLeaveTargetRoomId(null);
                  toast.success("Left room successfully");
                }}
                className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-semibold cursor-pointer min-w-[80px]"
              >
                {isLeaving ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Leaving...
                  </span>
                ) : 'Yes, Leave'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Sonner Toast Provider */}
        <Toaster position="top-right" richColors closeButton />
      </div>
    </SidebarProvider>
  );
}

export default AppPage;
