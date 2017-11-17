import _ from 'lodash';
import fs from 'fs';
import dateFormat from 'dateformat';
import { log, warn, error } from './util/logging';
import { httpRequest, sleep } from './util/http';
import consts from './util/constants';
import db from './util/db';
import mongoose from 'mongoose';
import RawListing from '../models/RawListing';
import Calendar from '../models/Calendar';
import { buildSearchUrl, buildCalendarUrl } from './util/airbnbHelpers';
import { getFinalDemandScoreForListing } from './util/metricsCalculator';

//TODO linter 
//TODO logs and json in separate folders -- absoulate paths!
//TODO logs should be saved to absoulte paths...
//TODO package.json shrinkwrap


/* Gets all calendars for this location between start and end date and save to calendars collection.*/ 
async function populateCalendars(location) {
    log(`--- Populating calendars for location ${location} on airbnb --- `);
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + 1);

    // Airbnb allows accessing a listing's calender only up to 3 months ago:
    // (I added one day extra to account for time zone offsets and daylight savings)
    const threeMonthsAgo = currentDate.setMonth(currentDate.getMonth() - 3);
    const threeMonthsAgoDateObj = new Date(threeMonthsAgo);
    const threeMonthsAgoFormatted = dateFormat(threeMonthsAgo, "yyyy-m-d");
    const threeMonthsAgoPlusYearFormatted = dateFormat(threeMonthsAgoDateObj.setFullYear(threeMonthsAgoDateObj.getFullYear() + 1), "yyyy-m-d");

    const opts = {
        clientId: consts.CLIENT_ID,
        startDate: threeMonthsAgoFormatted,
        endDate: threeMonthsAgoPlusYearFormatted
    }
    try {
        const listingsArr = await RawListing.find({'airbnb-demand-location': location}).lean(); 
        const calendarsSize = await getCalendars(listingsArr, opts, location);
        log(`${calendarsSize} listing calendards for ${location} were saved to database.`);
    }
    catch (err) {
        error('encountered error populating calendars', err);
    }
}


/* Get all listing pages for location up to limit and save to rawlistings collection.*/
async function populateListings(location, limit) { 
    const encodedLocation = location ? encodeURI(location) : consts.DEFAULT_LOCATION;
    const initialOpts = {
        clientId: consts.CLIENT_ID,
        location: encodedLocation,
        offset: 0,
        limit: consts.DEFAULT_LIMIT,
        priceMin: 0,
        priceMax: 5
    }
    log(`--- Populating listings for location ${location} on airbnb --- `);
    let listings = [];
    await getListings(initialOpts, listings, limit);
    log(`Now saving ${location} listings to database...`);
    try {
        const listingsBulk = RawListing.collection.initializeUnorderedBulkOp();
        listings.forEach(async page => {
            await Promise.all(page['search_results'].map(async record => {
                record['airbnb-demand-location'] = location; // tag listing record with our own location metadata
                await listingsBulk.find({'listing.id': record.listing.id}) // updates latest data and prevents duplicates 
                .upsert()
                .updateOne(record); 
            }));
        });
        await listingsBulk.execute(); 
        log('Done saving listings to database.');
        await sleep(1000); 
    } catch (err) {
        error('encountered error while saving listings to database: ', err)
    }
}


/* Calculates demand based on listings and calendar aggregate, and save to Demand.location collection. */
async function calculateDemand(location) {
    log(`Calculating demand for location ${location}...`);
    const formattedLocationStr = _.chain(location).trim().deburr().startCase();
    const DemandModel = createDemandCollectionModel(formattedLocationStr); //e.g. "Demand.New_York", "Demand.Koln" 
    try {
        await DemandModel.remove({}); //clear the collection if exists, so we have only fresh unique results
        await DemandModel.collection.insert({metadata: { createdAt: new Date() }});
        let progressCounter = 0;

        log(`Reading rawlistings for ${location} from db...`);
        const listings = await RawListing.find({'airbnb-demand-location': location}).lean(); //consider join with aggregate framework instead...
        log(`Read ${listings.length} listings. Now joining calendars and listings to determine demand....`);
        const minNightlyPrice = (_.minBy(listings, o => o.pricing_quote.nightly_price)).pricing_quote.nightly_price;
        const maxNightlyPrice = (_.maxBy(listings, o => o.pricing_quote.nightly_price)).pricing_quote.nightly_price;
        log(`Price stats for location ${location}: minimum nightly price = ${minNightlyPrice}, maximum nightly price = ${maxNightlyPrice}`);

        for (let record of listings) {
            const calendar = await Calendar.findOne({'listing_id': record.listing.id}).lean();
            // filter out all listings which are "always occupied" the entire year but have no star rating (inactive dummy listings)
            if (calendar && (calendar.occupancyScore !== consts.FULL_CALENDAR_DAYS || record.listing.star_rating) !== null) {
                const data = Object.assign({calendar}, record);
                const demand = getFinalDemandScoreForListing({
                    starRating: data.listing.star_rating,
                    reviewsCount: data.listing.reviews_count,
                    occupancyScore: data.calendar.occupancyScore,
                    avgNightlyPrice: data.pricing_quote.nightly_price,
                    isSuperHost: data.listing.primary_host.is_superhost,
                    minLocationPrice: minNightlyPrice,
                    maxLocationPrice: maxNightlyPrice
                });

                await DemandModel.collection.insert({ 
                    listingId: data.listing.id,
                    lat: data.listing.lat,
                    lng: data.listing.lng,
                    demand
                });
            }

            progressCounter++;
            if (progressCounter % 100 === 0) {
                log(`Processed entry ${progressCounter} out of ${listings.length}...`);
            }
        }
    } catch (err) {
        error('calculateDemand: encountered error while calculating demand', err);
        return null;
    }
    return DemandModel.find({}).lean();
}


