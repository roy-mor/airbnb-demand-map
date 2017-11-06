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
import { getFinalDemandScoreForListing } from './util/metricsCalculator';

//there is a corellation between listings which are "always reserved" ("yearly occupied" score of 365/366)
//and such that have null star_ratings and 0 reviews. So we can weed them out by ignoring the null star
//ratings ones (check to see if they have reasonable occupancy)

//TODO CHECK AIRBNB JS STYLE GUIDE (AND OTHER STYLE GUIDES)
//TODO CHECK duplicates in calendar
//TODO use collection upsert instead of insert
//TODO replace let's with consts!

//https://stackoverflow.com/questions/25285232/bulk-upsert-in-mongodb-using-mongoose

//Logic: user provides location 
//getListings(location) is called
//getCalendar() is called on all listings (prevent duplicates; create unique index -- failed inserts?)
//collection DemandData.[location] (DemandData.London, DemandData.New_York) is created 
//by deleting existing collection (if exists), finding() all listings in rawListings with listing.city=location,
//then joining (aggregate framework?) on their calendar (via listing_id), calculating demand according to params
//and saving in DemandData.[location] which will have only lat/long and demandmetricValue

const limiter = new RateLimiter(50, 'minute');

//let listingsArray = [];

async function calculateDemand(location) {
	//TODO implement as aggregate query
	let filteredListings = await RawListing.find({'airbnb-demand-location': location, 
			'listing.star_rating': {$ne: null}});
	console.log(`filtered listings length: ${filteredListings.length}`);
	for (let listing of filteredListings) {
	//filteredListings.forEach(async listing => {
		let listingCalendar = await Calendar.findOne({listing_id: listing['listing']['id']});
		//console.log(listingCalendar.listing_id);
		//console.log(listing.listing['reviews_count']);
		//console.log(listing['reviews_count']);

		if (listingCalendar) {
		let demand = getFinalDemandScoreForListing(listing['listing']['star_rating'],
				listing['listing']['reviews_count'], listingCalendar['occupancyScore'],
			listing['pricing_quote']['nightly_price'],listing['listing']['primary_host']['is_superhost']
			,1, 30);
		};
	};
}

async function getCalendars(listingsArray, opts) {
	let calendarsArray = [];
	for (let listing of listingsArray) {
			let response;
			opts.listingId = listing['listing']['id'];
			let url = buildCalendarUrl(opts);
			log(`getting calendar for listing_id ${opts.listingId}\n`, url);
			console.log();
			try {
				response = await airbnbRequest(url);
			} catch (err) {
				error(`getCalendars encountered error, skipping calendar for listing id ${opts.listingId}`, err);
				continue;
			}
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

/*async function getCalendarsAsync(listingsArray, opts) {
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
*/

async function getListings(opts, limit, listingsArray) {
    limit = limit || Number.MAX_SAFE_INTEGER;
    let resultsSize = 0;

    while (opts.priceMax <= consts.MAXIMUM_MAX_PRICE && resultsSize < limit) {
        opts.offset = 0;
        let url = buildSearchUrl(opts);
        log(`SIZE: ${resultsSize}  REQUESTS: ${listingsArray.length}  |  MIN PRICE = ${opts.priceMin}, MAX PRICE = ${opts.priceMax}, OFFSET = ${opts.offset}`);
		log(url);
		try {
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
   		}
   		catch (err) {
   			error('Encountered error, skipping this url...', err);
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
                    warn('airbnbRequest http request encountered error: ', 
                    	err || res.statusCode.toString() + " | " + 
                    	[res.body['error'], res.body['error_message'], res.body['error_details']].filter(Boolean));
        
                    if (errCount < consts.HTTP_REQUEST_ERRORS_THRESHOLD) {
                        log(`airbnbRequest retrying, retry #${errCount+1}`);
                        if (res && res.statusCode == 503) { // most likely we are rejected by airbnb API due to rate/quota
                            await sleep(consts.DEFAULT_SLEEP_TIME_MS); //wait a little bit before next request, to avoid getting banned (blocking is OK here)
                        }
                        return resolve(airbnbRequest(url, errCount + 1));
                    } else {
                        error('airbnbRequest: maximum retries threshold reached without successful response. url:' + url)
                        return reject(err || [res.body['error'], res.body['error_message'], res.body['error_details']].filter(Boolean));
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

async function populateCalendars(location) {
	 let currentDate = new Date();
	 currentDate.setDate(currentDate.getDate() + 1);
	
	 // Airbnb allows accessing a listing's calender only up to 3 months ago:
	 // (We added one day to be on the safe side and account for time zone offsets and daylight savings)
	 let threeMonthsAgo = currentDate.setMonth(currentDate.getMonth() - 3); 
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
  	let listingsArr = await RawListing.find({'airbnb-demand-location': location}).limit(1000).lean(); 
     
	log('dbg listingsArr size:', listingsArr.length);    
	let calendarArr = await getCalendars(listingsArr, opts);
    log(`now saving calendar for ${location} to database... size = ${calendarArr.length}`); //try catch
    if (calendarArr.length > 0) { 
   		 await Calendar.collection.insert(calendarArr); //TODO bulk upsert for duplicates...
    }
    //console.dir(listingsArr);
}

async function populateListings(location, isToJSONOnly) { //TODO implement array to JSON
	let encodedLocation = location ? encodeURI(location) : consts.DEFAULT_LOCATION;
    let initialOpts = {
        clientId: consts.CLIENT_ID,
        location: encodedLocation,
        offset: 0,
        limit: consts.DEFAULT_LIMIT,
        priceMin: 0,
        priceMax: 5
    }
    let listings = [];
    await getListings(initialOpts, 500, listings);
    console.log('listings size:' + listings.length);
    log(`Now saving ${initialOpts.location} listings to database...`);
    try {
           listings.forEach(async page => {
            page['search_results'].forEach(async listing => {
            	listing['airbnb-demand-location'] = location; //tag listing with our own location metadata, since 'listing.city' may be different than 'location' 
                await new RawListing(listing).save();  //TODO upsert to prevent duplicates!
                //let lst = new RawListing(listing);
                //console.log(listing);
                //await lst.save();
            });
        });
        log('Done saving listings to database.');
        await sleep(1000); //work around race condition?
    } catch (err) {
        error('encountered error while saving listings to database: ', err)
    }
}


async function run() {
try { 
	
 log('------- New Run ' + new Date());
 //await populateListings('New York');
 //await populateCalendars('New York');
 await calculateDemand('New York');
}
catch (err) {
	console.log(err);
}
}

run();