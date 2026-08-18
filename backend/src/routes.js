import express from 'express';
import upload from './upload.js';
import { checkRoomAccess } from './utils/auth.js';
import { authLimiter } from './server.js';
import {
    uploadFile,
    getFiles,
    downloadFile,
    getRoom,
    deleteFile,
    getPreview,
    createRoom,
    getRoomDetails,
    joinRoom,
    updateRoomSettings,
    rotateRoomKey,
    deleteRoom
} from './controller.js';

const router = express.Router();

// Room Management
router.post('/rooms', authLimiter, createRoom);
router.get('/rooms/:room_id', getRoomDetails);
router.post('/rooms/:room_id/join', authLimiter, joinRoom);
router.post('/rooms/:room_id/update', updateRoomSettings);
router.post('/rooms/:room_id/rotate-key', authLimiter, rotateRoomKey);
router.delete('/rooms/:room_id', deleteRoom);

// Files and Room Discovery
router.get('/room', getRoom);
router.get('/files/:room_id', checkRoomAccess, getFiles);

// Uploads
router.post('/upload', upload.array('files', 10), uploadFile);

// File specific actions
router.get('/preview/:id', getPreview);
router.post('/download/:id', downloadFile);
router.delete('/files/:id', deleteFile);

export default router;
