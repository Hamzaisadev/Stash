import express from "express";
import cors from "cors";
import http from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import filesRoutes from './routes.js';
import { globalErrorHandler } from "./utils/errors.js";
import { generateRoomToken, verifyRoomToken } from "./utils/auth.js";
import { supabase } from "./supabase.js";

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
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Specific stricter limiter for room creation and joins
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Rate limit reached for room operations. Try again later.' }
});

// Configure CORS (S10)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV === 'development' || allowedOrigins.length === 0) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        return callback(null, true);
    },
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
        origin: (origin, callback) => {
            callback(null, true);
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Pass socket.io instance to all Express requests
app.use((req, res, next) => {
    req.io = io;
    next();
});

// In-memory mappings for active sessions
export const roomHosts = new Map(); // roomId -> hostClientId
export const roomClipboards = new Map(); // roomId -> Array of { text, time, senderClientId }

// Helper to check room authorization for sockets
const isSocketAuthorizedForRoom = async (roomId, clientId, token, isHost) => {
    if (!roomId) return false;
    try {
        const { data: room } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .maybeSingle();

        if (!room) return true; // new or uncreated room
        const hasNoSecurity = !room.is_protected && !room.stack_key && !room.accept_only;
        if (hasNoSecurity) return true;

        if (isHost && clientId && room.creator_socket_id === clientId && room.creator_socket_id !== 'system') {
            return true;
        }

        if (token && verifyRoomToken(token, roomId)) {
            return true;
        }

        return false;
    } catch {
        return false;
    }
};

// Configure Socket.io room matching, clipboard sync & WebRTC signaling
io.on("connection", (socket) => {
    // Listen for room join requests
    socket.on("join-room", async ({ roomId, clientId, token, isHost }) => {
        if (!roomId) return;

        const authorized = await isSocketAuthorizedForRoom(roomId, clientId, token, isHost);
        if (!authorized) {
            socket.emit("room-auth-required", { roomId });
            return;
        }

        socket.join(roomId);

        // Check if client is verified creator in DB before registering as host (S5)
        if (isHost && clientId) {
            const { data: room } = await supabase
                .from('rooms')
                .select('creator_socket_id')
                .eq('id', roomId)
                .maybeSingle();

            if (room && room.creator_socket_id === clientId) {
                roomHosts.set(roomId, clientId);
            }
        }

        // Transmit existing room clipboard history only to authorized joined devices (S4)
        const history = roomClipboards.get(roomId) || [];
        socket.emit("clipboard-history", history);
    });

    // Accept Only manual approval queue signaling
    socket.on("join-request", ({ roomId, guestName, clientId }) => {
        const hostClientId = roomHosts.get(roomId);
        socket.to(roomId).emit("join-request", {
            roomId,
            guestName,
            guestSocketId: socket.id,
            clientId,
            hostClientId
        });
    });

    socket.on("join-approve", ({ roomId, guestSocketId, guestClientId, hostId }) => {
        const registeredHost = roomHosts.get(roomId);
        if (registeredHost && registeredHost !== hostId) {
            return;
        }
        const token = generateRoomToken(roomId, guestClientId);
        io.to(guestSocketId).emit("join-approved", { token, roomId });
    });

    socket.on("join-deny", ({ roomId, guestSocketId, hostId }) => {
        const registeredHost = roomHosts.get(roomId);
        if (registeredHost && registeredHost !== hostId) {
            return;
        }
        io.to(guestSocketId).emit("join-denied", { roomId });
    });

    socket.on("kick-user", ({ roomId, guestSocketId, hostId }) => {
        const registeredHost = roomHosts.get(roomId);
        if (registeredHost && registeredHost !== hostId) {
            return;
        }
        io.to(guestSocketId).emit("room-kicked", { roomId });
    });

    // Cross-device clipboard sync relay
    socket.on("clipboard-sync", ({ roomId, text, clientId, token }) => {
        if (!roomId || !text) return;
        if (!roomClipboards.has(roomId)) {
            roomClipboards.set(roomId, []);
        }
        const history = roomClipboards.get(roomId);
        const newItem = { text: String(text).slice(0, 10000), time: Date.now(), senderClientId: clientId || socket.id };
        history.push(newItem);
        if (history.length > 30) {
            history.shift();
        }
        socket.to(roomId).emit("clipboard-sync", newItem);
    });

    // Relay P2P file availability queries
    socket.on("p2p-request-file", (data) => {
        if (data && data.roomId) {
            socket.to(data.roomId).emit("p2p-request-file", data);
        }
    });

    // Screen share signaling
    socket.on("screen-share-start", ({ roomId }) => {
        if (roomId) socket.to(roomId).emit("screen-share-start", { senderId: socket.id });
    });

    socket.on("screen-share-stop", ({ roomId }) => {
        if (roomId) socket.to(roomId).emit("screen-share-stop", { senderId: socket.id });
    });

    socket.on("screen-share-signal", ({ roomId, signal, targetId }) => {
        const payload = { signal, senderId: socket.id };
        if (targetId) {
            io.to(targetId).emit("screen-share-signal", payload);
        } else if (roomId) {
            socket.to(roomId).emit("screen-share-signal", payload);
        }
    });

    // Relay WebRTC signaling offer/answer/candidates between peers in a room
    socket.on("p2p-signal", ({ roomId, signal, targetId }) => {
        const payload = { signal, senderId: socket.id };
        if (targetId) {
            io.to(targetId).emit("p2p-signal", payload);
        } else if (roomId) {
            socket.to(roomId).emit("p2p-signal", payload);
        }
    });

    socket.on("disconnect", () => {
        // Socket disconnected
    });
});

// Mount API routes
app.use('/api', filesRoutes);

// Global error handling middleware
app.use(globalErrorHandler);

server.listen(PORT, () => {
    console.log(`Stash Server running on port ${PORT}`);
});
