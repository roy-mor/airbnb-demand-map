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

module.exports = { buildSearchUrl, buildCalendarUrl };
