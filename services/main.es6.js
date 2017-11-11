import 'babel-polyfill';
import _ from 'lodash';
import Promise from 'bluebird';
import request from 'request';
import dateFormat from 'dateformat';
import { RateLimiter } from 'limiter';
import { log, warn, error } from './util/logging';
import consts from './util/constants';
import db from './util/db';
import mongoose from 'mongoose';
import RawListing from '../models/RawListing';
import Calendar from '../models/Calendar';
//import {createDemandCollectionModel} from '../models/genericDemand';
import { getFinalDemandScoreForListing } from './util/metricsCalculator';

//https://www.reddit.com/r/javascript/comments/55zuq6/should_i_use_a_template_engine_or_a_js_framework/
//https://www.reddit.com/r/javascript/comments/670la3/when_to_use_a_templating_language_ejs_pug/


//there is a corellation between listings which are "always reserved" ("yearly occupied" score of 365/366)
//and such that have null star_ratings and 0 reviews. So we can weed them out by ignoring the null star
//ratings ones (check to see if they have reasonable occupancy)

//TODO CHECK AIRBNB JS STYLE GUIDE (AND OTHER STYLE GUIDES) let => consts
//TODO CHECK duplicates in calendar
//TODO use collection upsert instead of insert
//TODO replace let's with consts!
//TODO add command line invoker for script
//TODO choose sane limit consts to balance runtime 
//TODO add mocha tests

//style:
//https://github.com/airbnb/javascript#destructuring
//https://github.com/airbnb/javascript#functions 7.7

//"was tested on chrome" (client side has async/await etc)

//https://stackoverflow.com/questions/25285232/bulk-upsert-in-mongodb-using-mongoose

//usage: node getdemand <location> [--limit: limit] [--json]


const limiter = new RateLimiter(60, 'minute');

async function calculateDemand(location) {
	log(`Calculating demand for location ${location}...`);
	let listingData;
	const pipeline = [
		// location + listing quality filter
		{ $match: { 'airbnb-demand-location': location,
		//TODO CHANGE THIS MORE ACCURATELY!!
		'listing.star_rating': {$ne: null}} //filter out listings with no reviews and no stars
		//TODO FINALIZE CORRECT FILTER
		//(listings with no reviews are not used and might have calendar 366 blocking mistakes ),
		 },
		{$lookup: { //JOIN rawlistings and calendars based on airbnb listing_id
		    from: 'calendars',
		    localField: 'listing.id',
		    foreignField: 'listing_id',
		    as: 'calendar'
		}
		},
		{$unwind: '$calendar'},
	];

	try {
        listingData = await RawListing.aggregate(pipeline).exec();
    } catch (err) {
        error('calculateDemand: error executing aggregate query', err); //TODO improve msg
        return false; //?
    }
    log(`read ${listingData.length} listing records for ${location}.`);
    //TODO check length > 0 and throw error

    const minNightlyPrice = (_.minBy(listingData, o => o.pricing_quote.nightly_price)).pricing_quote.nightly_price;
    const maxNightlyPrice = (_.maxBy(listingData, o => o.pricing_quote.nightly_price)).pricing_quote.nightly_price;
    log(`Price stats for location ${location}: minimum nightly price = ${minNightlyPrice}, maximum nightly price = ${maxNightlyPrice}`);
    
    const demandArr = listingData.map(data => {
    	const demand = getFinalDemandScoreForListing(
    		data.listing.star_rating,
    		data.listing.reviews_count,
    		data.calendar.occupancyScore,
    		data.pricing_quote.nightly_price,
    		data.listing.primary_host.is_superhost,
    		minNightlyPrice,
    		maxNightlyPrice
    		);
    	return {
    		listingId: data.listing.id,
    		lat: data.listing.lat,
    		lng: data.listing.lng,
    		demand 
    	}
    });
    console.log('demand array size: ' + demandArr.length);

    const formattedLocationStr = _.chain(location).trim().deburr().startCase().replace('/[\. ]+/g','_'); //CHECK
    const DemandModel = createDemandCollectionModel(formattedLocationStr); //e.g. "Demand.New_York", "Demand.Koln" 
    try {
    	await DemandModel.remove({}); //clear the collection if exists, so we have only fresh unique results
    	await DemandModel.collection.insert(demandArr);
		await DemandModel.collection.insert({metadata: { createdAt: new Date() } });
    }
    catch (err) {
    	error(`encountered error trying to populate the demand collection ${formattedLocationStr} for location ${location}!`, err);
    	return false;
    }
    log(`Done saving demand for ${location} in ${formattedLocationStr} collection.`);
    return true;
}

async function getCalendars(listingsArray, opts) {
	let calendarSaveCounter = 0;
	for (let listing of listingsArray) {
			let response;
			opts.listingId = listing['listing']['id'];
			let url = buildCalendarUrl(opts);
			log(`getting calendar for listing_id ${opts.listingId}\n`, url + '\n');
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
			try {
				await Calendar.findOneAndUpdate({listing_id: opts.listingId}, response, {upsert: true}); //avoids creating duplicates
				calendarSaveCounter++;
			} catch (err) {
				error(`getCalendars encountered error while saving calendar for listing_id ${opts.listindId} to database.`, err);
			}
		};
	log(`total calendar data set size: ${calendarSaveCounter}`);
	return calendarSaveCounter;	
}


async function getListings(opts, listingsArray, limit) {
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


function createDemandCollectionModel(collectionName) {
	const Demand = new mongoose.Schema({
		listingId: {type: Number, index: true},
		lat: Number,
		lng: Number,
		demand: Number
	}, {strict: false}); 

	return mongoose.model('Demand', Demand, 'Demand'+'.'+collectionName);
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
	 // (We added one day extra to account for time zone offsets and daylight savings)
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
  	let listingsArr = await RawListing.find({'airbnb-demand-location': location}).lean(); 
     
	log('dbg listingsArr size:', listingsArr.length);    
	const calendarsSize = await getCalendars(listingsArr, opts);
    log(`${calendarsSize} listing calendards for ${location} were saved to database.`);
}

async function populateListings(location, limit, isToJSONOnly) { //TODO implement array to JSON
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
    await getListings(initialOpts, listings, limit);
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
 error('----- New Run ' + new Date());

 await populateListings('new york', 100);
 await populateCalendars('new york');
 await calculateDemand('new york');

 //await calculateDemand('Seattle');

 console.log('DONE!');
}
catch (err) {
	console.log(err);
}
}

run();