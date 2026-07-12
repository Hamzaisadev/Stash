import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';
import { supabase } from './supabase.js';
import { AppError } from './utils/errors.js';
import { generateRoomToken, verifyRoomToken } from './utils/auth.js';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

// Helper: Hashing function for IP addresses to create an anonymous Room ID
const hashIp = (ip) => {
    let cleanIp = ip.replace(/^::ffff:/, '');
    if (
        cleanIp === '::1' || 
        cleanIp === '127.0.0.1' || 
        cleanIp === 'localhost' ||
        cleanIp.startsWith('192.168.') ||
        cleanIp.startsWith('10.') ||
        cleanIp.startsWith('172.16.')
    ) {
        cleanIp = 'local-stash-room';
    }
    return crypto.createHash("sha256").update(cleanIp).digest('hex').substring(0, 12);
};

const cleanupExpiredRooms = async () => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000; // Auto-delete rooms older than 24 hours
    const threshold = now - ONE_DAY;
    try {
        const { data: expiredRooms } = await supabase
            .from('rooms')
            .select('id')
            .lt('created_at', threshold)
            .neq('creator_socket_id', 'system'); // Keep default system rooms

        if (expiredRooms && expiredRooms.length > 0) {
            const roomIds = expiredRooms.map(r => r.id);
            const { data: files } = await supabase.from('files').select('file_path').in('room_id', roomIds);
            if (files && files.length > 0) {
                const paths = files.map(f => f.file_path);
                await supabase.storage.from('stash-files').remove(paths);
                await supabase.from('files').delete().in('room_id', roomIds);
            }
            await supabase.from('rooms').delete().in('id', roomIds);
            console.log(`Pruned ${expiredRooms.length} expired rooms.`);
        }
    } catch (err) {
        console.error("Error during room pruning:", err);
    }
};

// Helper: Clean up expired files from PostgreSQL and Supabase S3 Storage (Lazy Cleanup)
const cleanupExpiredFiles = async () => {
    const now = Date.now();
    try {
        await cleanupExpiredRooms();
        
        // Query expired files from database
        const { data: expiredFiles, error } = await supabase
            .from('files')
            .select('id, file_path')
            .lt('expires_at', now);

        if (error) throw error;

        if (expiredFiles && expiredFiles.length > 0) {
            const pathsToDelete = expiredFiles.map(f => f.file_path);
            const idsToDelete = expiredFiles.map(f => f.id);

            // 1. Delete from S3 storage
            const { error: storageError } = await supabase.storage
                .from('stash-files')
                .remove(pathsToDelete);
            
            if (storageError) console.error("Storage pruning error:", storageError);

            // 2. Delete rows from database
            const { error: dbError } = await supabase
                .from('files')
                .delete()
                .in('id', idsToDelete);

            if (dbError) throw dbError;

            console.log(`Pruned ${expiredFiles.length} expired file(s) from S3 and database.`);
        }
    } catch (err) {
        console.error('Error running database cleanup:', err);
    }
};

/**
 * 1. Upload File Controller (Supports Single File or Multi-File On-The-Fly Zipping)
 */
