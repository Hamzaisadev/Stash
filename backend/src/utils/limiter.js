import rateLimit from "express-rate-limit";

// Global Rate Limiting (500 req per 15 min)
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests, please try again later.' }
});

// Stricter limiter for room creation and joins (60 req per 15 min)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Rate limit reached for room operations. Try again later.' }
});
