import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const serverIP = window.location.hostname;
const API_BASE = `http://${serverIP}:5000/api`;
const SOCKET_BASE = `http://${serverIP}:5000`;

export function useStash() {
    // 1. Grouped State Objects
    const [room, setRoom] = useState({
        id: "",
        files: [],
    });

    const [status, setStatus] = useState({
        isLoading: false,
        isUploading: false,
        error: null,
    });

    // 2. Persistent Socket Reference
    const socketRef = useRef(null);

    // Initialize WebSockets Connection
    useEffect(() => {
        // Create socket connection
        const socket = io(SOCKET_BASE, {
            withCredentials: true
        });
        socketRef.current = socket;

        // Socket listener for real-time uploads
        socket.on("file-uploaded", (newFile) => {
            setRoom(prev => {
                // Optimistic Update: Append the file only if it is for the current room
                // and is not already in our local state list (prevents duplicates)
                if (newFile.room_id !== prev.id) return prev;
                const alreadyExists = prev.files.some(f => f.id === newFile.id);
                if (alreadyExists) return prev;
                return {
                    ...prev,
                    files: [newFile, ...prev.files]
                };
            });
        });

        // Clean up socket connection on component unmount
        return () => {
            if (socket) socket.disconnect();
        };
    }, []);

    // 3. Resolve default room on boot
    const fetchDefaultRoom = async () => {
        setStatus(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const res = await fetch(`${API_BASE}/room`);
            const json = await res.json();
            if (json.status === "success") {
                setRoom(prev => ({ ...prev, id: json.data.room_id }));
            }
        } catch (err) {
            setStatus(prev => ({ ...prev, error: "Unable to connect to backend server." }));
        } finally {
            setStatus(prev => ({ ...prev, isLoading: false }));
        }
    };

    // 4. Fetch active files in room
    const fetchRoomFiles = async (roomId) => {
        if (!roomId) return;
        setStatus(prev => ({ ...prev, error: null }));
        try {
            const res = await fetch(`${API_BASE}/files/${roomId}`);
            const json = await res.json();
            if (json.status === "success") {
                setRoom(prev => ({ ...prev, files: json.data.files }));
            }
        } catch (err) {
            setStatus(prev => ({ ...prev, error: "Failed to fetch room files." }));
        }
    };

    // Load default room code on mount
    useEffect(() => {
        fetchDefaultRoom();
    }, []);

    // Join room on Socket and fetch its files whenever room.id changes
    useEffect(() => {
        if (!room.id) return;
        
        // Fetch files for new room
        fetchRoomFiles(room.id);

        // Tell the WebSockets server we are changing rooms
        if (socketRef.current) {
            socketRef.current.emit("join-room", room.id);
        }
    }, [room.id]);

    // 5. File Upload Logic
    const uploadFile = async (selectedFile, options) => {
        if (!selectedFile) return;
        setStatus(prev => ({ ...prev, isUploading: true, error: null }));

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('room_id', room.id);
            formData.append('password', options.password);
            formData.append('expires_in', options.expiresIn);
            if (options.maxDownloads) {
                formData.append('max_downloads', options.maxDownloads);
            }

            const res = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                body: formData
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || "Upload failed");
            }

            // Immediately fetch files just in case (the socket broadcast will also trigger)
            await fetchRoomFiles(room.id);
            return true;
        } catch (err) {
            setStatus(prev => ({ ...prev, error: err.message }));
            return false;
        } finally {
            setStatus(prev => ({ ...prev, isUploading: false }));
        }
    };

    // 6. File Download Logic
    const downloadFile = async (fileId, filePassword = "") => {
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
            const blobUrl = window.URL.createObjectURL(blob);

            const contentDisposition = res.headers.get('Content-Disposition');
            let filename = "download";
            if (contentDisposition) {
                const matches = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"']+)["']?/);
                if (matches && matches[1]) {
                    filename = decodeURIComponent(matches[1]);
                }
            }

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            // Delay reload to let database state resolve download counts on the backend
            setTimeout(() => fetchRoomFiles(room.id), 1000);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    // Expose logical API and clean state
    return {
        room,
        status,
        setRoomId: (id) => setRoom(prev => ({ ...prev, id })),
        refreshFiles: () => fetchRoomFiles(room.id),
        uploadFile,
        downloadFile
    };
}
