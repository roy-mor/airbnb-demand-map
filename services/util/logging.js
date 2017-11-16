import winston from 'winston';
import format from 'util';
import util from 'util';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [
        new winston.transports.File({
            filename: 'error.log',
            level: 'error'
        }),
        new winston.transports.File({
            filename: 'airbnbdemand-script.log'
        })
    ]
});

// If we're not in production then also log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

function logFactory(level) {
    return function (msg, obj) {
        if (typeof obj === 'string' || obj instanceof String || typeof obj === 'number') {
            return logger.log({
                level,
                message: `${msg} ${obj}`
            });
        } else {
            return logger.log({
                level,
                message: msg,
                value: obj 
            });
        }
    }
}

let log = logFactory('info');
let error = logFactory('error');
let warn = logFactory('warn');

module.exports = {
    logger,
    log,
    error,
    warn
};