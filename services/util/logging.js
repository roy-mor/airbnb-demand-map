import winston from 'winston';
import format from 'util';
import util from 'util';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
 /*  format: winston.format.combine(
    winston.format.splat(),
    winston.format.simple()
  ),*/
  transports: [
    //
    // - Write to all logs with level `info` and below to `application.log` 
    // - Write all logs error (and below) to `error.log`.
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'application.log' })
  ]
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
// 
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

function log(data, obj) {
	if (typeof obj === 'string' || obj instanceof String) {
		return logger.info(`${data} ${obj}`);
	} else {
		return logger.info(data, obj); //TODO MAKE FACTORY WITH CLOSURES
	}
}

function err(data, obj) {
	if (typeof obj === 'string' || obj instanceof String) {
		return logger.error(`${data} ${obj}`);
	} else {
		return logger.error(data, obj); //TODO MAKE FACTORY WITH CLOSURES
	}
}

function warn(data, obj) {
if (typeof obj === 'string' || obj instanceof String) {
		return logger.warn(`${data} ${obj}`);
	} else {
		return logger.warn(data, obj); //TODO MAKE FACTORY WITH CLOSURES
	}
}

module.exports = {logger, log, err, warn};
