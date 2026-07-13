import express from "express"
import cors from "cors"
import http from "http";
import { Server } from "socket.io";
import filesRoutes from './routes.js'
import { globalErrorHandler } from "./utils/errors.js";
import { generateRoomToken } from "./utils/auth.js";
import { deleteRoomData } from "./controller.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Create the raw HTTP server to wrap our Express app
const server = http.createServer(app);

// Initialize Socket.io and bind it to the HTTP server
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Echo the requesting origin dynamically to support multiple LAN IPs
            callback(null, origin || true);
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Track which socket ID is the host of each room (in-memory, resets on server restart)
const roomHosts = new Map(); // roomId -> hostClientId
const roomClipboards = new Map(); // roomId -> Array of { text, time, senderClientId }

// Configure Socket.io room matching, clipboard sync & WebRTC signaling
io.on("connection", (socket) => {
    console.log("Client connected via socket:", socket.id);

    // Listen for room join requests
    socket.on("join-room", ({ roomId, clientId, isHost }) => {
        socket.join(roomId);
        // Register this client as host if they claim host and no host is registered yet
        if (isHost && !roomHosts.has(roomId)) {
            roomHosts.set(roomId, clientId);
        }
        console.log(`Socket client ${socket.id} (${clientId}) joined room: ${roomId}${isHost ? ' [HOST]' : ''}`);

        // Transmit existing room clipboard history to newly joined devices
        const history = roomClipboards.get(roomId) || [];
        socket.emit("clipboard-history", history);
    });

    // Accept Only manual approval queue signaling
    socket.on("join-request", ({ roomId, guestName, clientId }) => {
        // Only forward the join request to the host socket(s) in the room, not all members
        // We find host sockets by iterating room members and checking against registered host clientId
        const hostClientId = roomHosts.get(roomId);
        // Broadcast only to others in room; hosts listening via stash-join-request event will filter
        socket.to(roomId).emit("join-request", {
            roomId,
            guestName,
            guestSocketId: socket.id,
            clientId,
            hostClientId // Let frontend filter: only process if clientId matches your own
        });
        console.log(`Join request from ${guestName} (${socket.id}) for room ${roomId}`);
    });

    socket.on("join-approve", ({ roomId, guestSocketId, guestClientId, hostId }) => {
        // Verify the approver is the registered host for this room
        const registeredHost = roomHosts.get(roomId);
        if (registeredHost && registeredHost !== hostId) {
            console.warn(`Unauthorized join-approve attempt by ${hostId} for room ${roomId}`);
            return; // Silently reject
        }
        const token = generateRoomToken(roomId, guestClientId);
        io.to(guestSocketId).emit("join-approved", { token, roomId });
        console.log(`Host ${hostId} approved guest socket ${guestSocketId} for room ${roomId}`);
    });

    socket.on("join-deny", ({ roomId, guestSocketId, hostId }) => {
        // Verify the denier is the registered host
        const registeredHost = roomHosts.get(roomId);
        if (registeredHost && registeredHost !== hostId) {
            console.warn(`Unauthorized join-deny attempt by ${hostId} for room ${roomId}`);
            return;
        }
        io.to(guestSocketId).emit("join-denied", { roomId });
        console.log(`Host denied guest socket ${guestSocketId} for room ${roomId}`);
    });

    socket.on("kick-user", ({ roomId, guestSocketId, guestClientId, hostId }) => {
        // Verify the sender is the registered host
        const registeredHost = roomHosts.get(roomId);
        if (registeredHost && registeredHost !== hostId) {
            console.warn(`Unauthorized kick attempt by ${hostId} for room ${roomId}`);
            return;
        }
        // Send a kick signal directly to the guest socket
        io.to(guestSocketId).emit("room-kicked", { roomId });
        console.log(`Host ${hostId} kicked guest socket ${guestSocketId} from room ${roomId}`);
    });

    // Cross-device clipboard sync relay
    socket.on("clipboard-sync", ({ roomId, text, clientId }) => {
        if (!roomClipboards.has(roomId)) {
            roomClipboards.set(roomId, []);
        }
        const history = roomClipboards.get(roomId);
        const newItem = { text, time: Date.now(), senderClientId: clientId || socket.id };
        history.push(newItem);
        if (history.length > 30) {
            history.shift();
        }
        socket.to(roomId).emit("clipboard-sync", { text, senderClientId: clientId || socket.id });
    });

    // Relay P2P file availability queries to everyone in the room
    socket.on("p2p-request-file", (data) => {
        socket.to(data.roomId || "").emit("p2p-request-file", data);
    });

    // Screen share signaling
    socket.on("screen-share-start", ({ roomId }) => {
        socket.to(roomId).emit("screen-share-start", { senderId: socket.id });
    });

    socket.on("screen-share-stop", ({ roomId }) => {
        socket.to(roomId).emit("screen-share-stop", { senderId: socket.id });
    });

    socket.on("screen-share-signal", ({ roomId, signal, targetId }) => {
        const payload = { signal, senderId: socket.id };
        if (targetId) {
            io.to(targetId).emit("screen-share-signal", payload);
        } else {
            socket.to(roomId).emit("screen-share-signal", payload);
        }
    });

    // Relay WebRTC signaling offer/answer/candidates between peers in a room
    socket.on("p2p-signal", ({ roomId, signal, targetId }) => {
        const payload = { signal, senderId: socket.id };
        if (targetId) {
            io.to(targetId).emit("p2p-signal", payload);
        } else {
            socket.to(roomId).emit("p2p-signal", payload);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected from socket:", socket.id);
    });
});

// 1. Configure Cross-Origin Resource Sharing (CORS) with dynamic origin mirroring
app.use(cors({
    origin: (origin, callback) => {
        callback(null, origin || true);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'] // Expose to let React fetch read the filename
}))

// 2. Register Socket Injection Middleware (Dependency Injection Pattern)
app.use((req, res, next) => {
    req.io = io;
    next();
});

// 3. Body parsers
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.get('/', (req, res) => {
    res.send('Stash Server is running ')
})

app.use('/api', filesRoutes)

app.use(globalErrorHandler)

// Bootstrap: Start the HTTP server directly (Supabase handles DB connectivity)
server.listen(PORT, '0.0.0.0', () => {
    console.log('stash server is running on ' + PORT)
});


