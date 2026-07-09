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

export const getFilees = async (req, res, next) => {
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