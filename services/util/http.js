import Promise from 'bluebird';
import request from 'request';
import {
    RateLimiter
} from 'limiter';
import {
    log,
    warn,
    error
} from './logging';
import consts from './constants';
const limiter = new RateLimiter(60, 'minute');


/* Make HTTP request with rate limiter and retries; handles expected errors */
async function httpRequest(url, errCount = 0) {
    return new Promise((resolve, reject) => {
        limiter.removeTokens(1, () => {
            request.get({
                url,
                json: true,
                headers: consts.DEFAULT_REQ_HEADER
            }, async(err, res, body) => {
                try {
                    if (err || res.statusCode != 200) {
                        const errdata = [res.body['error'], res.body['error_message'], res.body['error_details']].filter(Boolean);
                        warn('httpRequest http request encountered error: ', err || res.statusCode.toString() + " | " + errdata);

                        if (errCount < consts.HTTP_REQUEST_ERRORS_THRESHOLD) {
                            log(`httpRequest retrying, retry #${errCount+1}`);
                            if (res && res.statusCode == 503) { // most likely we are rejected due to rate/quota limit
                                await sleep(consts.DEFAULT_SLEEP_TIME_MS); //wait a little bit before retrying, to avoid getting banned (blocking is OK here)
                            }
                            return resolve(httpRequest(url, errCount + 1));
                        } else {
                            error('httpRequest: maximum retries threshold reached without successful response. url:' + url)
                            return reject(err || errdata);
                        }
                    }
                    return resolve(body);
                } catch (err) {
                    error(err);
                    return reject(err);
                }
            });
        });
    });

}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    });
}

module.exports = {
    httpRequest,
    sleep
};