import { useState, useEffect, useRef } from "react";
import { useStash, isBackendConfigured } from "../hooks/useStash.js";
import {
  filesFromDataTransfer,
  filesFromClipboard,
} from "../lib/dropzone.js";
import VoiceRecorder from "../components/VoiceRecorder.jsx";
import { useMyUploads } from "../hooks/useMyUploads.js";
import { useNow } from "../hooks/useNow.js";
import ScreenShare from "../components/ScreenShare.jsx";
import RoomShell from "../components/RoomShell.jsx";
import GateScreen from "../components/GateScreen.jsx";
import UploadForm from "../components/UploadForm.jsx";
import Desk from "../components/Desk.jsx";
import ClipboardFeed from "../components/ClipboardFeed.jsx";
import QrCanvas from "../components/QrCode.jsx";

// Shadcn UI components
import { TooltipProvider } from "@/components/ui/tooltip.jsx";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";

import {
  AlertCircle,
  Copy,
  Lock,
  X,
  Upload,
  Eye,
  EyeOff,
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
    setRoomId,
    fetchRoomDetails,
    refreshFiles,
    uploadProgress,
    uploadFile,
    downloadFile,
    deleteFile,
    createRoom,
    deleteRoom: handleRoomDelete,
    leaveRoom: handleRoomLeave,
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
    stopScreenShare,
  } = useStash();

  const { isOwner: isFileOwner } = useMyUploads();
  // One shared 1s clock drives every expiry countdown on the desk.
  const now = useNow();

  // Authoritative: the server sets is_host by verifying our signed host token.
  // This used to compare creator_socket_id against a locally-generated client
  // id, which the server no longer discloses (it was forgeable as a credential).
  const isRoomHost = !!room.is_host;

  // Mode and form states
  const [activeMode, setActiveMode] = useState("files"); // files, clipboard, voice, screen

  // Modals state variables


  const [requests, setRequests] = useState([]);

  // Reset access requests and approved list on room changes. Done during
  // render rather than in an effect so the stale list is never painted.
  const [prevRoomId, setPrevRoomId] = useState(room.id);
  if (prevRoomId !== room.id) {
    setPrevRoomId(room.id);
    setRequests([]);
  }


  const [unlockingFile, setUnlockingFile] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [activeQrFile, setActiveQrFile] = useState(null);

  // Reset password visibility when the unlock target changes. Derived during
  // render instead of in an effect to avoid a cascading re-render.
  const [prevUnlockingFile, setPrevUnlockingFile] = useState(unlockingFile);
  if (prevUnlockingFile !== unlockingFile) {
    setPrevUnlockingFile(unlockingFile);
    setShowUnlockPassword(false);
  }

  // Ask for notification permissions on lobby load
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // A title of its own, naming the room and its lifetime. The app previously
  // shared the marketing page's title verbatim.
  useEffect(() => {
    const previous = document.title;
    const name = room.name || room.id || "stash:default";
    document.title = `${name} — a Stash room that deletes itself in 24 hours`;
    return () => {
      document.title = previous;
    };
  }, [room.name, room.id]);

  // Sync access requests from socket
  useEffect(() => {
    const handleRequest = (e) => {
      const data = e.detail;
      if (data.roomId === room.id) {
        setRequests((prev) => {
          if (prev.find((r) => r.clientId === data.clientId)) return prev;
          return [...prev, data];
        });

        // Trigger native desktop notification if window is backgrounded
        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.hidden
        ) {
          const notif = new Notification(`Lobby: ${data.guestName} joined`, {
            body: `Guest wants to join your room "${room.name || "stash:default"}". Click to approve/deny.`,
            tag: `join-request-${data.clientId}`,
            requireInteraction: true,
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        }
      }
    };
    window.addEventListener("stash-join-request", handleRequest);
    return () =>
      window.removeEventListener("stash-join-request", handleRequest);
  }, [room.id, room.name]);

  // Listen for custom events to switch active mode tabs
  useEffect(() => {
    const switchToFiles = () => setActiveMode("files");
    const switchToClipboard = () => setActiveMode("clipboard");
    const switchToScreen = () => setActiveMode("screen");

    window.addEventListener("stash-switch-to-files", switchToFiles);
    window.addEventListener("stash-switch-to-clipboard", switchToClipboard);
    window.addEventListener("stash-switch-to-screen", switchToScreen);

    return () => {
      window.removeEventListener("stash-switch-to-files", switchToFiles);
      window.removeEventListener(
        "stash-switch-to-clipboard",
        switchToClipboard,
      );
      window.removeEventListener("stash-switch-to-screen", switchToScreen);
    };
  }, []);

  // Page-wide Drag & Drop hooks
  const [isDraggingPage, setIsDraggingPage] = useState(false);
  const dragCounter = useRef(0);

  // useStash returns fresh function identities every render. Holding the latest
  // in refs lets the global drag/drop and paste listeners register exactly once
  // instead of being torn down and re-added on every render.
  const uploadFileRef = useRef(uploadFile);
  const sendClipboardRef = useRef(sendClipboard);
  useEffect(() => {
    uploadFileRef.current = uploadFile;
    sendClipboardRef.current = sendClipboard;
  });

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter.current++;
      setIsDraggingPage(true);
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDraggingPage(false);
      }
    };

    const handleDrop = async (e) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDraggingPage(false);

      const files = await filesFromDataTransfer(e.dataTransfer);
      if (files.length === 0) return;

      // Report the real outcome: uploadFile resolves false on failure.
      toast.promise(uploadFileRef.current(files), {
        loading: `Stashing ${files.length} item(s)...`,
        success: (ok) =>
          ok
            ? `Stashed ${files.length} item(s)`
            : Promise.reject(new Error("Upload failed")),
        error: "Upload failed. Please try again.",
      });
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
    // Registered once. The handler reads the latest uploadFile through a ref,
    // because useStash returns a new function identity on every render.
  }, []);

  // Ctrl+V Paste event handler
  useEffect(() => {
    const handlePaste = async (e) => {
      const target = e.target;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const clipboardData = e.clipboardData || e.originalEvent?.clipboardData;
      const filesToUpload = filesFromClipboard(clipboardData);

      if (filesToUpload.length > 0) {
        e.preventDefault();
        const label =
          filesToUpload.length === 1
            ? `"${filesToUpload[0].name}"`
            : `${filesToUpload.length} files`;

        // uploadFile resolves false on failure, so reject to trigger the error toast.
        toast.promise(uploadFileRef.current(filesToUpload), {
          loading: `Uploading pasted ${label}...`,
          success: (ok) =>
            ok
              ? `Pasted ${label} stashed`
              : Promise.reject(new Error("Upload failed")),
          error: "Failed to upload pasted file.",
        });
        return;
      }

      if (!isInput) {
        const text = clipboardData?.getData("text");
        if (text && text.trim()) {
          e.preventDefault();
          sendClipboardRef.current(text.trim());
          toast.success("Synced text clipboard to room!");
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

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

  // URL Interception for QR code scans.
  // The download is kicked off from a microtask so the state updates it makes
  // land outside the effect body rather than cascading synchronously. The ref
  // guard keeps a re-render of room.files from re-triggering the same download.
  const handledDownloadParam = useRef(false);
  useEffect(() => {
    if (handledDownloadParam.current) return;

    const params = new URLSearchParams(window.location.search);
    const downloadId = params.get("download");
    if (!downloadId || room.files.length === 0) return;

    const file = room.files.find((f) => f.id === downloadId);
    if (!file) return;

    handledDownloadParam.current = true;
    // Clean URL query
    window.history.replaceState({}, document.title, window.location.pathname);

    queueMicrotask(() => handleDownloadInitiation(file));
    // handleDownloadInitiation is intentionally omitted: the ref guard above
    // makes this run exactly once, so re-subscribing on every render is noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.files]);

  // Copy helpers. Report failure instead of always claiming success —
  // clipboard writes reject on insecure origins and when the doc isn't focused.
  const copyOrWarn = async (text, label) => {
    if (await copyToClipboard(text)) {
      toast.success(`${label} copied to clipboard!`);
    } else {
      toast.error(`Couldn't copy automatically — select the ${label} to copy it.`);
    }
  };


  // Handle Guest approvals
  const handleApprove = (guestClientId, guestSocketId, guestName = "Guest") => {
    approveGuest(room.id, guestSocketId, guestClientId);
    setRequests((prev) => prev.filter((r) => r.clientId !== guestClientId));
    toast.success(`${guestName} is in.`);
  };

  const handleDeny = (guestClientId, guestSocketId) => {
    denyGuest(room.id, guestSocketId);
    setRequests((prev) => prev.filter((r) => r.clientId !== guestClientId));
    toast.error("Guest access denied!");
  };


  // Edit Room Settings handler

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

  // Room-scoped: a bare `?download=<id>` lands the scanner in *their* default
  // room, where the file doesn't exist and the download silently never fires.
  const getFileShareLink = (fileId) =>
    `${window.location.origin}/rooms/${room.id}?download=${fileId}`;

  // A production build with no VITE_BACKEND_URL can't reach an API at all.
  // Say so instead of presenting a UI whose every action fails.
  if (!isBackendConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 font-sans">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold text-slate-900">
            Stash isn&apos;t configured
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            This deployment has no backend URL set, so files can&apos;t be
            uploaded or downloaded. If you run this instance, set{" "}
            <code className="bg-slate-200 px-1.5 py-0.5 rounded text-[13px]">
              VITE_BACKEND_URL
            </code>{" "}
            to your deployed backend origin and redeploy.
          </p>
          <a
            href="https://github.com/Hamzaisadev/Stash#self-hosting--local-development"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-semibold text-red-600 hover:text-red-700 underline"
          >
            Setup instructions
          </a>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delay={300}>
      {gate ? (
        <GateScreen
          gate={gate}
          joinRoomWithKey={joinRoomWithKey}
          requestAccessAcceptOnly={requestAccessAcceptOnly}
          fetchRoomDetails={fetchRoomDetails}
        />
      ) : (
        <RoomShell
          room={room}
          myRooms={myRooms}
          joinedRooms={joinedRooms}
          activeMode={activeMode}
          onChangeMode={setActiveMode}
          counts={{ files: room.files.length, clipboard: clipboard.length }}
          isHost={isRoomHost}
          isLive={screenShare.isSharing || Boolean(screenShare.remoteStream)}
          onSwitchRoom={setRoomId}
          onCreateRoom={createRoom}
          onJoinRoom={(id) => setRoomId(id)}
          onUpdateRoom={updateRoomSettings}
          onDeleteRoom={handleRoomDelete}
          onLeaveRoom={handleRoomLeave}
          onRotateKey={rotateStackKey}
        >
          {/* Access requests: inline, not a dialog. They need answering while
              you keep working, so they sit above the content. */}
          {requests.length > 0 && (
            <section className="rq" aria-label="People waiting to join">
              {requests.map((r) => (
                <div className="rq__row" key={r.clientId}>
                  <span className="rq__who">
                    <strong>{r.guestName || "Someone"}</strong> wants in
                    <span className="rq__id lp-mono">
                      {r.clientId.slice(0, 10)}…
                    </span>
                  </span>
                  <span className="rq__acts">
                    <button
                      type="button"
                      className="rs__btn"
                      onClick={() =>
                        handleApprove(r.clientId, r.guestSocketId, r.guestName)
                      }
                    >
                      Let them in
                    </button>
                    <button
                      type="button"
                      className="rs__btn rs__btn--ghost"
                      onClick={() => handleDeny(r.clientId, r.guestSocketId)}
                    >
                      Deny
                    </button>
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* Connection trouble reads as a quiet strip, not a red wall. The
              slot keeps its place so nothing shifts when it appears. */}
          <div
            role="status"
            aria-live="polite"
            className={`rs-alert ${status.error ? "is-on" : ""}`}
          >
            {status.error && (
              <>
                <AlertCircle aria-hidden="true" />
                <span>{status.error}</span>
              </>
            )}
          </div>

          {/* ── FILES ─────────────────────────────────────── */}
          {activeMode === "files" && (
            <>
              <UploadForm
                uploadFile={uploadFile}
                isUploading={status.isUploading}
                uploadProgress={uploadProgress}
              />
              <Desk
                files={room.files}
                isOwner={isFileOwner}
                onDownload={handleDownloadInitiation}
                onDelete={deleteFile}
                onShowQr={setActiveQrFile}
                downloadProgress={downloadProgress}
                now={now}
                refreshFiles={refreshFiles}
                fetchPreviewUrl={fetchPreviewUrl}
              />
              <VoiceRecorder
                onUpload={uploadFile}
                isUploading={status.isVoiceUploading}
                uploadProgress={uploadProgress}
              />
            </>
          )}

          {/* ── CLIPBOARD ─────────────────────────────────── */}
          {activeMode === "clipboard" && (
            <ClipboardFeed
              clipboard={clipboard}
              sendClipboard={sendClipboard}
              clearClipboard={clearClipboard}
              isRoomHost={isRoomHost}
            />
          )}

          {/* ── SCREEN ────────────────────────────────────── */}
          {activeMode === "screen" && (
            <ScreenShare
              isSharing={screenShare.isSharing}
              stream={screenShare.stream}
              remoteStream={screenShare.remoteStream}
              shareType={screenShare.shareType}
              onStart={startScreenShare}
              onStartWebcam={startWebcamShare}
              onStop={stopScreenShare}
            />
          )}
        </RoomShell>
      )}

      {/* Page-wide drop overlay */}
      {isDraggingPage && (
        <div className="drop-veil" aria-hidden="true">
          <div className="drop-veil__inner">
            <Upload />
            <p>Drop to stash it</p>
          </div>
        </div>
      )}

      {/* QR stays a popover: it is a thing you hold a phone up to. */}
      {activeQrFile && (
        <div
          className="qr-pop"
          role="dialog"
          aria-label={`QR code for ${activeQrFile.filename}`}
        >
          <button
            type="button"
            className="qr-pop__x"
            onClick={() => setActiveQrFile(null)}
            aria-label="Close QR code"
          >
            <X aria-hidden="true" />
          </button>
          <QrCanvas
            value={getFileShareLink(activeQrFile.id)}
            size={320}
            alt={`QR code linking to ${activeQrFile.filename}`}
            className="qr-pop__img"
          />
          <p className="qr-pop__name">{activeQrFile.filename}</p>
          <button
            type="button"
            className="rs__btn rs__btn--ghost"
            onClick={() => copyOrWarn(getFileShareLink(activeQrFile.id), "link")}
          >
            <Copy aria-hidden="true" /> Copy link
          </button>
        </div>
      )}

      {/* Unlock prompt for password-protected files. */}
      {unlockingFile && (
        <div className="qr-pop" role="dialog" aria-label="This file is locked">
          <button
            type="button"
            className="qr-pop__x"
            onClick={() => {
              setUnlockingFile(null);
              setUnlockPassword("");
              setDownloadError(null);
            }}
            aria-label="Cancel"
          >
            <X aria-hidden="true" />
          </button>
          <p className="qr-pop__name">
            <Lock aria-hidden="true" /> {unlockingFile.filename}
          </p>
          <form
            className="rs__form"
            onSubmit={(e) => {
              e.preventDefault();
              handleUnlockSubmit();
            }}
          >
            <label className="rs__field">
              <span>Password</span>
              <input
                type={showUnlockPassword ? "text" : "password"}
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                autoFocus
              />
            </label>
            {downloadError && (
              <p className="rs__hint rs__hint--bad">{downloadError}</p>
            )}
            <div className="rs__panel-actions">
              <button
                type="submit"
                className="rs__btn"
                disabled={!unlockPassword}
              >
                Unlock and download
              </button>
              <button
                type="button"
                className="rs__btn rs__btn--ghost"
                onClick={() => setShowUnlockPassword((v) => !v)}
              >
                {showUnlockPassword ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
                {showUnlockPassword ? "Hide" : "Show"}
              </button>
            </div>
          </form>
        </div>
      )}

      <Toaster position="bottom-center" richColors closeButton />
    </TooltipProvider>
  );
}

export default AppPage;
