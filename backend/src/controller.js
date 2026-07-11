import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase.js';
import { AppError } from './utils/errors.js';

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

// Helper: Clean up expired files from PostgreSQL and Supabase S3 Storage (Lazy Cleanup)
const cleanupExpiredFiles = async () => {
    const now = Date.now();
    try {
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
 * 1. Upload File Controller
 */
export const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new AppError('No file provided. Please attach a file under the "file" field.', 400));
        }

        const { password, expires_in, max_downloads } = req.body;

        const clientIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        const room_id = req.body.room_id || hashIp(clientIP);

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
        const extension = path.extname(req.file.originalname);
        // We structure files into an uploads/ folder inside our S3 bucket
        const storagePath = `uploads/${fileId}${extension}`;

        // A. Upload the binary memory buffer to Supabase S3 Storage
        const { error: storageError } = await supabase.storage
            .from('stash-files')
            .upload(storagePath, req.file.buffer, {
                contentType: req.file.mimetype,
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
                filename: req.file.originalname,
                file_path: storagePath,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
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
            filename: req.file.originalname,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
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
        const room_id = hashIp(clientIP);
        res.status(200).json({
            status: 'success',
            data: { room_id }
        });
    } catch (err) {
        next(err);
    }
};