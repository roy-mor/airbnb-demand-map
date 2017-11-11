const applicationConstants = {
	DEFAULT_SLEEP_TIME_MS: 1000 * 5,
	HTTP_REQUEST_ERRORS_THRESHOLD: 15,
	DEFAULT_REQ_HEADER: {'user-agent': 'request.js'}
};

const configurationConstants = {
			//TODO add currency USD!
			//TODO add AIRBNB_PREFIX and others
	 SEARCH_URL: 'https://api.airbnb.com/v2/search_results?client_id={$CLIENT_ID}&location={$LOCATION}&_offset={$OFFSET}&_limit={$LIMIT}&price_min={$PRICE_MIN}&price_max={$PRICE_MAX}',
	 CALENDAR_URL: 'https://www.airbnb.com/api/v2/calendar_days?key={$CLIENT_ID}&currency=USD&locale=en&listing_id={$LISTING_ID}&start_date={$START_DATE}&end_date={$END_DATE}&_format=with_conditions',
	 CLIENT_ID: 'd306zoyjsyarp7ifhu67rjxn52tv0t20', //'3092nxybyb0otqw18e8nh5nty';
	 DEFAULT_LOCATION: 'Jerusalem',
	 DEFAULT_LIMIT: 50,
	 MAXIMUM_MAX_PRICE: 5000, //$5000 per night is a reasonable price limit in most cities, for statistics purposes 
 	 MAXIMUM_LISTINGS_SEARCH_LIMIT: 10000, //10,000 listings is a reasonable cap that balances performance time and sample size for stats
	 //to document: started with DEFAULT_PRICE_ADD: 5, but some busy cities had more than 1000 in that $5 range,
	 //so change to 1, instead of implementing detection and fallback (more calls and a bit slower, but keeps it simple)
	 //theoretically there could be a price tag with more than 1000 listings, but for our stats
	 //1000 items is enought per price, so we can afford losing them.	
	 DEFAULT_PRICE_ADD: 1 

};


module.exports = Object.freeze(Object.assign(applicationConstants, configurationConstants));
