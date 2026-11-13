import express from 'express';
import { handleUpload, enforceUploadLimits } from './upload.js';
import { checkRoomAccess } from './utils/auth.js';
import { attachEntitlement } from './billing/entitlements.js';
import { authLimiter } from './utils/limiter.js';
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

// Every route below may consult the caller's plan, so the entitlement is
// resolved once here rather than re-derived in each controller.
router.use(attachEntitlement);

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

// Uploads. handleUpload applies only the hard process-safety ceiling and turns
// multer's own rejections into real 4xx responses; the caller's actual plan
// limits are applied by enforceUploadLimits once the parts are parsed and
// req.entitlement is known.
router.post('/upload', handleUpload, enforceUploadLimits, uploadFile);

// File specific actions
router.get('/preview/:id', getPreview);
router.post('/download/:id', downloadFile);
router.delete('/files/:id', deleteFile);

export default router;
