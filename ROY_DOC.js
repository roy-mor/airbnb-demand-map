//to document: started with DEFAULT_PRICE_ADD: 5, but some busy cities had more than 1000 in that $5 range,
	 //so change to 1, instead of implementing detection and fallback (more calls and a bit slower, but keeps it simple)
	 //theoretically there could be a price tag with more than 1000 listings, but for our stats
	 //1000 items is enought per price, so we can afford losing them.	


	    //
    // - Write to all logs with level `info` and below to `application.log` 
    // - Write all logs error (and below) to `error.log`.
    //

To make it more fun for me and production like, I decided to use a database. (Collecte ddata can be used for other tasks, as well
	as easier to cross query joined collections etc). Arepository of airbnb data.
Some insights could only be inferred by joining data (for example 366 and no stars), and this is easiest with a document store or 
database


Why bulk upsert?  // update latest listing data and prevents duplicates in case of multiple runs on same location:
I assume in production the database is being updated periodically by this script (airbnb feed),
so need to avoid dupes and update exising listings


    Could have used an inmemory hash map
    (listingHash)

instead of pushing to an array like this below, save ALL relevant date to my database, 
could be useful for other tasks. 

---
a entire year was chosen to give a complete occupancy image (some listings are booked months in advance)
---
API Challenges:
1. airbnb allows up to 1000 listings only -> query on price points to cover all listings (some cities have price points with over >1000)
2. airbnb 503 limit and quota: use rate limiter, retries and sleep on 503
3. pagination for requests that have more data than usual
---


// Make API call to get listings page.
function getListingsPage(location, propertyType, limit, offset) {
  let options = Object.assign({}, requestOptions); // Clone object.
  options.qs.location = location;
  options.qs.property_type = propertyType;
  options.qs._limit = limit;
  options.qs._offset = offset; // Set the new offset.

  return request(`${AIRBNB_API_BASE_URL}/search_results`, options)
  .then(function (results) {
      let page = { listings: [], pagination: results.metadata.pagination };
      results.search_results.map(item => {
        page.listings.push({
          listingId: item.listing.id,
          latitude: item.listing.lat,
          longitude: item.listing.lng,
          rating: item.listing.star_rating || 0
        });
      });
      return page;
  })
	 ALT_CLIENT_ID: '3092nxybyb0otqw18e8nh5nty',

//

//TODO CHECK AIRBNB JS STYLE GUIDE (AND OTHER STYLE GUIDES) let => consts
//TODO replace let's with consts!
//TODO add mocha tests

//style:
//https://github.com/airbnb/javascript#destructuring
//https://github.com/airbnb/javascript#functions 7.7

//"was tested on chrome" (client side has async/await etc)

//usage: node getdemand <location> [--limit: limit] [--json]
