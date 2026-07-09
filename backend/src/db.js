import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import path from "path"


//converting the file url to path
const __filename = fileURLToPath(import.meta.url);

//getting the folder the file is located
const __dirname = path.dirname(__filename)

const dbPath = path.resolve(__dirname, "../stach.db")

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the SQLite database:', err.message);

    } else {
        console.log('Connected to the SQlite databse at :', dbPath)
    }
})

export const initDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
            CREATE TABLE IF NOT EXISTS files(
             id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    mime_type TEXT NOT NULL,
                    room_id TEXT NOT NULL,
                    password_hash TEXT,
                    salt TEXT,
                    expires_at INTEGER NOT NULL,
                    max_downloads INTEGER,
                    download_count INTEGER DEFAULT 0,
                    uploaded_at INTEGER NOT NULL

            )
         `, (err) => {
                if (err) return reject(err)


            });
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_files_room_id 
                ON files (room_id)
            `, (err) => {
                if (err) return reject(err);
                console.log('Database tables and indexes initialized successfully.');
                resolve(db);
            });
        });
    });
}

export default db

// promisified wrapper for db.run 

export const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes })
            }
        })
    })
}

// promisified wrapper for db.get 
export const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err)
            } else {
                resolve(row)
            }
        })
    })
}
// promisified wrapper for db.all

export const dbAll = (sql , params = []) => {
    return new Promise ((resolve , reject) =>{
        db.all(sql, params, (err, rows) =>{
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        })
    })
}
