import winston from 'winston';
import format from 'util';
import util from 'util';
import path from 'path';
import fs from 'fs';

const logPath = path.join(__dirname, '../logs/');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [
        new winston.transports.File({
            filename: logPath + 'error.log',
            level: 'error'
        }),
        new winston.transports.File({
            filename: logPath + 'airbnb-demand-script.log'
        })
    ]
});

// If we're not in production then also log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production-nologs') { //TODO revert
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
                message: obj ? `${msg} ${util.inspect(obj)}` : msg, 
                value: obj 
            });
        }
    }
}

let log = logFactory('info');
let error = logFactory('error');
let warn = logFactory('warn');

try {
    if (!fs.existsSync(logPath)) fs.mkdirSync(logPath);
}
catch (err) {
    console.log('logger error: could not create log directory.');
}

module.exports = {
    logger,
    log,
    error,
    warn
};