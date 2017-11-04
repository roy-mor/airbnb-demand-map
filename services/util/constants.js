const applicationConstants = {
	DEFAULT_SLEEP_TIME_MS: 1000 * 5,
	HTTP_REQUEST_ERRORS_THRESHOLD: 15,
	DEFAULT_REQ_HEADER: {'user-agent': 'request.js'}
};

const configurationConstants = {
	 SEARCH_URL: 'https://api.airbnb.com/v2/search_results?client_id={$CLIENT_ID}&location={$LOCATION}&_offset={$OFFSET}&_limit={$LIMIT}&price_min={$PRICE_MIN}&price_max={$PRICE_MAX}',
	 CALENDAR_URL: 'https://www.airbnb.com/api/v2/calendar_days?key={$CLIENT_ID}&currency=USD&locale=en&listing_id={$LISTING_ID}&start_date={$START_DATE}&end_date={$END_DATE}&_format=with_conditions',
	 CLIENT_ID: 'd306zoyjsyarp7ifhu67rjxn52tv0t20', //'3092nxybyb0otqw18e8nh5nty';
	 DEFAULT_LOCATION: 'Jerusalem',
	 DEFAULT_LIMIT: 50,
	 MAXIMUM_MAX_PRICE: 10000,
	 DEFAULT_PRICE_ADD: 5
};


module.exports = Object.freeze(Object.assign(applicationConstants, configurationConstants));