/* Iterate over listings and for each one get the calendar. Save to calendars collection. */
async function getCalendars(listingsArray, opts) {
    let calendarSaveCounter = 0;
    for (let listing of listingsArray) {
        let response;
        opts.listingId = listing['listing']['id'];
        let url = buildCalendarUrl(opts);
        log(`getting calendar for listing_id ${opts.listingId}\n`, url + '\n');
        try {
            response = await httpRequest(url);
        } catch (err) {
            error(`getCalendars encountered error, skipping calendar for listing id ${opts.listingId}`, err);
            continue;
        }
        response['listing_id'] = listing['listing']['id']; // augment the calendar object with the listingId
        
        let occupancyScore = _.sumBy(response.calendar_days, o => { //count number of unavailable days overall
            if (o.available) { return 0; } 
            else { return 1; }
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

/* Queries airbnb API for all listings at location, up to optional limit and predefined maximum max price*/
async function getListings(opts, listingsArray, limit = consts.MAXIMUM_LISTINGS_SEARCH_LIMIT) {
    let resultsSize = 0;
    while (opts.priceMax <= consts.MAXIMUM_MAX_PRICE && resultsSize < limit) {
        opts.offset = 0; //reset pagination offset
        let url = buildSearchUrl(opts);
        log(`DATASET SIZE: ${resultsSize}, REQUESTS: ${listingsArray.length}  |  MIN PRICE = ${opts.priceMin}, MAX PRICE = ${opts.priceMax}, OFFSET = ${opts.offset}`);
        log(url);
        try {
            const response = await httpRequest(url);
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
                } // inner while
            } else { // something is wrong - unexpected response
                error('Missing or unexpected response from airbnb: ', response);
            }
        } catch (err) {
            error('Encountered error, skipping this url...', err);
        }
        opts.priceMin = opts.priceMax + 1;
        opts.priceMax += consts.DEFAULT_PRICE_STEP;
        log('');
    } //end outer while
    log(`getListings(): dataset size: ${resultsSize}  number of pages in dataset: ${listingsArray.length}`);
}

/* Paginate once based on current offset */ 
async function doPaginate(url, opts, resultsSize, listingsArray) {
    opts.offset += opts.limit;
    url = buildSearchUrl(opts);
    log('Paginating....  ', url);
    const response = await httpRequest(url);    
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


/* Create demand collection, e.g., "Demand.Chicago" for Chicago */
function createDemandCollectionModel(collectionName) {
    const Demand = new mongoose.Schema({
        listingId: { type: Number, index: true },
        lat: Number,
        lng: Number,
        demand: Number
    }, { strict: false });

    return mongoose.model('Demand', Demand, 'Demand' + '.' + collectionName);
}



async function run(location, limit) {
    try {
        log('-------- (get-airbnb-demand): ------- New Run ' + new Date());
        await populateListings(location, limit); 
        await populateCalendars(location);
        const demandArr = await calculateDemand(location);

        if (demandArr) {
            const jsonFilename = 'Demand.' + _.chain(location).trim().startCase() + '.json';
            log(`Writing demand to JSON file ${jsonFilename}...`);
            try {
                fs.writeFile(jsonFilename, JSON.stringify(demandArr.map(r => {
                    delete r['_id'];
                    return r;
                })), 'utf-8');
            } catch (err) {
                error(`encountered error trying to save JSON file ${jsonFilename} for demand in ${location}`, err);
            }
        }
        mongoose.connection.close();
        log('DONE!');
    } catch (err) {
        error(err);
    }
}

module.exports = { run };
