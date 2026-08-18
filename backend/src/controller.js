import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase.js';
import { AppError } from './utils/errors.js';
import { generateRoomToken, verifyRoomToken } from './utils/auth.js';
import { roomHosts, roomClipboards } from './server.js';
import { ZipArchive } from 'archiver';

// Helper: Sanitize filenames to prevent directory traversal or header injection (S13)
const sanitizeFilename = (filename) => {
    if (!filename || typeof filename !== 'string') return 'file';
    const basename = path.basename(filename).replace(/[\r\n\0]/g, '');
    return basename.slice(0, 255) || 'file';
};

// Helper: Hashing function for IP addresses to create an anonymous LAN Room ID (S3)
const isPrivateIp = (ip) => {
    if (!ip) return true;
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    if (
        cleanIp === '::1' ||
        cleanIp === '127.0.0.1' ||
        cleanIp === 'localhost' ||
        cleanIp.startsWith('10.') ||
        cleanIp.startsWith('192.168.') ||
        cleanIp.startsWith('fe80:') ||
        cleanIp.startsWith('fc') ||
        cleanIp.startsWith('fd')
    ) {
        return true;
    }
    // Check 172.16.0.0 to 172.31.255.255
    const match172 = cleanIp.match(/^172\.(\d+)\./);
    if (match172) {
        const secondOctet = parseInt(match172[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
    return false;
};

const hashIp = (ip) => {
    let cleanIp = (ip || '127.0.0.1').replace(/^::ffff:/, '').trim();
    if (isPrivateIp(cleanIp)) {
        cleanIp = 'local-stash-room';
    } else if (cleanIp.includes(':')) {
        const parts = cleanIp.split(':');
        if (parts.length >= 4) {
            cleanIp = parts.slice(0, 4).join(':');
        }
    }
    return crypto.createHash("sha256").update(cleanIp).digest('hex').substring(0, 12);
};

// Helper: Clean up expired rooms and orphaned files
export const cleanupExpiredRooms = async () => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const threshold = now - ONE_DAY;
    try {
        const { data: expiredRooms } = await supabase
            .from('rooms')
            .select('id')
            .lt('created_at', threshold)
            .neq('creator_socket_id', 'system');

        if (expiredRooms && expiredRooms.length > 0) {
            const roomIds = expiredRooms.map(r => r.id);
            const { data: files } = await supabase.from('files').select('file_path').in('room_id', roomIds);
            if (files && files.length > 0) {
                const paths = files.map(f => f.file_path);
                await supabase.storage.from('stash-files').remove(paths);
                await supabase.from('files').delete().in('room_id', roomIds);
            }
            await supabase.from('rooms').delete().in('id', roomIds);
            roomIds.forEach(id => {
                roomHosts.delete(id);
                roomClipboards.delete(id);
            });
        }
    } catch (err) {
        console.error("Error during room pruning:", err);
    }
};

// Helper: Clean up expired files from PostgreSQL and Supabase Storage
export const cleanupExpiredFiles = async () => {
    const now = Date.now();
    try {
        await cleanupExpiredRooms();

        const { data: expiredFiles, error } = await supabase
            .from('files')
            .select('id, file_path')
            .lt('expires_at', now);

        if (error) throw error;

        if (expiredFiles && expiredFiles.length > 0) {
            const pathsToDelete = expiredFiles.map(f => f.file_path);
            const idsToDelete = expiredFiles.map(f => f.id);

            await supabase.storage.from('stash-files').remove(pathsToDelete);
            await supabase.from('files').delete().in('id', idsToDelete);
        }
    } catch (err) {
        console.error('Error running database cleanup:', err);
    }
};

// Helper to check caller authorization for room
const isCallerAuthorized = (room, hostId, token) => {
    if (!room) return false;
    const hasNoSecurity = !room.is_protected && !room.stack_key && !room.accept_only;
    if (hasNoSecurity) return true;
    const isHost = hostId && room.creator_socket_id && room.creator_socket_id !== 'system' && room.creator_socket_id === hostId;
    if (isHost) return true;
    if (token && verifyRoomToken(token, room.id)) return true;
    return false;
};

/**
 * 1. Upload File Controller
 */
export const uploadFile = async (req, res, next) => {
    try {
        if ((!req.file && !req.files) || (req.files && req.files.length === 0)) {
            return next(new AppError('No files provided. Please attach files under the "files" field.', 400));
        }

        const { password, expires_in, max_downloads, description } = req.body;
        const clientIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        let room_id = req.body.room_id;
        if (!room_id || room_id === 'undefined' || room_id === 'null' || room_id.trim() === '') {
            room_id = hashIp(clientIP);
        }

        const token = req.headers['x-room-access-token'] || req.body.room_access_token;
        const hostId = req.headers['x-host-id'] || req.body.host_id;

        let { data: roomData } = await supabase.from('rooms').select('*').eq('id', room_id).maybeSingle();
        if (!roomData) {
            const { data: newRoom, error: createErr } = await supabase
                .from('rooms')
                .insert([{
                    id: room_id,
                    name: room_id === hashIp(clientIP) ? 'Local Network Room' : room_id,
                    description: 'Auto-created room',
                    is_protected: false,
                    accept_only: false,
                    creator_socket_id: hostId || 'system',
                    created_at: Date.now()
                }])
                .select()
                .single();

            if (createErr) throw createErr;
            roomData = newRoom;
        }

        if (!isCallerAuthorized(roomData, hostId, token)) {
            return next(new AppError('You are not authorized to upload files to this room.', 401));
        }

        // Clamp expires_in between 1 minute and 7 days (10080 min) (F6)
        let parsedMinutes = parseInt(expires_in, 10);
        if (isNaN(parsedMinutes) || parsedMinutes < 1) parsedMinutes = 1440;
        if (parsedMinutes > 10080) parsedMinutes = 10080;
        const expires_at = Date.now() + (parsedMinutes * 60 * 1000);

        // Validate max_downloads (positive integer or null) (F6)
        let parsedMaxDownloads = null;
        if (max_downloads !== undefined && max_downloads !== null && max_downloads !== '') {
            const val = parseInt(max_downloads, 10);
            if (!isNaN(val) && val > 0) {
                parsedMaxDownloads = Math.min(val, 1000000);
            }
        }

        let password_hash = null;
        let salt = null;
        if (password && typeof password === 'string' && password.trim() !== '') {
            salt = bcrypt.genSaltSync(10);
            password_hash = bcrypt.hashSync(password.trim(), salt);
        }

        const fileId = crypto.randomUUID();
        let finalFilename = "";
        let finalMimeType = "";
        let finalSize = 0;
        let storagePath = "";
        let bufferToUpload = null;

        if (req.files && req.files.length > 1) {
            const timestampSuffix = Date.now().toString().substring(8);
            finalFilename = `stash-archive-${timestampSuffix}.zip`;
            finalMimeType = 'application/zip';
            storagePath = `uploads/${fileId}.zip`;

            const archive = new ZipArchive({ zlib: { level: 9 } });
            const streamPromise = new Promise((resolve, reject) => {
                const chunks = [];
                archive.on('data', (chunk) => chunks.push(chunk));
                archive.on('error', reject);
                archive.on('end', () => resolve(Buffer.concat(chunks)));
            });

            req.files.forEach(file => {
                const safeName = sanitizeFilename(file.originalname);
                archive.append(file.buffer, { name: safeName });
            });

            archive.finalize();
            bufferToUpload = await streamPromise;
            finalSize = bufferToUpload.length;
        } else {
            const singleFile = req.file || req.files[0];
            finalFilename = sanitizeFilename(singleFile.originalname);
            finalMimeType = singleFile.mimetype || 'application/octet-stream';
            finalSize = singleFile.size;
            const extension = path.extname(finalFilename);
            storagePath = `uploads/${fileId}${extension}`;
            bufferToUpload = singleFile.buffer;
        }

        // Upload to S3 Storage
        const { error: storageError } = await supabase.storage
            .from('stash-files')
            .upload(storagePath, bufferToUpload, {
                contentType: finalMimeType,
                upsert: true
            });

        if (storageError) {
            return next(new AppError(`S3 Storage Upload Failed: ${storageError.message}`, 500));
        }

        // Insert metadata row
        const { error: dbError } = await supabase
            .from('files')
            .insert([{
                id: fileId,
                filename: finalFilename,
                file_path: storagePath,
                file_size: finalSize,
                mime_type: finalMimeType,
                room_id: room_id,
                password_hash: password_hash,
                salt: salt,
                expires_at: expires_at,
                max_downloads: parsedMaxDownloads,
                download_count: 0,
                uploaded_at: Date.now(),
                description: description ? String(description).trim().slice(0, 1000) : null
            }]);

        if (dbError) {
            await supabase.storage.from('stash-files').remove([storagePath]);
            return next(dbError);
        }

        const fileMetadata = {
            id: fileId,
            filename: finalFilename,
            file_size: finalSize,
            mime_type: finalMimeType,
            room_id: room_id,
            is_locked: password_hash !== null,
            expires_at: expires_at,
            max_downloads: parsedMaxDownloads,
            uploaded_at: Date.now(),
            description: description ? String(description).trim().slice(0, 1000) : null
        };

        if (req.io) {
            req.io.to(room_id).emit("file-uploaded", fileMetadata);
        }

        res.status(201).json({
            status: 'success',
            data: fileMetadata
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 2. Get Files in Room Controller
 */
export const getFiles = async (req, res, next) => {
    try {
        const { room_id } = req.params;

        const { data: files, error } = await supabase
            .from('files')
            .select('id, filename, file_size, mime_type, room_id, password_hash, expires_at, max_downloads, download_count, uploaded_at, description')
            .eq('room_id', room_id)
            .gt('expires_at', Date.now());

        if (error) throw error;

        const mappedFiles = (files || []).map(file => {
            const { password_hash, ...rest } = file;
            return {
                ...rest,
                is_locked: password_hash !== null && password_hash !== ''
            };
        });

        res.status(200).json({
            status: 'success',
            results: mappedFiles.length,
            data: { files: mappedFiles }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 3. Secure File Download Controller
 */
export const downloadFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        const { data: file, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!file || file.expires_at < Date.now()) {
            return next(new AppError('File not found or has expired.', 404));
        }

        const token = req.headers['x-room-access-token'] || req.body.room_access_token;
        const hostId = req.headers['x-host-id'] || req.body.host_id;

        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', file.room_id).maybeSingle();
        if (!isCallerAuthorized(roomData, hostId, token)) {
            return next(new AppError('You are not authorized to access this room.', 401));
        }

        if (file.max_downloads && file.download_count >= file.max_downloads) {
            await supabase.storage.from('stash-files').remove([file.file_path]);
            await supabase.from('files').delete().eq('id', file.id);
            return next(new AppError('This file has reached its download limit and is no longer available.', 410));
        }

        if (file.password_hash) {
            if (!password) {
                return next(new AppError('This file is password-protected. Please provide a password.', 401));
            }
            const isMatch = bcrypt.compareSync(password, file.password_hash);
            if (!isMatch) {
                return next(new AppError('Incorrect password. Access denied.', 403));
            }
        }

        const newDownloadCount = file.download_count + 1;
        await supabase
            .from('files')
            .update({ download_count: newDownloadCount })
            .eq('id', file.id);

        if (req.io) {
            req.io.to(file.room_id).emit("file-downloaded", {
                fileId: file.id,
                downloadCount: newDownloadCount
            });
        }

        const { data: fileBlob, error: downloadError } = await supabase.storage
            .from('stash-files')
            .download(file.file_path);

        if (downloadError || !fileBlob) {
            return next(new AppError('Physical file missing from server storage.', 404));
        }

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(sanitizeFilename(file.filename))}"`);
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Length', fileBlob.size);

        const arrayBuffer = await fileBlob.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));

        // Burn-After-Reading cleanup
        if (file.max_downloads && newDownloadCount >= file.max_downloads) {
            try {
                await supabase.storage.from('stash-files').remove([file.file_path]);
                await supabase.from('files').delete().eq('id', file.id);
            } catch (err) {
                console.error('Error burning file:', err);
            }
        }
    } catch (err) {
        next(err);
    }
};

/**
 * 4. Get Client Room ID Controller
 */
export const getRoom = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        let room_id = hashIp(clientIP);

        let { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', room_id)
            .maybeSingle();

        if (error) throw error;

        if (!room) {
            const { data: newRoom, error: createErr } = await supabase
                .from('rooms')
                .insert([{
                    id: room_id,
                    name: 'Stash Default',
                    description: 'Auto-created room for devices on your network',
                    is_protected: false,
                    accept_only: false,
                    creator_socket_id: 'system',
                    created_at: Date.now()
                }])
                .select()
                .single();

            if (createErr) throw createErr;
            room = newRoom;
        }

        res.status(200).json({
            status: 'success',
            data: { room_id: room.id }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 5. File Preview Controller (S6, F5)
 */
export const getPreview = async (req, res, next) => {
    try {
        const { id } = req.params;
        const password = req.query.password || req.body?.password;

        const { data: file, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!file || file.expires_at < Date.now()) {
            return next(new AppError('File not found or has expired.', 404));
        }

        const token = req.headers['x-room-access-token'] || req.query.token || req.body?.room_access_token;
        const hostId = req.headers['x-host-id'] || req.query.host_id || req.body?.host_id;

        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', file.room_id).maybeSingle();
        if (!isCallerAuthorized(roomData, hostId, token)) {
            return next(new AppError('You are not authorized to preview files from this room.', 401));
        }

        // Check password protection on file preview (S6)
        if (file.password_hash) {
            if (!password) {
                return next(new AppError('This file is password-protected. Provide password to preview.', 401));
            }
            const isMatch = bcrypt.compareSync(password, file.password_hash);
            if (!isMatch) {
                return next(new AppError('Incorrect file password.', 403));
            }
        }

        // Check file extension
        const extension = path.extname(file.file_path).toLowerCase().substring(1);
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'bmp'];
        const videoExtensions = ['mp4', 'mov', 'webm', 'ogg', 'mkv', 'avi', 'm4v'];
        const audioExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];

        const isPreviewable = (file.mime_type && (file.mime_type.startsWith('image/') || file.mime_type.startsWith('video/') || file.mime_type.startsWith('audio/'))) ||
            imageExtensions.includes(extension) ||
            videoExtensions.includes(extension) ||
            audioExtensions.includes(extension);

        if (!isPreviewable) {
            return next(new AppError('Preview not available for this file type.', 400));
        }

        // Generate 10-minute signed URL
        const { data: signedUrlData, error: signError } = await supabase.storage
            .from('stash-files')
            .createSignedUrl(file.file_path, 600);

        if (signError) throw signError;

        res.status(200).json({
            status: 'success',
            data: { url: signedUrlData.signedUrl }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 6. Delete File Controller
 */
export const deleteFile = async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: file, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!file) {
            return next(new AppError('File not found or has already been deleted.', 404));
        }

        const token = req.headers['x-room-access-token'] || req.body.room_access_token;
        const hostId = req.headers['x-host-id'] || req.body.host_id;

        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', file.room_id).maybeSingle();
        if (!isCallerAuthorized(roomData, hostId, token)) {
            return next(new AppError('You are not authorized to delete files from this room.', 401));
        }

        await supabase.storage.from('stash-files').remove([file.file_path]);
        await supabase.from('files').delete().eq('id', file.id);

        if (req.io) {
            req.io.to(file.room_id).emit("file-deleted", file.id);
        }

        res.status(200).json({
            status: 'success',
            message: 'File stashed has been deleted.'
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 7. Create Room Controller (S7)
 */
export const createRoom = async (req, res, next) => {
    try {
        const { id, name, description, is_protected, accept_only, password } = req.body;
        const host_id = req.headers['x-host-id'] || req.body.host_id;

        if (!id || !name) {
            return next(new AppError('Room ID and Room Name are required.', 400));
        }

        const cleanId = String(id).trim().toLowerCase().slice(0, 64);
        const cleanName = String(name).trim().slice(0, 100);

        if (host_id && host_id !== 'system') {
            const { data: userRooms, error: countError } = await supabase
                .from('rooms')
                .select('id')
                .eq('creator_socket_id', host_id);

            if (countError) throw countError;
            if (userRooms && userRooms.length >= 10) {
                return next(new AppError('You have reached the maximum limit of 10 created rooms.', 400));
            }
        }

        const created_at = Date.now();
        let stack_key = null;
        let stack_key_expires_at = null;
        const accept_only_val = !!accept_only;

        if (is_protected) {
            if (!accept_only_val) {
                stack_key = password ? String(password).trim() : crypto.randomInt(100000, 999999).toString();
                stack_key_expires_at = Date.now() + 24 * 60 * 60 * 1000;
            }
        }

        const { data, error } = await supabase
            .from('rooms')
            .insert([{
                id: cleanId,
                name: cleanName,
                description: description ? String(description).trim().slice(0, 500) : '',
                is_protected: !!is_protected,
                stack_key,
                stack_key_expires_at,
                accept_only: accept_only_val,
                creator_socket_id: host_id || 'system',
                created_at
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return next(new AppError('A room with this ID already exists. Please choose a different ID.', 409));
            }
            throw error;
        }

        const token = generateRoomToken(data.id, host_id || 'system');

        res.status(201).json({
            status: 'success',
            data: {
                room: {
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    is_protected: data.is_protected,
                    accept_only: data.accept_only,
                    stack_key: data.stack_key,
                    created_at: data.created_at
                },
                token
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 8. Get Room Details Controller (S1, S9 - Never leak creator_socket_id, 404 for missing rooms)
 */
export const getRoomDetails = async (req, res, next) => {
    try {
        const { room_id } = req.params;
        const hostId = req.headers['x-host-id'] || req.query.host_id;
        const token = req.headers['x-room-access-token'] || req.query.token;

        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', room_id)
            .maybeSingle();

        if (error) throw error;
        if (!room) {
            return next(new AppError('Room not found.', 404));
        }

        const isHost = Boolean(hostId && room.creator_socket_id && room.creator_socket_id !== 'system' && room.creator_socket_id === hostId);
        const isAuthorized = isHost || Boolean(token && verifyRoomToken(token, room_id));

        if ((room.is_protected || room.accept_only) && !isAuthorized) {
            return res.status(403).json({
                status: 'forbidden',
                message: 'Access denied. Security key or approval required.',
                require_password: room.is_protected && !!room.stack_key,
                accept_only: room.accept_only,
                room_id: room.id
            });
        }

        const responseData = {
            id: room.id,
            name: room.name,
            description: room.description,
            is_protected: room.is_protected,
            accept_only: room.accept_only,
            has_stack_key: !!room.stack_key,
            created_at: room.created_at,
            is_host: isHost
        };

        if (isHost || isAuthorized) {
            responseData.stack_key = room.stack_key;
        }

        res.status(200).json({
            status: 'success',
            data: { room: responseData }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 9. Join Room Controller (S7)
 */
export const joinRoom = async (req, res, next) => {
    try {
        const { room_id } = req.params;
        const { stack_key, password } = req.body;
        const client_id = req.headers['x-host-id'] || req.body.client_id;
        const inputKey = (stack_key || password || '').trim();

        if (!client_id) {
            return next(new AppError('Client identity is required to join a room.', 400));
        }

        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', room_id)
            .maybeSingle();

        if (error) throw error;
        if (!room) {
            return next(new AppError('Room not found.', 404));
        }

        if (room.accept_only) {
            return next(new AppError('This room is in Accept Only mode and requires manual approval.', 403));
        }

        if (room.stack_key) {
            if (room.stack_key !== inputKey) {
                return next(new AppError('Incorrect access code.', 403));
            }
        }

        const token = generateRoomToken(room_id, client_id);

        res.status(200).json({
            status: 'success',
            data: { token }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 10. Update Room Settings Controller (S1, S2)
 */
export const updateRoomSettings = async (req, res, next) => {
    try {
        const { room_id } = req.params;
        const { name, description, is_protected, accept_only, password } = req.body;
        const host_id = req.headers['x-host-id'] || req.body.host_id;

        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', room_id)
            .maybeSingle();

        if (error) throw error;
        if (!room) {
            return next(new AppError('Room not found.', 404));
        }

        // Only verified creator can update settings
        if (!host_id || room.creator_socket_id !== host_id) {
            return next(new AppError('You are not authorized to update settings for this room.', 403));
        }

        let stack_key = room.stack_key;
        let stack_key_expires_at = room.stack_key_expires_at;

        if (is_protected !== undefined) {
            if (is_protected) {
                if (password && password.trim()) {
                    stack_key = password.trim();
                } else if (!stack_key) {
                    stack_key = crypto.randomInt(100000, 999999).toString();
                }
                stack_key_expires_at = Date.now() + 24 * 60 * 60 * 1000;
            } else {
                stack_key = null;
                stack_key_expires_at = null;
            }
        }

        const { data: updatedRoom, error: updateError } = await supabase
            .from('rooms')
            .update({
                name: name ? String(name).trim().slice(0, 100) : room.name,
                description: description !== undefined ? String(description).trim().slice(0, 500) : room.description,
                is_protected: is_protected !== undefined ? !!is_protected : room.is_protected,
                stack_key,
                stack_key_expires_at,
                accept_only: accept_only !== undefined ? !!accept_only : room.accept_only
            })
            .eq('id', room_id)
            .select()
            .single();

        if (updateError) throw updateError;

        if (req.io) {
            req.io.to(room_id).emit("room-updated", {
                id: updatedRoom.id,
                name: updatedRoom.name,
                description: updatedRoom.description,
                is_protected: updatedRoom.is_protected,
                accept_only: updatedRoom.accept_only,
                has_stack_key: !!updatedRoom.stack_key,
                stack_key: updatedRoom.stack_key
            });
        }

        res.status(200).json({
            status: 'success',
            data: { room: updatedRoom }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 11. Rotate Stack Key Controller (F4, S7)
 */
export const rotateRoomKey = async (req, res, next) => {
    try {
        const { room_id } = req.params;
        const host_id = req.headers['x-host-id'] || req.body.host_id;

        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', room_id)
            .maybeSingle();

        if (error) throw error;
        if (!room) {
            return next(new AppError('Room not found.', 404));
        }

        if (!host_id || room.creator_socket_id !== host_id) {
            return next(new AppError('Only the room host can rotate the access key.', 403));
        }

        const newKey = crypto.randomInt(100000, 999999).toString();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

        const { data: updatedRoom, error: updateError } = await supabase
            .from('rooms')
            .update({
                stack_key: newKey,
                stack_key_expires_at: expiresAt
            })
            .eq('id', room_id)
            .select()
            .single();

        if (updateError) throw updateError;

        if (req.io) {
            req.io.to(room_id).emit("room-updated", {
                id: updatedRoom.id,
                name: updatedRoom.name,
                description: updatedRoom.description,
                is_protected: updatedRoom.is_protected,
                accept_only: updatedRoom.accept_only,
                has_stack_key: true,
                stack_key: updatedRoom.stack_key
            });
        }

        res.status(200).json({
            status: 'success',
            data: { room: updatedRoom }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 12. Delete Room Helper & Controller (S1, S2, F12)
 */
export const deleteRoomData = async (roomId) => {
    const { data: files, error: filesError } = await supabase
        .from('files')
        .select('file_path')
        .eq('room_id', roomId);

    if (filesError) throw filesError;

    if (files && files.length > 0) {
        const paths = files.map(f => f.file_path);
        await supabase.storage.from('stash-files').remove(paths);
        await supabase.from('files').delete().eq('room_id', roomId);
    }

    const { error: deleteError } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

    if (deleteError) throw deleteError;

    roomHosts.delete(roomId);
    roomClipboards.delete(roomId);
};

export const deleteRoom = async (req, res, next) => {
    try {
        const { room_id } = req.params;
        const host_id = req.headers['x-host-id'] || req.body.host_id;

        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', room_id)
            .maybeSingle();

        if (error) throw error;
        if (!room) {
            return next(new AppError('Room not found.', 404));
        }

        if (!host_id || room.creator_socket_id !== host_id) {
            return next(new AppError('Only the room host can delete this room.', 403));
        }

        await deleteRoomData(room_id);

        if (req.io) {
            req.io.to(room_id).emit("room-deleted", { roomId: room_id });
        }

        res.status(200).json({
            status: 'success',
            message: 'Room deleted successfully.'
        });
    } catch (err) {
        next(err);
    }
};