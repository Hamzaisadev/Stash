//we create an custom error because by default the javascript error has the error object which have the message and stack it doesnt know about the http errors meaning that it has no way of telling that if a error is server side or client side or database side so we create an new error here Extending the Error class of the javascript this also saves us from reapeating the code in other functions that are supposed to show the errors


export class AppError extends Error {
    constructor(message, statusCode){
        super(message);
        this.statusCode = statusCode;

        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

        this.isOperational = true 

        Error.captureStackTrace(this,this.constructor)

    }
}

export const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    res.status(err.statusCode).json({
        status  : err.status, 
        error: err,
        message: err.message,
        stack: err.stack
    })
}