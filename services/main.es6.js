import 'babel-polyfill';
import _ from 'lodash';
import Promise from 'bluebird';
import request from 'request';
import { RateLimiter } from 'limiter';
import { logger, err, log, warn } from './util/logging';
import consts from './util/constants';
import db from './util/db';
import RawListing from '../models/RawListing';

const limiter = new RateLimiter(50, 'minute');

//let listingsArray = [];


async function getListings(opts, limit, listingsArray) {
    limit = limit || Number.MAX_SAFE_INTEGER;
    let resultsSize = 0;

    while (opts.priceMax <= consts.MAXIMUM_MAX_PRICE && resultsSize < limit) {
        opts.offset = 0;
        let url = buildSearchUrl(opts);
        log(`SIZE: ${resultsSize}  REQUESTS: ${listingsArray.length}  |  MIN PRICE = ${opts.priceMin}, MAX PRICE = ${opts.priceMax}, OFFSET = ${opts.offset}`);
		log(url);
        let response = await airbnbRequest(url);
        if (response && response.metadata && response.metadata.pagination) {
            listingsArray.push(response);
            resultsSize += response['search_results'].length;
            let pagination = response['metadata']['pagination'];
            while (pagination.result_count === opts.limit) { //there are more pages to this search
                let paginationResults = await doPaginate(url, opts, resultsSize, listingsArray);
                if (paginationResults) {
                    resultsSize = paginationResults.resultsSize;
                    pagination = paginationResults.lastPagination;
                }
                //else continue?
            }
        } else { // something is wrong - unexpected response
            err('Missing or unexpected response from airbnb: ', response);
        }

    opts.priceMin += consts.DEFAULT_PRICE_ADD;
    opts.priceMax += consts.DEFAULT_PRICE_ADD;
    console.log('\n');
    log('');
    } //end while
    log(`getListings(): dataset size: ${resultsSize}  number of pages in dataset: ${listingsArray.length}`);
}

async function doPaginate(url, opts, resultsSize, listingsArray) {
    opts.offset += opts.limit;
    url = buildSearchUrl(opts);
    log('Paginating....  ', url);
    let response = await airbnbRequest(url);
    if (response && response.metadata) {
        log('pages:', response.metadata.pagination);
        listingsArray.push(response);
        return {
            resultsSize: resultsSize += response['search_results'].length,
            lastPagination: response['metadata']['pagination']
        };
    } else {
        err('Encountered error while paginating: ', response);
    }

}

async function airbnbRequest(url, errors) {
    let errCount = errors || 0;
    return new Promise((resolve, reject) => {
        limiter.removeTokens(1, () => {
            request.get({
                url,
                json: true,
                headers: consts.DEFAULT_REQ_HEADER
            }, async (err, res, body) => {
                if (err || res.statusCode != 200) {
                    warn('airbnbRequest http request encountered error: ', err || res.statusCode.toString() + " | " + res.body['error']);
                    if (errCount < consts.HTTP_REQUEST_ERRORS_THRESHOLD) {
                        log(`airbnbRequest retrying, retry #${errCount+1}`);
                        if (res && res.statusCode == 503) { // most likely we are rejected by airbnb API due to rate/quota
                            await sleep(consts.DEFAULT_SLEEP_TIME_MS); //wait a little bit before next request, to avoid getting banned (blocking is OK here)
                        }
                        return resolve(airbnbRequest(url, errCount + 1));
                    } else {
                        err('airbnbRequest: maximum retries threshold reached without successful response. url:' + url)
                        return reject(err);
                    }
                }
                return resolve(body);
            });
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    });
}

function buildCalendarUrl(opts, urlStr) {
    let url = urlStr || consts.CALENDAR_URL;
    url = url.replace('{$CLIENT_ID}', opts.clientId)
    .replace('{$LISTING_ID}', opts.listingId)
    .replace('{$START_DATE}', opts.startDate)
    .replace('{$END_DATE}', opts.endDate);
    return url;
}

function buildSearchUrl(opts, urlStr) { //instead checkout SERIALIZE() 
    let url = urlStr || consts.SEARCH_URL;
    url = url.replace('{$CLIENT_ID}', opts.clientId)
    .replace('{$LOCATION}', opts.location)
    .replace('{$OFFSET}', opts.offset)
    .replace('{$LIMIT}', opts.limit)
    .replace('{$PRICE_MIN}', opts.priceMin)
    .replace('{$PRICE_MAX}', opts.priceMax);
    return url;
}

async function populateListings() {
	let opts = { 
        clientId: consts.CLIENT_ID,
        location: consts.DEFAULT_LOCATION,
        offset: 0,
        limit: consts.DEFAULT_LIMIT,
        priceMin: 0,
        priceMax: 5
    }
    let listings = [];
    await getListings(opts, 200, listings);
    console.log('listings size:' + listings.length);
    listings.forEach(async page => { 
    	page['search_results'].forEach(async listing => { 
    		await RawListing.create(listing);
    });
  });
}



try { 
 RawListing.create({});
 log('------- New Run ' + new Date());
 populateListings();
}
catch (err) {
	console.log(err);
}