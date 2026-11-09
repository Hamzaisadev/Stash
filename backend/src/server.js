import express from "express";
import cors from "cors";
import http from "http";
import helmet from "helmet";
import { globalLimiter } from "./utils/limiter.js";
import { Server } from "socket.io";
import filesRoutes from './routes.js';
import { globalErrorHandler } from "./utils/errors.js";
import { generateRoomToken, verifyRoomToken, verifyHostToken } from "./utils/auth.js";
import { supabase } from "./supabase.js";
import { cleanupExpiredFiles } from "./controller.js";
import { roomHosts, roomClipboards } from "./state.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for reverse proxies (Vercel, Railway, Fly.io, Render) (S3)
app.set('trust proxy', 1);

// Security Headers (S8)
app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Global Rate Limiting (S8)
app.use(globalLimiter);

// Configure CORS.
// Every branch used to return `callback(null, true)`, including the fallback,
// which made the allowlist decorative. It now actually rejects.
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];

const isDev = process.env.NODE_ENV === 'development';

if (!isDev && allowedOrigins.length === 0) {
    console.warn(
        'WARNING: ALLOWED_ORIGINS is not set while NODE_ENV is not "development".\n' +
        'Browser requests will be rejected. Set ALLOWED_ORIGINS to your frontend ' +
        'origin(s), comma-separated, e.g. https://stash-ed.vercel.app'
    );
}

const isOriginAllowed = (origin) => {
    // No Origin header: curl, server-to-server, same-origin navigation.
    // These are not cross-origin browser requests, so CORS does not apply.
    if (!origin) return true;
    if (isDev) return true;
    return allowedOrigins.includes(origin);
};

const corsOriginCheck = (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
};

