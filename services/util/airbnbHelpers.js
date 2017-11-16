import consts from './constants';

function buildCalendarUrl({clientId, listingId, startDate, endDate}) {
    let url = consts.CALENDAR_URL;
    url = url.replace('{$CLIENT_ID}', clientId)
        .replace('{$LISTING_ID}', listingId)
        .replace('{$START_DATE}', startDate)
        .replace('{$END_DATE}', endDate);
    return url;
}

function buildSearchUrl({clientId, location, offset, limit, priceMin, priceMax}) {  
    let url = consts.SEARCH_URL;
    url = url.replace('{$CLIENT_ID}', clientId)
        .replace('{$LOCATION}', location)
        .replace('{$OFFSET}', offset)
        .replace('{$LIMIT}', limit)
        .replace('{$PRICE_MIN}', priceMin)
        .replace('{$PRICE_MAX}', priceMax);
    return url;
}


/*function createDemandPipeline(location) {
    const pipeline = [{
            $match: {
                'airbnb-demand-location': location,
            }
        },
        {
            $lookup: { //JOIN rawlistings and calendars based on airbnb listing_id
                from: 'calendars',
                localField: 'listing.id',
                foreignField: 'listing_id',
                as: 'calendar'
            }
        },
        {
            $unwind: '$calendar'
        },
        {
            $match: {
                // filter out all listings which are "always occupied" the entire year but have no star rating;
                // in that case they are just inactive dummy listings blocked for the year, not real active listings,
                // and are contaminating our stats
                $or: [{'calendar.occupancyScore': { $ne: consts.FULL_CALENDAR_DAYS }},
                     { 'listing.star_rating': { $ne: null } } ]
            }
        }
    ];
    return pipeline;
}
*/
module.exports = { buildSearchUrl, buildCalendarUrl };