export const uploadFile = async (req, res, next) => {
    try {
        if ((!req.file && !req.files) || (req.files && req.files.length === 0)) {
            return next(new AppError('No files provided. Please attach files under the "files" field.', 400));
        }

        const { password, expires_in, max_downloads } = req.body;

        const clientIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        let room_id = req.body.room_id;
        if (!room_id || room_id === 'undefined' || room_id === 'null' || room_id.trim() === '') {
            room_id = hashIp(clientIP);
        }
        console.log("UPLOAD: Resolved room_id to:", room_id);

        // Enforce room authorization check
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
                    creator_socket_id: 'system',
                    created_at: Date.now()
                }])
                .select()
                .single();

            if (createErr) throw createErr;
            roomData = newRoom;
        }

        if (roomData) {
            const hasNoSecurity = !roomData.is_protected && !roomData.stack_key && !roomData.accept_only;
            const isHost = hostId && roomData.creator_socket_id === hostId;
            const isAuthorized = isHost || (token && verifyRoomToken(token, room_id));

            if (!hasNoSecurity && !isAuthorized) {
                return next(new AppError('You are not authorized to upload files to this room.', 401));
            }
        }

        const minutes = parseInt(expires_in) || 1440;
        const expires_at = Date.now() + (minutes * 60 * 1000);

        const parsedMaxDownloads = max_downloads ? parseInt(max_downloads) : null;

        let password_hash = null;
        let salt = null;
        if (password && password.trim() !== '') {
            salt = bcrypt.genSaltSync(10);
            password_hash = bcrypt.hashSync(password, salt);
        }

        const fileId = crypto.randomUUID();
        
        let finalFilename = "";
        let finalMimeType = "";
        let finalSize = 0;
        let storagePath = "";
        let bufferToUpload = null;

        // C. Process uploads based on single vs multiple file count
        if (req.files && req.files.length > 1) {
            // MULTI-FILE ZIP OPTIMIZATION (Textbook Stream Compression)
            // Generate a readable archive name
            const timestampSuffix = Date.now().toString().substring(8);
            finalFilename = `stash-archive-${timestampSuffix}.zip`;
            finalMimeType = 'application/zip';
            storagePath = `uploads/${fileId}.zip`;

            // Initialize archiver stream engine
            const archive = archiver('zip', { zlib: { level: 9 } });

            // Stream collector to accumulate chunks in a Promise
            const streamPromise = new Promise((resolve, reject) => {
                const chunks = [];
                archive.on('data', (chunk) => chunks.push(chunk));
                archive.on('error', reject);
                archive.on('end', () => resolve(Buffer.concat(chunks)));
            });

            // Append each file buffer into the zip archive stream
            req.files.forEach(file => {
                archive.append(file.buffer, { name: file.originalname });
            });

            // Finalize/close the archive stream
            archive.finalize();

            // Wait for compression stream to compile the final zip buffer
            bufferToUpload = await streamPromise;
            finalSize = bufferToUpload.length;
        } else {
            // SINGLE FILE UPLOAD
            const singleFile = req.file || req.files[0];
            finalFilename = singleFile.originalname;
            finalMimeType = singleFile.mimetype;
            finalSize = singleFile.size;
            
            const extension = path.extname(singleFile.originalname);
            storagePath = `uploads/${fileId}${extension}`;
            bufferToUpload = singleFile.buffer;
        }

        // A. Upload the binary memory buffer to Supabase S3 Storage
        const { error: storageError } = await supabase.storage
            .from('stash-files')
            .upload(storagePath, bufferToUpload, {
                contentType: finalMimeType,
                upsert: true
            });

        if (storageError) {
            return next(new AppError(`S3 Storage Upload Failed: ${storageError.message}`, 500));
        }

        // B. Insert metadata row into PostgreSQL database
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
                uploaded_at: Date.now()
            }]);

        if (dbError) {
            // Rollback: delete S3 file if metadata save failed to avoid leaks
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
            uploaded_at: Date.now()
        };

        // Broadcast upload event to the WebSockets room
        req.io.to(room_id).emit("file-uploaded", fileMetadata);

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

        // Prune expired files
        await cleanupExpiredFiles();

        // Fetch active metadata rows
        const { data: files, error } = await supabase
            .from('files')
            .select('id, filename, file_size, mime_type, room_id, password_hash, expires_at, max_downloads, download_count, uploaded_at')
            .eq('room_id', room_id)
            .gt('expires_at', Date.now());

        if (error) throw error;

        // Map database records to mask security hashes
        const mappedFiles = files.map(file => {
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

        await cleanupExpiredFiles();

        // Query file details
        const { data: file, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;

        if (!file) {
            return next(new AppError('File not found or has expired.', 404));
        }

        // Verify room access
        const token = req.headers['x-room-access-token'] || req.body.room_access_token;
        const hostId = req.headers['x-host-id'] || req.body.host_id;

        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', file.room_id).maybeSingle();
        if (roomData) {
            const hasNoSecurity = !roomData.is_protected && !roomData.stack_key && !roomData.accept_only;
            const isHost = hostId && roomData.creator_socket_id === hostId;
            const isAuthorized = isHost || (token && verifyRoomToken(token, file.room_id));

            if (!hasNoSecurity && !isAuthorized) {
                return next(new AppError('You are not authorized to access this room.', 401));
            }
        }

        // Access limit check
        if (file.max_downloads && file.download_count >= file.max_downloads) {
            // Delete file from S3 & PostgreSQL immediately
            await supabase.storage.from('stash-files').remove([file.file_path]);
            await supabase.from('files').delete().eq('id', file.id);
            return next(new AppError('This file has reached its download limit and is no longer available.', 410));
        }

        // Password verification check
        if (file.password_hash) {
            if (!password) {
                return next(new AppError('This file is password-protected. Please provide a password.', 401));
            }
            const isMatch = bcrypt.compareSync(password, file.password_hash);
            if (!isMatch) {
                return next(new AppError('Incorrect password. Access denied.', 403));
            }
        }

        // Increment database download counter
        const newDownloadCount = file.download_count + 1;
        const { error: updateError } = await supabase
            .from('files')
            .update({ download_count: newDownloadCount })
            .eq('id', file.id);

        if (updateError) throw updateError;

        // Broadcast download receipt to room so uploader sees live count
        req.io.to(file.room_id).emit("file-downloaded", { 
            fileId: file.id, 
            downloadCount: newDownloadCount 
        });

        // Download binary file blob from S3 storage
        const { data: fileBlob, error: downloadError } = await supabase.storage
            .from('stash-files')
            .download(file.file_path);

        if (downloadError || !fileBlob) {
            return next(new AppError('Physical file missing from server storage.', 404));
        }

        // Set response download headers
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
        res.setHeader('Content-Type', file.mime_type);
        res.setHeader('Content-Length', fileBlob.size);

        // Convert blob buffer to standard Node Buffer and transmit
        const arrayBuffer = await fileBlob.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));

        // Burn-After-Reading logic: if downloads constraint hit
        if (file.max_downloads && newDownloadCount >= file.max_downloads) {
            try {
                await supabase.storage.from('stash-files').remove([file.file_path]);
                await supabase.from('files').delete().eq('id', file.id);
                console.log(`File ${file.filename} was successfully 'burned' after reaching limit.`);
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

        // Fetch room info
        let { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', room_id)
            .maybeSingle();

        if (error) throw error;

        if (!room) {
            // Auto-create local room with defaults
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
        } else if (room.is_protected) {
            // If the local network room was set to Protected, new users on the network should NOT auto-discover it.
            // Route them to a brand new private room.
            const privateRoomId = 'private-' + crypto.randomBytes(4).toString('hex');
            const { data: newRoom, error: createErr } = await supabase
                .from('rooms')
                .insert([{
                    id: privateRoomId,
                    name: 'Private Room',
                    description: 'Your own private room. Share link to invite others.',
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
 * 5. File Preview Controller (Signed URL for Image/Video Thumbnails)
 */
export const getPreview = async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: file, error } = await supabase
            .from('files')
            .select('file_path, mime_type, room_id')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!file) return next(new AppError('File not found.', 404));

        // Verify room access
        const token = req.headers['x-room-access-token'] || req.query.token || req.body.room_access_token;
        const hostId = req.headers['x-host-id'] || req.query.host_id || req.body.host_id;

        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', file.room_id).maybeSingle();
        if (roomData) {
            const hasNoSecurity = !roomData.is_protected && !roomData.stack_key && !roomData.accept_only;
            const isHost = hostId && roomData.creator_socket_id === hostId;
            const isAuthorized = isHost || (token && verifyRoomToken(token, file.room_id));

            if (!hasNoSecurity && !isAuthorized) {
                return next(new AppError('You are not authorized to preview files from this room.', 401));
            }
        }

        if (error) throw error;
        if (!file) return next(new AppError('File not found.', 404));

        // Only allow previews for images, videos, and audios
        if (!file.mime_type.startsWith('image/') && !file.mime_type.startsWith('video/') && !file.mime_type.startsWith('audio/')) {
            return next(new AppError('Preview not available for this file type.', 400));
        }

        // Generate a 10-minute signed URL
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
 * 5. Delete File Controller
 */
export const deleteFile = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Query file metadata to resolve S3 storage file path
        const { data: file, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        if (!file) {
            return next(new AppError('File not found or has already been deleted.', 404));
        }

        // Verify room access
        const token = req.headers['x-room-access-token'] || req.body.room_access_token;
        const hostId = req.headers['x-host-id'] || req.body.host_id;

        const { data: roomData } = await supabase.from('rooms').select('*').eq('id', file.room_id).maybeSingle();
        if (roomData) {
            const hasNoSecurity = !roomData.is_protected && !roomData.stack_key && !roomData.accept_only;
            const isHost = hostId && roomData.creator_socket_id === hostId;
            const isAuthorized = isHost || (token && verifyRoomToken(token, file.room_id));

            if (!hasNoSecurity && !isAuthorized) {
                return next(new AppError('You are not authorized to delete files from this room.', 401));
            }
        }

        // 1. Delete binary asset from Supabase S3 Storage
        const { error: storageError } = await supabase.storage
            .from('stash-files')
            .remove([file.file_path]);

        if (storageError) console.error("S3 Deletion error:", storageError);

        // 2. Delete database metadata record from PostgreSQL
        const { error: dbError } = await supabase
            .from('files')
            .delete()
            .eq('id', file.id);

        if (dbError) throw dbError;

        // Broadcast deletion event to active room sockets to trigger visual removals
        req.io.to(file.room_id).emit("file-deleted", file.id);

        res.status(200).json({
            status: 'success',
            message: 'File stashed has been deleted.'
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 6. Create Room Controller
 */
export const createRoom = async (req, res, next) => {
    try {
        const { id, name, description, is_protected, access_mode } = req.body;
        const host_id = req.headers['x-host-id'] || req.body.host_id;

        if (!id || !name) {
            return next(new AppError('Room ID and Room Name are required.', 400));
        }

        // Limit check: max 5 created rooms per client
        if (host_id && host_id !== 'system') {
            const { data: userRooms, error: countError } = await supabase
                .from('rooms')
                .select('id')
                .eq('creator_socket_id', host_id);

            if (countError) throw countError;
            if (userRooms && userRooms.length >= 5) {
                return next(new AppError('You have reached the maximum limit of 5 created rooms.', 400));
            }
        }

        const created_at = Date.now();
        let stack_key = null;
        let stack_key_expires_at = null;
        let accept_only = false;

        if (access_mode === 'stack_key' || (is_protected && access_mode !== 'accept_only')) {
            stack_key = Math.floor(100000 + Math.random() * 900000).toString();
            stack_key_expires_at = Date.now() + 80000;
        } else if (access_mode === 'accept_only') {
            accept_only = true;
        }

        const { data, error } = await supabase
            .from('rooms')
            .insert([{
                id: id.trim(),
                name: name.trim(),
                description: description ? description.trim() : '',
                is_protected: !!is_protected,
                stack_key,
                stack_key_expires_at,
                accept_only,
                creator_socket_id: host_id,
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

        const token = generateRoomToken(data.id, host_id);

        res.status(201).json({
            status: 'success',
            data: {
                room: data,
                token
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 7. Get Room Details Controller (Filters sensitive columns for unauthorized guests)
 */
export const getRoomDetails = async (req, res, next) => {
    try {
        const { room_id } = req.params;
        const hostId = req.headers['x-host-id'] || req.query.host_id;

        // Lazy cleanup expired rooms in background
        cleanupExpiredRooms().catch(err => console.error("Room pruning failed:", err));

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
                    name: room_id,
                    description: 'Public shareable room',
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

        // Lazy key rotation check (rotates Stack Key every 80 seconds if it has expired)
        if (room.stack_key && room.stack_key_expires_at < Date.now()) {
            room.stack_key = Math.floor(100000 + Math.random() * 900000).toString();
            room.stack_key_expires_at = Date.now() + 80000;

            await supabase
                .from('rooms')
                .update({
                    stack_key: room.stack_key,
                    stack_key_expires_at: room.stack_key_expires_at
                })
                .eq('id', room.id);

            // Notify occupants of the rotation
            req.io.to(room.id).emit("room-updated", {
                id: room.id,
                name: room.name,
                description: room.description,
                is_protected: room.is_protected,
                accept_only: room.accept_only,
                has_stack_key: true,
                stack_key_expires_at: room.stack_key_expires_at
            });
        }

        const isHost = hostId && room.creator_socket_id === hostId;
        const token = req.headers['x-room-access-token'] || req.query.token;
        const isAuthorized = isHost || (token && verifyRoomToken(token, room_id));

        const responseData = {
            id: room.id,
            name: room.name,
            description: room.description,
            is_protected: room.is_protected,
            accept_only: room.accept_only,
            has_stack_key: !!room.stack_key,
            stack_key_expires_at: room.stack_key_expires_at,
            created_at: room.created_at,
            creator_socket_id: room.creator_socket_id
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
 * 8. Join Room Controller (Verifies key access)
 */
export const joinRoom = async (req, res, next) => {
    try {
        const { room_id } = req.params;
        const { stack_key } = req.body;
        const client_id = req.headers['x-host-id'] || req.body.client_id;

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
            if (room.stack_key_expires_at < Date.now()) {
                return next(new AppError('Access code has expired. Please try with a fresh code.', 400));
            }
            if (room.stack_key !== stack_key) {
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
 * 9. Update Room Settings Controller
 */
export const updateRoomSettings = async (req, res, next) => {
    try {
        const { room_id } = req.params;
        const { name, description, is_protected, accept_only } = req.body;
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

        if (room.creator_socket_id !== 'system' && room.creator_socket_id !== host_id) {
            return next(new AppError('You are not authorized to update settings for this room.', 403));
        }

        let creator_socket_id = room.creator_socket_id;
        if (creator_socket_id === 'system' && host_id) {
            creator_socket_id = host_id;
        }

        let stack_key = room.stack_key;
        let stack_key_expires_at = room.stack_key_expires_at;

        if (is_protected !== undefined) {
            if (is_protected) {
                if (!stack_key) {
                    stack_key = Math.floor(100000 + Math.random() * 900000).toString();
                    stack_key_expires_at = Date.now() + 80000;
                }
            } else {
                stack_key = null;
                stack_key_expires_at = null;
            }
        }

        const { data: updatedRoom, error: updateError } = await supabase
            .from('rooms')
            .update({
                name: name ? name.trim() : room.name,
                description: description !== undefined ? description.trim() : room.description,
                is_protected: is_protected !== undefined ? !!is_protected : room.is_protected,
                stack_key,
                stack_key_expires_at,
                accept_only: accept_only !== undefined ? !!accept_only : room.accept_only,
                creator_socket_id
            })
            .eq('id', room_id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Broadcast configurations change
        req.io.to(room_id).emit("room-updated", {
            id: updatedRoom.id,
            name: updatedRoom.name,
            description: updatedRoom.description,
            is_protected: updatedRoom.is_protected,
            accept_only: updatedRoom.accept_only,
            has_stack_key: !!updatedRoom.stack_key,
            stack_key: updatedRoom.stack_key,
            stack_key_expires_at: updatedRoom.stack_key_expires_at
        });

        res.status(200).json({
            status: 'success',
            data: { room: updatedRoom }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 10. Rotate Stack Key Controller
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

        if (room.creator_socket_id !== host_id) {
            return next(new AppError('Only the room host can rotate the access key.', 403));
        }

        const newKey = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 80000;

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

        req.io.to(room_id).emit("room-updated", {
            id: updatedRoom.id,
            name: updatedRoom.name,
            description: updatedRoom.description,
            is_protected: updatedRoom.is_protected,
            accept_only: updatedRoom.accept_only,
            has_stack_key: true,
            stack_key_expires_at: updatedRoom.stack_key_expires_at,
            stack_key: updatedRoom.stack_key
        });

        res.status(200).json({
            status: 'success',
            data: { room: updatedRoom }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 11. Delete Room Controller
 */
export const deleteRoomData = async (roomId) => {
    // 1. Delete all room files in storage
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

    // 2. Delete room from DB
    const { error: deleteError } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

    if (deleteError) throw deleteError;
};

/**
 * 11. Delete Room Controller
 */
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

        // Allow owner OR default system rooms to be deleted by their session initiator
        if (room.creator_socket_id !== host_id && room.creator_socket_id !== 'system') {
            return next(new AppError('Only the room host can delete this room.', 403));
        }

        await deleteRoomData(room_id);

        res.status(200).json({
            status: 'success',
            message: 'Room deleted successfully.'
        });
    } catch (err) {
        next(err);
    }
};