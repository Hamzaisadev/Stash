import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { dbRun, dbGet, dbAll } from './db.js'
import { AppError } from './utils/errors.js'


// helper function to hashing the ip
const hashIp = (ip) => {

    const cleanIp = ip === '::1' || ip === '127.0.0.1' ? 'localhost' : ip;
    return crypto.createHash("sha256").update(cleanIp).digest('hex').substring(0, 12);

}


const cleanupExpiredFiles = async () => {
    const now = Date.now();

    try {
        const expiredFiles = await dbAll('SELECT * FROM files WHERE expires_at < ?', [now]);
        for (const file of expiredFiles) {
            if (fs.existsSync(file.file_path)) {
                fs.unlinkSync(file.file_path)
            }
            await dbRun('DELETE FROM files WHERE id = ? ', [file.id])
        }
        if (expiredFiles.length > 0) {
            console.log(`pruned ${expiredFiles.length} expired file(s) from disk and database.`)
        }

    } catch (err) {
        console.error('error running database cleaneup: ', err)
    }

}
// upload file controller
export const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new AppError('No file provided. Please attach a file under the "file" field', 400))
        }

        const { password, expires_in, max_downloads } = req.body;


        const clientIP = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        const room_id = req.body.room_id || hashIp(clientIP)

        const minutes = parseInt(expires_in)
        const expires_at = Date.now() + (minutes * 60 * 1000)

        const parsedMaxDownloads = max_downloads ? parseInt(max_downloads) : null;

        let password_hash = null;
        let salt = null;
        if (password && password.trim() !== '') {
            salt = bcrypt.genSaltSync(10)
            password_hash = bcrypt.hashSync(password, salt)
        }

        const fileId = crypto.randomUUID()

        const query = `
                    INSERT INTO files (
                id, filename, file_path, file_size, mime_type, 
                room_id, password_hash, salt, expires_at, 
                max_downloads, download_count, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
`;

        await dbRun(query, [
            fileId,
            req.file.originalname,
            req.file.path,
            req.file.size,
            req.file.mimetype,
            room_id,
            password_hash,
            salt,
            expires_at,
            parsedMaxDownloads,
            Date.now()

        ]);
        res.status(201).json({
            status: "success",
            data: {
                id: fileId,
                filename: req.file.originalname,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                room_id: room_id,
                is_locked: password_hash !== null,
                expires_at: expires_at,
                max_downloads: parsedMaxDownloads,
                uploaded_at: Date.now()
            }
        })
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path)
        }
        next(err)
    }
}

//get file controller 

export const getFiles = async (req, res, next) => {
    try {
        const { room_id } = req.params;

        await cleanupExpiredFiles()

        const query = `
          SELECT id, filename, file_size, mime_type, room_id, 
                   (password_hash IS NOT NULL) AS is_locked, 
                   expires_at, max_downloads, download_count, uploaded_at
            FROM files
            WHERE room_id = ? AND expires_at > ?
        `
        const files = await dbAll(query, [room_id, Date.now()])

        res.status(200).json({
            status: 'success',
            results: files.length,
            data: { files }
        })
    } catch (error) {

    }

}

// download controller

export const downloadFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        await cleanupExpiredFiles()
        const file = await dbGet('SELECT * FROM files WHERE id = ?', [id]);

        if (!file) {
            return next(new AppError('File not found or has expired', 404));
        }

        if (file.max_downloads && file.download_count >= file.max_downloads) {
            if (fs.existsSync(file.file_path)) {
                fs.unlinkSync(file.file_path)
            }

            await dbRun('DELETE FROM files WHERE id = ?', [file.id]);
            return next(new AppError('This file has reached its download limit and is no longer available.', 410));

        }

        if (file.password_hash) {
            if (!password) {
                return next(new AppError('This file is password protected. Please provide a password', 401));

            }

            const isMatch = bcrypt.compareSync(password, file.password_hash)
            if (!isMatch) {
                return next(new AppError('Incorrect password. Acess denied', 403))

            }
        }
        if (!fs.existsSync(file.file_path)) {
            return next(new AppError('Physical file missing from server storage', 404))
        }

        const newDownloadCount = file.download_count + 1;

        await dbRun(`UPDATE files SET download_count = ? WHERE id = ?`, [newDownloadCount, file.id])

        res.setHeader('Content-Disposition', `attachment; filename= "${encodeURIComponent(file.filename)}"`
        )
        res.setHeader('Content-type', file.mime_type);
        res.setHeader('Content-length', file.file_size);


        const fileStream = fs.createReadStream(file.file_path);
        fileStream.pipe(res);

        fileStream.on('end', async () => {
            if (file.max_downloads && newDownloadCount >= file.max_downloads) {
                try {
                    if (fs.existsSync(file.file_path)) {

                        fs.unlinkSync(file.file_path)
                    }
                    await dbRun('DELETE FROM files WHERE id = ?', [file.id])
                    console.log(`File ${file.filename} was successfully 'burned' after reaching limit.`)
                } catch (err) {
                    console.error('Error burning file:', err)
                }
            }
        })
        fileStream.on('error', (err) => {
            console.error('Error streaming file:', err)
        })
    } catch (err) {
        next(err)
    }

}

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