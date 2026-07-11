import multer from 'multer';

// Configure multer to hold the uploaded file temporarily in a RAM buffer.
// The file binary data will be available at req.file.buffer in our controllers,
// allowing us to pipe it directly to Supabase S3 Storage.
const storage = multer.memoryStorage();

// Initialize multer middleware
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // Limit file size to 100MB
    }
});

export default upload;