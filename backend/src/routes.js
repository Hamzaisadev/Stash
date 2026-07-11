import express from 'express';
import upload from './upload.js';
import { checkRoomAccess } from './utils/auth.js';
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
    rotateRoomKey
} from './controller.js';

const router = express.Router();

// Room Management
router.post('/rooms', createRoom);
router.get('/rooms/:room_id', getRoomDetails);
router.post('/rooms/:room_id/join', joinRoom);
router.post('/rooms/:room_id/update', updateRoomSettings);
router.post('/rooms/:room_id/rotate-key', rotateRoomKey);

// Files and Room Discovery
router.get('/room', getRoom);
router.get('/files/:room_id', checkRoomAccess, getFiles);

// Multer parsed upload: authorization checked in controller due to multipart form parsing
router.post('/upload', upload.array('files', 10), uploadFile);

// File specific actions (authorized inside the controller actions after querying the file)
router.get('/preview/:id', getPreview);
router.post('/download/:id', downloadFile);
router.delete('/files/:id', deleteFile);

export default router;

