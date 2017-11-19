# airbnb-demand-map - Airbnb Demand Heatmap
## Show areas with the highest demand on Airbnb within given cities


### Demo 
A demo is available here: https://airbnb-demand.herokuapp.com/


### Installing
```
npm install
```

### Prerequisite before running
Make sure mongodb server (i.e., `mongod`) is running on localhost or remote before starting the script or the app.
Assumes localhost db (on development environment) has blank username/password. Otherwise:

Edit config file config/development.config.js to specify different mongodb server address, port or credentials. 
In production (`NODE_ENV='production'`), edit config/production.config.js. 


### Running 

First the migration script has to be executed to populate the database with demand data for at least one location. A JSON file will also be generated at the and of the run, in scripts/json folder (not used by the app).

### Executing migration script:
```
cd scripts
node get-airbnb-demand <location> [optional limit]
```

Example:
```
node get-airbnb-demand Paris
node get-airbnb-demand `New York` 4000
```

At the end of `get-airbnb-demand` script execution, the database `airbnb-demand` will be populated with a collection `Demand.<location>` (e.g., 'Demand.London') with the demand data for all listings found at the location. 

In addition, collections `rawlistings` and `calendars` will be added the listings and calendar data from that location. 

Run the script additional times with different locations to create demand data for more cities, which the app will then display.


### Running the web application locally
``npm run start
``

Then go to http://localhost:5000/ where a random city out of the available cities will be displayed. 
In the browser, click "Another Random City" to display the map of another location, if available. 

For a specific city, go to http://localhost:5000/demand/<location\>, e.g, `http://localhost:5000/demand/Dublin`, 
if a `Demand.Dublin` collection exists in the database.



### Demand metric logic
Please see design document.

### Files and folders
``
./index.js                          Entry point for Express web app
-- ./config/                        Configuration files (database credentials etc)
-- ./models/                        Models for database
-- ./public/                        Static www folder
-- ./scripts/                     
-- ./scripts/get-airbnb-demand.js   Entry point for data ingestion script
-- ./scripts/main.js                Main logic for data ingestion script
   		-- ./scripts/util/          Metrics calculator, consts, http, logging, db, etc
  		-- ./scripts/logs/          This is where data ingestion script logs are kept
  		-- ./scripts/json/          This is where resulting json files are kept
-- ./tests/		  					Unit tests
-- ./views/                         EJS files for Express
``


``
---> logs - wher elogs are kept, where json files are kept etc

### Environment

* Node.js v6.6.0
* Chrome v62.0.3202.94 