app.use(cors({
    origin: corsOriginCheck,
    credentials: true,
    exposedHeaders: ['Content-Disposition']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create the raw HTTP server to wrap our Express app
const server = http.createServer(app);

// Initialize Socket.io and bind it to the HTTP server
const io = new Server(server, {
    cors: {
        origin: corsOriginCheck,
        methods: ["GET", "POST"],
        credentials: true
    },
    maxHttpBufferSize: 1e6 // 1MB; signaling payloads only, never file data
});

// Pass socket.io instance to all Express requests
app.use((req, res, next) => {
    req.io = io;
    next();
});


// Helper to check room authorization for sockets
const isSocketAuthorizedForRoom = async (roomId, token, hostToken) => {
    if (!roomId) return false;
    try {
        const { data: room } = await supabase
            .from('rooms')
            .select('is_protected, stack_key_hash, accept_only')
            .eq('id', roomId)
            .maybeSingle();

        if (!room) return true; // new or uncreated room
        const hasNoSecurity = !room.is_protected && !room.stack_key_hash && !room.accept_only;
        if (hasNoSecurity) return true;

        if (hostToken && verifyHostToken(hostToken, roomId)) return true;
        if (token && verifyRoomToken(token, roomId)) return true;

        return false;
    } catch {
        return false;
    }
};

// Configure Socket.io room matching, clipboard sync & WebRTC signaling
io.on("connection", (socket) => {
    // Listen for room join requests
    // Rooms this socket has been authorized to join, so later events can be
    // checked without trusting a roomId supplied with each message.
    const joinedRooms = new Set();
    // Rooms this socket proved host rights for, via a server-signed host token.
    const hostOfRooms = new Set();

    socket.on("join-room", async ({ roomId, token, hostToken }) => {
        if (!roomId || typeof roomId !== 'string') return;

        const authorized = await isSocketAuthorizedForRoom(roomId, token, hostToken);
        if (!authorized) {
            socket.emit("room-auth-required", { roomId });
            return;
        }

        socket.join(roomId);
        joinedRooms.add(roomId);

        // Host rights require a server-signed host token, never a client id.
        if (hostToken && verifyHostToken(hostToken, roomId)) {
            hostOfRooms.add(roomId);
            roomHosts.set(roomId, socket.id);
        }

        // Clipboard history goes only to authorized, joined devices
        const history = roomClipboards.get(roomId) || [];
        socket.emit("clipboard-history", history);
    });

    // Accept-Only manual approval queue signaling.
    // The guest is not in the room channel yet, so this is addressed to the
    // registered host socket directly rather than broadcast to the room.
    socket.on("join-request", ({ roomId, guestName }) => {
        if (!roomId || typeof roomId !== 'string') return;
        const hostSocketId = roomHosts.get(roomId);
        if (!hostSocketId) return;
        io.to(hostSocketId).emit("join-request", {
            roomId,
            guestName: String(guestName || 'Guest').slice(0, 64),
            guestSocketId: socket.id
        });
    });

    socket.on("join-approve", ({ roomId, guestSocketId, guestClientId }) => {
        if (!hostOfRooms.has(roomId)) return;
        if (!guestSocketId || !guestClientId) return;
        const token = generateRoomToken(roomId, guestClientId);
        io.to(guestSocketId).emit("join-approved", { token, roomId });
    });

    socket.on("join-deny", ({ roomId, guestSocketId }) => {
        if (!hostOfRooms.has(roomId)) return;
        io.to(guestSocketId).emit("join-denied", { roomId });
    });

    socket.on("kick-user", ({ roomId, guestSocketId }) => {
        if (!hostOfRooms.has(roomId)) return;
        const target = io.sockets.sockets.get(guestSocketId);
        if (target) {
            target.leave(roomId);
        }
        io.to(guestSocketId).emit("room-kicked", { roomId });
    });

    // Cross-device clipboard sync relay.
    // Gated on membership: any socket could previously push clipboard entries
    // into a room it had never been authorized to join.
    socket.on("clipboard-sync", ({ roomId, text, clientId }) => {
        if (!roomId || !text || !joinedRooms.has(roomId)) return;
        if (!roomClipboards.has(roomId)) {
            roomClipboards.set(roomId, []);
        }
        const history = roomClipboards.get(roomId);
        const newItem = {
            text: String(text).slice(0, 10000),
            time: Date.now(),
            senderClientId: clientId || socket.id
        };
        history.push(newItem);
        if (history.length > 30) {
            history.shift();
        }
        socket.to(roomId).emit("clipboard-sync", newItem);
    });

    socket.on("clipboard-clear", ({ roomId }) => {
        if (!roomId || !joinedRooms.has(roomId)) return;
        roomClipboards.set(roomId, []);
        socket.to(roomId).emit("clipboard-clear");
    });

    // Relay P2P file availability queries
    socket.on("p2p-request-file", (data) => {
        if (!data || !data.roomId || !joinedRooms.has(data.roomId)) return;
        socket.to(data.roomId).emit("p2p-request-file", data);
    });

    // Screen share signaling
    socket.on("screen-share-start", ({ roomId }) => {
        if (!roomId || !joinedRooms.has(roomId)) return;
        socket.to(roomId).emit("screen-share-start", { senderId: socket.id });
    });

    socket.on("screen-share-stop", ({ roomId }) => {
        if (!roomId || !joinedRooms.has(roomId)) return;
        socket.to(roomId).emit("screen-share-stop", { senderId: socket.id });
    });

    socket.on("screen-share-signal", ({ roomId, signal, targetId }) => {
        if (!roomId || !joinedRooms.has(roomId)) return;
        const payload = { signal, senderId: socket.id };
        if (targetId) {
            io.to(targetId).emit("screen-share-signal", payload);
        } else {
            socket.to(roomId).emit("screen-share-signal", payload);
        }
    });

    // Relay WebRTC signaling offer/answer/candidates between peers in a room
    socket.on("p2p-signal", ({ roomId, signal, targetId }) => {
        if (!roomId || !joinedRooms.has(roomId)) return;
        const payload = { signal, senderId: socket.id };
        if (targetId) {
            io.to(targetId).emit("p2p-signal", payload);
        } else {
            socket.to(roomId).emit("p2p-signal", payload);
        }
    });

    socket.on("disconnect", () => {
        // Release host registration so a reconnecting host can reclaim it
        for (const roomId of hostOfRooms) {
            if (roomHosts.get(roomId) === socket.id) {
                roomHosts.delete(roomId);
            }
        }
    });
});

// Mount API routes
app.use('/api', filesRoutes);

// Global error handling middleware
app.use(globalErrorHandler);

// Expiry cleanup runs on a timer, not inside request handlers, so a user's
// upload or download is never blocked by unbounded delete work.
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
let cleanupRunning = false;

const runCleanup = async () => {
    if (cleanupRunning) return; // avoid overlapping runs on a slow pass
    cleanupRunning = true;
    try {
        await cleanupExpiredFiles();
    } catch (err) {
        console.error('Scheduled cleanup failed:', err);
    } finally {
        cleanupRunning = false;
    }
};

const cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
cleanupTimer.unref(); // don't hold the process open during shutdown

server.listen(PORT, () => {
    console.log(`Stash Server running on port ${PORT}`);
    runCleanup(); // one pass at boot to clear anything stale
});

const shutdown = (signal) => {
    console.log(`${signal} received, shutting down.`);
    clearInterval(cleanupTimer);
    io.close();
    server.close(() => process.exit(0));
    // Don't hang forever if connections refuse to drain
    setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
