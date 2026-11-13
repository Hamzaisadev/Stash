import multer from 'multer';
import v8 from 'node:v8';
import { AppError } from './utils/errors.js';
import { PLANS, SELF_HOSTED_PLAN } from './billing/plans.js';
import { IS_SELF_HOSTED } from './billing/entitlements.js';

// Configure multer to hold the uploaded file temporarily in a RAM buffer.
// The file binary data will be available at req.file.buffer in our controllers,
// allowing us to pipe it directly to Supabase S3 Storage.
const storage = multer.memoryStorage();

/**
 * Absolute ceiling, independent of plan — what the *process* can hold.
 *
 * Uploads are still buffered in process memory (see the known limitation in the
 * README). This cap is a process-safety guard, not a billing control: the
 * plan's real `maxFileBytes` is enforced in enforceUploadLimits below, which
 * can only ever be stricter than this. Raising it is gated on presigned
 * direct-to-storage uploads (roadmap 03), after which the server stops holding
 * file bodies at all.
 *
 * The previous value was max(team, pro, free) = 20 GB, which is not a
 * process-safety guard at all: multer buffers the whole body in RAM, so a
 * single 20 GB-permitting request OOMs any normal instance long before
 * enforceUploadLimits below ever sees it. On a 512 MB host the kill arrives
 * mid-transfer, so the browser reports a network error rather than a limit.
 *
 * Sized off the container's real memory instead, leaving headroom for the
 * runtime, the zip buffer (multi-file uploads hold the parts *and* the archive
 * at once) and concurrent requests. UPLOAD_MEMORY_CEILING_MB overrides it for
 * hosts where the detected total is wrong or more headroom is available.
 */
const memoryCeilingBytes = () => {
    const override = Number(process.env.UPLOAD_MEMORY_CEILING_MB);
    if (Number.isFinite(override) && override > 0) return override * 1024 * 1024;

    // Node's heap cap tracks the container limit far better than os.totalmem(),
    // which on a cgroup-limited host reports the whole physical machine.
    const heapLimit = v8.getHeapStatistics().heap_size_limit;
    // A quarter leaves room for the archive copy plus a second in-flight upload.
    return Math.max(32 * 1024 * 1024, Math.floor(heapLimit / 4));
};

const HARD_CEILING_BYTES = IS_SELF_HOSTED
    ? Math.max(
        2 * 1024 * 1024 * 1024,            // 2 GB floor on your own hardware
        memoryCeilingBytes()
    )
    : Math.min(
        memoryCeilingBytes(),
        Math.max(
            PLANS.team.limits.maxFileBytes,
            PLANS.pro.limits.maxFileBytes,
            PLANS.free.limits.maxFileBytes
        )
    );

const MAX_FILES_CEILING = IS_SELF_HOSTED
    ? SELF_HOSTED_PLAN.limits.maxFilesPerUpload
    : PLANS.team.limits.maxFilesPerUpload;

// Initialize multer middleware
const upload = multer({
    storage: storage,
    limits: {
        fileSize: HARD_CEILING_BYTES,
        files: MAX_FILES_CEILING,
    }
});

/** Human-readable sizes for limit messages ("5 GB", not "5368709120 bytes"). */
export const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined) return 'unlimited';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const rounded = value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1);
    return `${rounded} ${units[unit]}`;
};

/**
 * Translate multer's own rejections into operational AppErrors.
 *
 * A MulterError carries a `code` but no `statusCode` and no `isOperational`,
 * so globalErrorHandler classifies it as an unknown programming error and
 * replies with a generic 500 "Something went wrong." The upload genuinely
 * failed for a reason the caller could act on — too large, too many files,
 * wrong field name — and none of it reached them.
 *
 * Wrapping the multer middleware (rather than special-casing MulterError in
 * the global handler) keeps the knowledge of multer's codes next to the multer
 * configuration that produces them.
 */
const MULTER_MESSAGES = {
    LIMIT_FILE_SIZE: () =>
        `That file is over the ${formatBytes(HARD_CEILING_BYTES)} limit this server can accept ` +
        `in a single upload.`,
    LIMIT_FILE_COUNT: () =>
        `Too many files in one upload. This server accepts at most ${MAX_FILES_CEILING}.`,
    LIMIT_UNEXPECTED_FILE: () =>
        'Unexpected file field. Attach files under the "files" field.',
};

const MULTER_STATUS = {
    LIMIT_FILE_SIZE: 413,
    LIMIT_FILE_COUNT: 413,
    LIMIT_UNEXPECTED_FILE: 400,
};

export const handleUpload = (req, res, next) => {
    upload.array('files')(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            const build = MULTER_MESSAGES[err.code];
            return next(new AppError(
                build ? build() : `Upload rejected: ${err.message}`,
                MULTER_STATUS[err.code] ?? 400
            ));
        }

        // Aborted/truncated bodies: the client went away or the connection
        // dropped mid-transfer. Not a server fault, and not worth a 500.
        if (err.type === 'request.aborted' || err.code === 'ECONNABORTED') {
            return next(new AppError('Upload connection closed before the files finished sending.', 400));
        }

        return next(err);
    });
};

/**
 * Plan-aware upload validation, applied after multer has parsed the request.
 *
 * Multer only knows the one hard ceiling above, so per-plan size and count
 * limits are checked here, where req.entitlement is available. Rejections use
 * 413 (too large) and 402 (quota exhausted) so the frontend can tell "this file
 * is too big for your plan" apart from "you have used your allowance today".
 */
export const enforceUploadLimits = (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) return next();

    const limits = req.entitlement?.limits;
    if (!limits) return next();

    const { maxFileBytes, maxFilesPerUpload } = limits;

    if (maxFilesPerUpload !== null && files.length > maxFilesPerUpload) {
        return next(new AppError(
            `Your ${req.entitlement.plan.name} plan allows ${maxFilesPerUpload} files per upload. ` +
            `You sent ${files.length}.`,
            413
        ));
    }

    if (maxFileBytes !== null) {
        const oversized = files.find((f) => f.size > maxFileBytes);
        if (oversized) {
            return next(new AppError(
                `"${oversized.originalname}" is ${formatBytes(oversized.size)}, over the ` +
                `${formatBytes(maxFileBytes)} per-file limit on the ${req.entitlement.plan.name} plan.`,
                413
            ));
        }
    }

    next();
};

export default upload;
