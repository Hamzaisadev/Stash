import express from "express"
import cors from "cors"
import http from "http";
import { Server } from "socket.io";
import filesRoutes from './routes.js'
import { globalErrorHandler } from "./utils/errors.js";

const app = express();
const PORT = 5000;

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

// Configure Socket.io room matching
io.on("connection", (socket) => {
    console.log("Client connected via socket:", socket.id);

    // Listen for room join requests
    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        console.log(`Socket client ${socket.id} joined room: ${roomId}`);
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
app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.get('/', (req, res) => {
    res.send('Stash Server is running ')
})

app.use('/api', filesRoutes)

app.use(globalErrorHandler)

// Bootstrap: Start the HTTP server directly (Supabase handles DB connectivity)
server.listen(PORT, '0.0.0.0', () => {
    console.log('stash server is running on ' + PORT)
});


