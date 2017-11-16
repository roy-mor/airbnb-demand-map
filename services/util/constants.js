const AIRBNB_PREFIX = 'https://api.airbnb.com';

const applicationConstants = {
	DEFAULT_SLEEP_TIME_MS: 1000 * 5,
	HTTP_REQUEST_ERRORS_THRESHOLD: 15,
	DEFAULT_REQ_HEADER: {'user-agent': 'request.js'}
};

const configurationConstants = {
	SEARCH_URL: AIRBNB_PREFIX + '/v2/search_results?client_id={$CLIENT_ID}&location={$LOCATION}&_offset={$OFFSET}&_limit={$LIMIT}&price_min={$PRICE_MIN}&price_max={$PRICE_MAX}&currency=USD',
	CALENDAR_URL: AIRBNB_PREFIX + '/v2/calendar_days?key={$CLIENT_ID}&currency=USD&locale=en&listing_id={$LISTING_ID}&start_date={$START_DATE}&end_date={$END_DATE}&_format=with_conditions',	 CLIENT_ID: 'd306zoyjsyarp7ifhu67rjxn52tv0t20', //normally this should be kept in a .gitignored file or loaded with from process.env via dotenv 
	DEFAULT_LOCATION: 'Jerusalem',
	DEFAULT_LIMIT: 50,
	MAXIMUM_MAX_PRICE: 1000, //a reasonable upper limit for stats purposes for nightly price in most cities
	MAXIMUM_LISTINGS_SEARCH_LIMIT: 15000, //a reasonable cap that balances execution time and sample size for stats
	DEFAULT_PRICE_STEP: 1,
	FULL_CALENDAR_DAYS: 366
};


module.exports = Object.freeze(Object.assign(applicationConstants, configurationConstants));
