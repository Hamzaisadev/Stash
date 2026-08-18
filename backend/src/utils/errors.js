export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
            stack: err.stack
        });
    }

    // In production, only leak message for operational errors
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }

    // Unknown or programming errors: log internally and send generic response
    console.error('Unhandled server error:', err);
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong. Please try again later.'
    });
};