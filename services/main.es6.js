import 'babel-polyfill';
import _ from 'lodash';
import Promise from 'bluebird';
import request from 'request';
import dateFormat from 'dateformat';
import { RateLimiter } from 'limiter';
import { log, warn, error } from './util/logging';
import consts from './util/constants';
import db from './util/db';
import RawListing from '../models/RawListing';
import Calendar from '../models/Calendar';

//there is a corellation between listings which are "always reserved" ("yearly occupied" score of 365/366)
//and such that have null star_ratings and 0 reviews. So we can weed them out by ignoring the null star
//ratings ones (check to see if they have reasonable occupancy)

//TODO CHECK AIRBNB JS STYLE GUIDE (AND OTHER STYLE GUIDES)
const limiter = new RateLimiter(50, 'minute');

//let listingsArray = [];

async function getCalendars(listingsArray, opts) {
	let calendarsArray = [];
	for (let listing of listingsArray) {
			opts.listingId = listing['listing']['id'];
			let url = buildCalendarUrl(opts);
			log(`getting calendar for listing_id ${opts.listingId}\n`, url);
			console.log();
			let response = await airbnbRequest(url);
			response['listing_id'] = listing['listing']['id']; // augment the calendar object with the listingId
			 let occupancyScore = _.sumBy(response.calendar_days, o => { //consider reduce() instead
                if (o.available)
                 {
                    return 0; //TODO CHECK LOGIC
                }
                else {return 1;}
            });
			response['occupancyScore'] = occupancyScore;
			calendarsArray.push(response);
		};
	log(`total calendar data set size: ${calendarsArray.length}`);
	return calendarsArray;	
}

async function getCalendarsAsync(listingsArray, opts) {
	let calendarsArray = await Promise.all(listingsArray.map(async listing => {
			opts.listingId = listing['listing']['id'];
			let url = buildCalendarUrl(opts);
			log(`getting calendar for listing_id ${opts.listingId}\n`, url);
			console.log();
			let response = await airbnbRequest(url);
			response['listing_id'] = listing['listing']['id']; // augment the calendar object with the listingId
			 let occupancyScore = _.sumBy(response.calendar_days, o => { //consider reduce() instead
                if (o.available)
                 {
                    return 0; //TODO CHECK LOGIC
                }
                else {return 1;}
            });
			response['occupancyScore'] = occupancyScore;
			return response;
	}));
	log(`total calendar data set size: ${calendarsArray.length}`);
	//console.dir(calendarsArray);
	return calendarsArray;	
}

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
            error('Missing or unexpected response from airbnb: ', response);
        }

    opts.priceMin = opts.priceMax + 1;
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
        error('Encountered error while paginating: ', response);
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
                        error('airbnbRequest: maximum retries threshold reached without successful response. url:' + url)
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

async function populateCalendars(listingsArr) {
	 let now = new Date();
	 //TODO CHECK THIS LOGIC...
	 let threeMonthsAgo = now.setMonth(now.getMonth() - 3); // Airbnb allows accessing a listing's calender only up to 3 months ago 
	 let threeMonthsAgoDateObj = new Date(threeMonthsAgo);
	 let threeMonthsAgoFormatted = dateFormat(threeMonthsAgo, "yyyy-m-d");	
	 let threeMonthsAgoPlusYear = threeMonthsAgoDateObj.setFullYear(threeMonthsAgoDateObj.getFullYear() + 1);
	 let threeMonthsAgoPlusYearFormatted = dateFormat(threeMonthsAgoPlusYear, "yyyy-m-d");	

	 let opts = { 
        clientId: consts.CLIENT_ID,
        startDate: threeMonthsAgoFormatted,  
        endDate: threeMonthsAgoPlusYearFormatted
    }
    console.dir(opts);
	listingsArr = listingsArr || await RawListing.find().limit(30).lean();     
	let calendarArr = await getCalendars(listingsArr, opts);
    log('now saving calendar to database... size = ' + calendarArr.length); //try catch
    await Calendar.collection.insert(calendarArr);
    //console.dir(listingsArr);
}

async function populateListings(location, isToJSONOnly) { //TODO implement array to JSON
    let initialOpts = {
        clientId: consts.CLIENT_ID,
        location: location || consts.DEFAULT_LOCATION,
        offset: 0,
        limit: consts.DEFAULT_LIMIT,
        priceMin: 0,
        priceMax: 5
    }
    let listings = [];
    await getListings(initialOpts, 1000, listings);
    console.log('listings size:' + listings.length);
    log('Now saving ${initialOpts.location} listings to database...');
    try {
        listings.forEach(async page => {
            page['search_results'].forEach(async listing => {
                await new RawListing(listing).save();  
                //let lst = new RawListing(listing);
                //console.log(listing);
                //await lst.save();
            });
        });
        log('Done saving listings to database.');

    } catch (err) {
        error('encountered error while saving listings to database: ', err)
    }
}


async function run() {
try { 
	
 log('------- New Run ' + new Date());
 //await populateListings();
 return await populateCalendars();
}
catch (err) {
	console.log(err);
}
}

run();