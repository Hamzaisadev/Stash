import multer from 'multer';
import { AppError } from './utils/errors.js';
import { PLANS, SELF_HOSTED_PLAN } from './billing/plans.js';
import { IS_SELF_HOSTED } from './billing/entitlements.js';

// Configure multer to hold the uploaded file temporarily in a RAM buffer.
// The file binary data will be available at req.file.buffer in our controllers,
// allowing us to pipe it directly to Supabase S3 Storage.
const storage = multer.memoryStorage();

/**
 * Absolute ceiling, independent of plan.
 *
 * Uploads are still buffered in process memory (see the known limitation in the
 * README), so an unbounded multer limit would let one request OOM the server
 * regardless of what the caller paid for. This cap is a process-safety guard,
 * not a billing control: the plan's real `maxFileBytes` is enforced in
 * enforceUploadLimits below, which can only ever be stricter than this.
 *
 * Raising this is gated on presigned direct-to-storage uploads (roadmap 03),
 * after which the server stops holding file bodies at all.
 */
const HARD_CEILING_BYTES = IS_SELF_HOSTED
    ? 2 * 1024 * 1024 * 1024               // 2 GB on your own hardware
    : Math.max(
        PLANS.team.limits.maxFileBytes,
        PLANS.pro.limits.maxFileBytes,
        PLANS.free.limits.maxFileBytes
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
