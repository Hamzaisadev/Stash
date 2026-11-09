// Shared in-memory session state.
//
// This lives in its own module so controller.js and server.js can both use it
// without importing each other — that cycle crashes at boot under ESM
// ("Cannot access 'createRoom' before initialization").
//
// NOTE: because this is process-local, the server cannot be scaled to more than
// one instance as-is. Horizontal scaling requires moving these into Redis and
// adding the socket.io Redis adapter.

export const roomHosts = new Map();      // roomId -> host socket id
export const roomClipboards = new Map(); // roomId -> [{ text, time, senderClientId }]
