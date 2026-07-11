import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const serverIP = window.location.hostname;
const API_BASE = `http://${serverIP}:5000/api`;
const SOCKET_BASE = `http://${serverIP}:5000`;

const generateClientId = () => {
    let id = localStorage.getItem('stash_client_id');
    if (!id) {
        id = 'client_' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem('stash_client_id', id);
    }
    return id;
};

const getAuthHeaders = (roomId = null) => {
    const headers = { 'x-host-id': generateClientId(), 'Content-Type': 'application/json' };
    if (roomId) {
        const tokens = JSON.parse(localStorage.getItem('stash_room_tokens') || '{}');
        if (tokens[roomId]) headers['x-room-access-token'] = tokens[roomId];
    }
    return headers;
};
// ==========================================
// Native Browser IndexedDB Persistence Layer
// ==========================================
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("stash_local_vault", 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("files_cache")) {
                db.createObjectStore("files_cache", { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

const saveFileToIndexedDB = async (fileId, fileObj) => {
    try {
        const db = await openDB();
        const tx = db.transaction("files_cache", "readwrite");
        const store = tx.objectStore("files_cache");
        store.put({ id: fileId, file: fileObj });
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("IndexedDB Save Failed:", err);
    }
};

const getFileFromIndexedDB = async (fileId) => {
    try {
        const db = await openDB();
        const tx = db.transaction("files_cache", "readonly");
        const store = tx.objectStore("files_cache");
        const request = store.get(fileId);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result?.file || null);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("IndexedDB Retrieval Failed:", err);
        return null;
    }
};

export function useStash() {
    // 1. State
    const [room, setRoom] = useState({ id: "", files: [], description: "", is_protected: false, accept_only: false, stack_key: null });
    const [status, setStatus] = useState({ isLoading: false, isUploading: false, error: null });
    const [downloadProgress, setDownloadProgress] = useState({});
    const [clipboard, setClipboard] = useState([]);
    const [gate, setGate] = useState(null);
    const [clientId] = useState(() => generateClientId());
    const [myRooms, setMyRooms] = useState(() => JSON.parse(localStorage.getItem('stash_my_rooms') || '[]'));
    const [joinedRooms, setJoinedRooms] = useState(() => JSON.parse(localStorage.getItem('stash_joined_rooms') || '[]'));

    useEffect(() => {
        localStorage.setItem('stash_my_rooms', JSON.stringify(myRooms));
    }, [myRooms]);

    useEffect(() => {
        localStorage.setItem('stash_joined_rooms', JSON.stringify(joinedRooms));
    }, [joinedRooms]);

    // Live Screen Share states
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenStream, setScreenStream] = useState(null);
    const [remoteScreenStream, setRemoteScreenStream] = useState(null);

    const socketRef = useRef(null);
    const activePeerConnections = useRef({});

    // Screen Share RTC references
    const screenStreamRef = useRef(null);
    const screenSharePCs = useRef({});
    const receiverScreenPC = useRef(null);

    // 2. Request browser notification permission on mount
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    // Helper: Fire a native desktop notification
    const fireNotification = useCallback((title, body) => {
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            new Notification(title, { body, icon: "📁" });
        }
    }, []);

    // 3. Initialize Sockets
    useEffect(() => {
        const socket = io(SOCKET_BASE, { withCredentials: true });
        socketRef.current = socket;

        // New file uploaded in room
        socket.on("file-uploaded", (newFile) => {
            setRoom(prev => {
                if (newFile.room_id !== prev.id) return prev;
                const alreadyExists = prev.files.some(f => f.id === newFile.id);
                if (alreadyExists) return prev;
                return { ...prev, files: [newFile, ...prev.files] };
            });

            // Feature 4: Desktop Push Notification
            fireNotification("New file received", `${newFile.filename} was shared in your room.`);
        });

        // File was deleted
        socket.on("file-deleted", (deletedFileId) => {
            setRoom(prev => ({
                ...prev,
                files: prev.files.filter(f => f.id !== deletedFileId)
            }));
            setDownloadProgress(prev => {
                const updated = { ...prev };
                delete updated[deletedFileId];
                return updated;
            });
        });

        // Room settings updated
        socket.on("room-updated", (updates) => {
            setRoom(prev => {
                if (prev.id !== updates.id) return prev;
                return { ...prev, ...updates };
            });
        });

        // Join requests (for creators)
        socket.on("join-request", (requestData) => {
            // In a full app, we'd add this to a queue state. For now, dispatch event or handle via simple alert
            window.dispatchEvent(new CustomEvent('stash-join-request', { detail: requestData }));
            fireNotification("Access Request", `${requestData.guestName} wants to join your room.`);
        });

        socket.on("join-approved", ({ token, roomId }) => {
            const tokens = JSON.parse(localStorage.getItem('stash_room_tokens') || '{}');
            tokens[roomId] = token;
            localStorage.setItem('stash_room_tokens', JSON.stringify(tokens));
            
            setJoinedRooms(prev => {
                const list = [...prev.filter(r => r.id !== roomId), { id: roomId }];
                return list;
            });
            window.dispatchEvent(new CustomEvent('stash-join-approved', { detail: { roomId } }));
            fireNotification("Access Granted", `You have been approved to join the room!`);
        });

        socket.on("join-denied", ({ roomId }) => {
            window.dispatchEvent(new CustomEvent('stash-join-denied', { detail: { roomId } }));
            fireNotification("Access Denied", `Your request to join was denied.`);
        });

        // Feature 1: Cross-device clipboard sync
        socket.on("clipboard-sync", ({ text }) => {
            setClipboard(prev => [...prev, { text, time: Date.now(), fromRemote: true }]);
            fireNotification("Clipboard received", text.substring(0, 80));
        });

        // Feature 2: Live Download Receipt updates
        socket.on("file-downloaded", ({ fileId, downloadCount }) => {
            setRoom(prev => ({
                ...prev,
                files: prev.files.map(f => f.id === fileId ? { ...f, download_count: downloadCount } : f)
            }));
        });

        // Peer is requesting a P2P download
        socket.on("p2p-request-file", async ({ fileId, requesterId }) => {
            const file = await getFileFromIndexedDB(fileId);
            if (file) {
                socket.emit("p2p-signal", {
                    roomId: room.id,
                    targetId: requesterId,
                    signal: { type: "p2p-ready", fileId }
                });
            }
        });

        // Relay SDP Offer/Answer/ICE Candidates
        socket.on("p2p-signal", async ({ signal, senderId }) => {
            try {
                if (signal.type === "p2p-ready") {
                    handlePeerAvailability(signal.fileId, senderId);
                } else if (signal.sdp) {
                    await handleIncomingSdp(signal.sdp, senderId);
                } else if (signal.candidate) {
                    await handleIncomingIceCandidate(signal.candidate, senderId);
                }
            } catch (err) {
                console.error("WebRTC Signaling Error:", err);
            }
        });

        // ==========================================
        // Live Screen Share Signaling Listeners
        // ==========================================
        socket.on("screen-share-start", ({ senderId }) => {
            // Presenter started sharing screen. Send request to bind tracks
            socket.emit("screen-share-signal", {
                roomId: room.id,
                targetId: senderId,
                signal: { type: "screen-request" }
            });
        });

        socket.on("screen-share-stop", () => {
            if (receiverScreenPC.current) {
                receiverScreenPC.current.close();
                receiverScreenPC.current = null;
            }
            setRemoteScreenStream(null);
        });

        socket.on("screen-share-signal", async ({ signal, senderId }) => {
            try {
                if (signal.type === "screen-request") {
                    // PRESENTER SIDE: Receiver wants our screen capture
                    const pc = new RTCPeerConnection({
                        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
                    });
                    screenSharePCs.current[senderId] = pc;

                    // Add captured screen tracks
                    const localStream = screenStreamRef.current;
                    if (localStream) {
                        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
                    }

                    pc.onicecandidate = (event) => {
                        if (event.candidate && socketRef.current) {
                            socketRef.current.emit("screen-share-signal", {
                                roomId: room.id,
                                targetId: senderId,
                                signal: { candidate: event.candidate }
                            });
                        }
                    };

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    socketRef.current.emit("screen-share-signal", {
                        roomId: room.id,
                        targetId: senderId,
                        signal: { sdp: pc.localDescription }
                    });
                } else if (signal.sdp && signal.sdp.type === "offer") {
                    // RECEIVER SIDE: Receive offer from presenter
                    const pc = new RTCPeerConnection({
                        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
                    });
                    receiverScreenPC.current = pc;

                    pc.ontrack = (event) => {
                        if (event.streams && event.streams[0]) {
                            setRemoteScreenStream(event.streams[0]);
                        }
                    };

                    pc.onicecandidate = (event) => {
                        if (event.candidate && socketRef.current) {
                            socketRef.current.emit("screen-share-signal", {
                                roomId: room.id,
                                targetId: senderId,
                                signal: { candidate: event.candidate }
                            });
                        }
                    };

                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    socketRef.current.emit("screen-share-signal", {
                        roomId: room.id,
                        targetId: senderId,
                        signal: { sdp: pc.localDescription }
                    });
                } else if (signal.sdp && signal.sdp.type === "answer") {
                    // PRESENTER SIDE: Receive answer from receiver
                    const pc = screenSharePCs.current[senderId];
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    }
                } else if (signal.candidate) {
                    // BOTH SIDES: Gather candidate
                    const pc = screenSharePCs.current[senderId] || receiverScreenPC.current;
                    if (pc) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    }
                }
            } catch (err) {
                console.error("Screen Share WebRTC Signaling Error:", err);
            }
        });

        return () => {
            if (socket) socket.disconnect();
            Object.values(activePeerConnections.current).forEach(pc => pc.close());
            Object.values(screenSharePCs.current).forEach(pc => pc.close());
            if (receiverScreenPC.current) receiverScreenPC.current.close();
        };
    }, [room.id]);

    // 4. Room resolution & Management
    const fetchDefaultRoom = async () => {
        setStatus(prev => ({ ...prev, isLoading: true, error: null }));
        setGate(null);
        try {
            const res = await fetch(`${API_BASE}/room`, {
                headers: getAuthHeaders()
            });
            const json = await res.json();
            if (res.status === 403) {
                setGate({ require_password: json.require_password, accept_only: json.accept_only, room_id: json.room_id });
                return { require_password: json.require_password, accept_only: json.accept_only, room_id: json.room_id };
            }
            if (json.status === "success") {
                setRoom(prev => ({ 
                    ...prev, 
                    id: json.data.id,
                    description: json.data.description,
                    is_protected: json.data.is_protected,
                    accept_only: json.data.accept_only,
                    stack_key: json.data.stack_key,
                }));
                return { success: true, room: json.data };
            }
            throw new Error(json.message);
        } catch (err) {
            setStatus(prev => ({ ...prev, error: err.message || "Unable to connect to backend server." }));
            return { error: err.message };
        } finally {
            setStatus(prev => ({ ...prev, isLoading: false }));
        }
    };

    const fetchRoomDetails = async (roomId) => {
        setStatus(prev => ({ ...prev, isLoading: true, error: null }));
        setGate(null);
        try {
            const res = await fetch(`${API_BASE}/room/${roomId}`, {
                headers: getAuthHeaders(roomId)
            });
            const json = await res.json();
            if (res.status === 403) {
                setGate({ require_password: json.require_password, accept_only: json.accept_only, room_id: json.room_id });
                return { require_password: json.require_password, accept_only: json.accept_only, room_id: json.room_id };
            }
            if (json.status === "success") {
                setRoom(prev => ({ 
                    ...prev, 
                    id: json.data.id,
                    description: json.data.description,
                    is_protected: json.data.is_protected,
                    accept_only: json.data.accept_only,
                    stack_key: json.data.stack_key,
                }));
                return { success: true, room: json.data };
            }
            throw new Error(json.message);
        } catch (err) {
            setStatus(prev => ({ ...prev, error: err.message }));
            return { error: err.message };
        } finally {
            setStatus(prev => ({ ...prev, isLoading: false }));
        }
    };

    const fetchRoomFiles = async (roomId) => {
        if (!roomId) return;
        setStatus(prev => ({ ...prev, error: null }));
        try {
            const res = await fetch(`${API_BASE}/files/${roomId}`, {
                headers: getAuthHeaders(roomId)
            });
            const json = await res.json();
            if (json.status === "success") {
                setRoom(prev => ({ ...prev, files: json.data.files }));
            }
        } catch (err) {
            setStatus(prev => ({ ...prev, error: "Failed to fetch room files." }));
        }
    };

    const createRoom = async (roomData) => {
        try {
            const res = await fetch(`${API_BASE}/room`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(roomData)
            });
            const json = await res.json();
            if (json.status === 'success') {
                const newRoomId = json.data.id;
                
                // Store token
                const tokens = JSON.parse(localStorage.getItem('stash_room_tokens') || '{}');
                tokens[newRoomId] = json.token;
                localStorage.setItem('stash_room_tokens', JSON.stringify(tokens));
                
                // Add to myRooms
                setMyRooms(prev => [...prev.filter(r => r.id !== newRoomId), { id: newRoomId, name: json.data.name }]);
                setRoom(prev => ({ ...prev, id: newRoomId, ...json.data }));
                return { success: true, room: json.data };
            }
            throw new Error(json.message);
        } catch (err) {
            return { error: err.message };
        }
    };

    const joinRoomWithKey = async (roomId, password) => {
        try {
            const res = await fetch(`${API_BASE}/room/${roomId}/join`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ password })
            });
            const json = await res.json();
            if (json.status === 'success') {
                const tokens = JSON.parse(localStorage.getItem('stash_room_tokens') || '{}');
                tokens[roomId] = json.token;
                localStorage.setItem('stash_room_tokens', JSON.stringify(tokens));
                
                setJoinedRooms(prev => [...prev.filter(r => r.id !== roomId), { id: roomId }]);
                return { success: true };
            }
            throw new Error(json.message);
        } catch (err) {
            return { error: err.message };
        }
    };

    const requestAccessAcceptOnly = (roomId, username) => {
        if (socketRef.current) {
            socketRef.current.emit("join-request", { roomId, username, clientId });
        }
    };

    const approveGuest = (roomId, guestSocketId, guestClientId) => {
        if (socketRef.current) {
            socketRef.current.emit("join-approve", { roomId, guestSocketId, guestClientId, hostId: clientId });
        }
    };

    const denyGuest = (roomId, guestSocketId) => {
        if (socketRef.current) {
            socketRef.current.emit("join-deny", { roomId, guestSocketId });
        }
    };

    const updateRoomSettings = async (roomId, settingsData) => {
        try {
            const res = await fetch(`${API_BASE}/room/${roomId}`, {
                method: 'PUT',
                headers: getAuthHeaders(roomId),
                body: JSON.stringify(settingsData)
            });
            const json = await res.json();
            if (json.status === 'success') {
                setRoom(prev => ({ ...prev, ...settingsData }));
                return { success: true };
            }
            throw new Error(json.message);
        } catch (err) {
            return { error: err.message };
        }
    };

    const rotateStackKey = async (roomId) => {
        try {
            const res = await fetch(`${API_BASE}/room/${roomId}/rotate-key`, {
                method: 'POST',
                headers: getAuthHeaders(roomId)
            });
            const json = await res.json();
            if (json.status === 'success') {
                setRoom(prev => ({ ...prev, stack_key: json.stack_key }));
                return { success: true, stack_key: json.stack_key };
            }
            throw new Error(json.message);
        } catch (err) {
            return { error: err.message };
        }
    };

    // Load default room on mount (with friendly URL routing)
    useEffect(() => {
        const path = window.location.pathname.substring(1);
        if (path && path.trim() !== "" && !path.includes('.') && path !== 'api') {
            const rid = decodeURIComponent(path);
            setRoom(prev => ({ ...prev, id: rid }));
            fetchRoomDetails(rid);
        } else {
            fetchDefaultRoom();
        }
    }, []);

    // Join room on Socket and fetch its files whenever room.id changes
    useEffect(() => {
        if (!room.id) return;
        fetchRoomFiles(room.id);
        if (socketRef.current) {
            socketRef.current.emit("join-room", room.id);
        }
    }, [room.id]);

    // 5. File Upload (with folder support)
    const uploadFile = async (selectedFiles, options) => {
        if (!selectedFiles) return;
        setStatus(prev => ({ ...prev, isUploading: true, error: null }));

        try {
            const formData = new FormData();
            
            let filesArray = [];
            if (selectedFiles instanceof FileList || Array.isArray(selectedFiles)) {
                filesArray = Array.from(selectedFiles);
                for (let i = 0; i < filesArray.length; i++) {
                    formData.append('files', filesArray[i]);
                }
            } else {
                filesArray = [selectedFiles];
                formData.append('files', selectedFiles);
            }

            formData.append('room_id', room.id);
            formData.append('password', options.password);
            formData.append('expires_in', options.expiresIn);
            if (options.maxDownloads) {
                formData.append('max_downloads', options.maxDownloads);
            }

            const res = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                headers: getAuthHeaders(room.id),
                body: formData
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || "Upload failed");
            }

            if (json.status === "success" || (json.data && json.data.id)) {
                const fileId = json.data.id;
                const myUploads = JSON.parse(localStorage.getItem('stash_my_uploads') || '[]');
                myUploads.push(fileId);
                localStorage.setItem('stash_my_uploads', JSON.stringify(myUploads));

                // Persistent Cache: Store single files in IndexedDB for WebRTC seeding
                if (filesArray.length === 1) {
                    await saveFileToIndexedDB(fileId, filesArray[0]);
                }
            }

            await fetchRoomFiles(room.id);
            return true;
        } catch (err) {
            setStatus(prev => ({ ...prev, error: err.message }));
            return false;
        } finally {
            setStatus(prev => ({ ...prev, isUploading: false }));
        }
    };

    // 6. Secure File Download (Automatic WebRTC P2P with 1.5s Cloud Fallback)
    const downloadFile = async (file, filePassword = "") => {
        const fileId = file.id;
        const MAX_P2P_FILE_SIZE = 15 * 1024 * 1024;

        // A. Automatically attempt WebRTC P2P in background (only for files <= 15MB)
        if (socketRef.current && file.file_size <= MAX_P2P_FILE_SIZE) {
            setDownloadProgress(prev => ({ 
                ...prev, 
                [fileId]: { status: "connecting", percent: 0 } 
            }));
            
            try {
                const p2pBlob = await attemptP2PDownload(fileId);
                if (p2pBlob) {
                    triggerBlobDownload(p2pBlob, file.filename);
                    setDownloadProgress(prev => ({ 
                        ...prev, 
                        [fileId]: { status: "complete", percent: 100 } 
                    }));
                    setTimeout(() => {
                        setDownloadProgress(prev => {
                            const updated = { ...prev };
                            delete updated[fileId];
                            return updated;
                        });
                    }, 2000);
                    return { success: true };
                }
            } catch (p2pErr) {
                console.warn(`P2P failed for ${file.filename}, falling back to cloud:`, p2pErr);
            }
        }

        // B. Cloud Fallback
        setDownloadProgress(prev => ({ 
            ...prev, 
            [fileId]: { status: "cloud", percent: 0 } 
        }));

        try {
            const res = await fetch(`${API_BASE}/download/${fileId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: filePassword })
            });

            if (!res.ok) {
                const errorText = await res.text();
                let errorMessage = "Download failed.";
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message;
                } catch (_) {}
                throw new Error(errorMessage);
            }

            const blob = await res.blob();
            triggerBlobDownload(blob, file.filename);
            
            setDownloadProgress(prev => ({ 
                ...prev, 
                [fileId]: { status: "complete", percent: 100 } 
            }));

            setTimeout(() => {
                setDownloadProgress(prev => {
                    const updated = { ...prev };
                    delete updated[fileId];
                    return updated;
                });
                fetchRoomFiles(room.id);
            }, 1000);

            return { success: true };
        } catch (err) {
            setDownloadProgress(prev => {
                const updated = { ...prev };
                delete updated[fileId];
                return updated;
            });
            return { success: false, error: err.message };
        }
    };

    const triggerBlobDownload = (blob, filename) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    };

    // ==========================================
    // WebRTC Core Engine
    // ==========================================

    const attemptP2PDownload = (fileId) => {
        return new Promise((resolve, reject) => {
            let hasResolved = false;

            const fallbackTimer = setTimeout(() => {
                if (!hasResolved) {
                    hasResolved = true;
                    cleanupPC();
                    reject("P2P Timeout");
                }
            }, 1500);

            const cleanupPC = () => {
                if (activePeerConnections.current[fileId]) {
                    activePeerConnections.current[fileId].close();
                    delete activePeerConnections.current[fileId];
                }
            };

            window[`p2p_resolve_${fileId}`] = (blob) => {
                if (!hasResolved) {
                    hasResolved = true;
                    clearTimeout(fallbackTimer);
                    resolve(blob);
                }
            };

            window[`p2p_reject_${fileId}`] = (err) => {
                if (!hasResolved) {
                    hasResolved = true;
                    clearTimeout(fallbackTimer);
                    cleanupPC();
                    reject(err);
                }
            };

            socketRef.current.emit("p2p-signal", {
                roomId: room.id,
                signal: { type: "p2p-request-file", fileId, requesterId: socketRef.current.id }
            });
        });
    };

    const handlePeerAvailability = async (fileId, uploaderId) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });
        activePeerConnections.current[uploaderId] = pc;

        const channel = pc.createDataChannel("file-transfer", { ordered: true });
        
        const chunks = [];
        let receivedSize = 0;
        const fileMetadata = room.files.find(f => f.id === fileId);
        const totalSize = fileMetadata ? fileMetadata.file_size : 0;

        channel.onmessage = (event) => {
            if (typeof event.data === "string" && event.data === "EOF") {
                const finalBlob = new Blob(chunks);
                const resolveFn = window[`p2p_resolve_${fileId}`];
                if (resolveFn) resolveFn(finalBlob);
                pc.close();
            } else {
                chunks.push(event.data);
                receivedSize += event.data.byteLength;
                if (totalSize > 0) {
                    const percent = Math.min(99, Math.round((receivedSize / totalSize) * 100));
                    setDownloadProgress(prev => ({
                        ...prev,
                        [fileId]: { status: "streaming", percent }
                    }));
                }
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit("p2p-signal", {
                    roomId: room.id,
                    targetId: uploaderId,
                    signal: { candidate: event.candidate }
                });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current.emit("p2p-signal", {
            roomId: room.id,
            targetId: uploaderId,
            signal: { sdp: pc.localDescription, fileId }
        });
    };

    const handleIncomingSdp = async (sdp, senderId) => {
        if (sdp.type === "offer") {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
            });
            activePeerConnections.current[senderId] = pc;

            pc.onicecandidate = (event) => {
                if (event.candidate && socketRef.current) {
                    socketRef.current.emit("p2p-signal", {
                        roomId: room.id,
                        targetId: senderId,
                        signal: { candidate: event.candidate }
                    });
                }
            };

            pc.ondatachannel = (event) => {
                const channel = event.channel;
                channel.onopen = async () => {
                    const offerFileId = sdp.fileId;
                    const file = await getFileFromIndexedDB(offerFileId);
                    if (file) {
                        streamFileBufferP2P(file, channel);
                    } else {
                        channel.send("EOF");
                    }
                };
            };

            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current.emit("p2p-signal", {
                roomId: room.id,
                targetId: senderId,
                signal: { sdp: pc.localDescription }
            });
        } else if (sdp.type === "answer") {
            const pc = activePeerConnections.current[senderId];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            }
        }
    };

    const handleIncomingIceCandidate = async (candidate, senderId) => {
        const pc = activePeerConnections.current[senderId];
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    };

    const streamFileBufferP2P = (file, channel) => {
        const CHUNK_SIZE = 16384;
        const reader = new FileReader();
        let offset = 0;

        const readNextSlice = (currentOffset) => {
            const slice = file.slice(currentOffset, currentOffset + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
            if (channel.readyState !== "open") return;
            channel.send(e.target.result);
            offset += e.target.result.byteLength;

            if (offset < file.size) {
                if (channel.bufferedAmount > 1048576) {
                    const checkInterval = setInterval(() => {
                        if (channel.bufferedAmount === 0) {
                            clearInterval(checkInterval);
                            readNextSlice(offset);
                        }
                    }, 50);
                } else {
                    readNextSlice(offset);
                }
            } else {
                channel.send("EOF");
            }
        };

        readNextSlice(0);
    };

    // 7. Delete File
    const deleteFile = async (fileId) => {
        setStatus(prev => ({ ...prev, error: null }));
        try {
            const res = await fetch(`${API_BASE}/files/${fileId}`, {
                method: "DELETE",
                headers: getAuthHeaders(room.id)
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.message || "Deletion failed");
            }

            setRoom(prev => ({
                ...prev,
                files: prev.files.filter(f => f.id !== fileId)
            }));
            
            const myUploads = JSON.parse(localStorage.getItem('stash_my_uploads') || '[]');
            const updatedUploads = myUploads.filter(id => id !== fileId);
            localStorage.setItem('stash_my_uploads', JSON.stringify(updatedUploads));

            return true;
        } catch (err) {
            setStatus(prev => ({ ...prev, error: err.message }));
            return false;
        }
    };

    // 8. Clipboard sync
    const sendClipboard = (text) => {
        if (!text.trim() || !socketRef.current) return;
        socketRef.current.emit("clipboard-sync", { roomId: room.id, text });
        setClipboard(prev => [...prev, { text, time: Date.now(), fromRemote: false }]);
    };

    const clearClipboard = () => setClipboard([]);

    // 9. Fetch preview URL for images/videos
    const fetchPreviewUrl = async (fileId) => {
        try {
            const res = await fetch(`${API_BASE}/preview/${fileId}`);
            const json = await res.json();
            if (json.status === "success") {
                return json.data.url;
            }
        } catch (_) {}
        return null;
    };

    // ==========================================
    // Live Screen Share Controllers
    // ==========================================
    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            setScreenStream(stream);
            screenStreamRef.current = stream;
            setIsScreenSharing(true);

            // Listen for stream ending (e.g. from browser stop sharing pill)
            stream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };

            if (socketRef.current) {
                socketRef.current.emit("screen-share-start", { roomId: room.id });
            }
        } catch (err) {
            console.error("Screen Share Capture Failed:", err);
        }
    };

    const stopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            setScreenStream(null);
            screenStreamRef.current = null;
        }
        setIsScreenSharing(false);

        // Close all peer screen share connections
        Object.values(screenSharePCs.current).forEach(pc => pc.close());
        screenSharePCs.current = {};

        if (socketRef.current) {
            socketRef.current.emit("screen-share-stop", { roomId: room.id });
        }
    };

    return {
        room,
        status,
        downloadProgress,
        clipboard,
        gate,
        setGate,
        screenShare: {
            isSharing: isScreenSharing,
            stream: screenStream,
            remoteStream: remoteScreenStream
        },
        clientId,
        myRooms,
        joinedRooms,
        setRoomId: (id) => setRoom(prev => ({ ...prev, id })),
        fetchDefaultRoom,
        fetchRoomDetails,
        refreshFiles: () => fetchRoomFiles(room.id),
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
    };
}
