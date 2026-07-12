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

// Configure Socket.io room matching, clipboard sync & WebRTC signaling
io.on("connection", (socket) => {
    console.log("Client connected via socket:", socket.id);

    // Listen for room join requests
    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        console.log(`Socket client ${socket.id} joined room: ${roomId}`);
    });

    // Accept Only manual approval queue signaling
    socket.on("join-request", ({ roomId, guestName, clientId }) => {
        // Broadcast the request to all clients in the room (which includes the hosts)
        socket.to(roomId).emit("join-request", {
            roomId,
            guestName,
            guestSocketId: socket.id,
            clientId
        });
        console.log(`Join request from ${guestName} (${socket.id}) for room ${roomId}`);
    });

    socket.on("join-approve", ({ roomId, guestSocketId, guestClientId, hostId }) => {
        const token = generateRoomToken(roomId, guestClientId);
        io.to(guestSocketId).emit("join-approved", { token, roomId });
        console.log(`Host ${hostId} approved guest socket ${guestSocketId} for room ${roomId}`);
    });

    socket.on("join-deny", ({ roomId, guestSocketId }) => {
        io.to(guestSocketId).emit("join-denied", { roomId });
        console.log(`Host denied guest socket ${guestSocketId} for room ${roomId}`);
    });

    // Cross-device clipboard sync relay
    socket.on("clipboard-sync", ({ roomId, text }) => {
        socket.to(roomId).emit("clipboard-sync", { text, senderId: socket.id });
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


