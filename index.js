//import 'babel-polyfill';
import _ from 'lodash';
import { log, warn, error } from './services/util/logging';
//import consts from './util/constants';
import db from './services/util/db';
import mongoose from 'mongoose';

//import morgan from 'morgan'; //TODO LOGGGING!
import express from 'express';
const app = express();
let DemandModel;
app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

//MODIFY THIS EXAMPLE FUNCTION
app.get('/demand/:location', async function(request, response) {
  const locationStr = decodeURI(request.params.location).trim();
  if (!locationStr) {
    renderError();
    return;
  }
  console.log(locationStr);
  const demandCollection = 'Demand.' + _.chain(locationStr).trim().deburr().startCase();
  /*console.log(await getDemandCollections());  
  const name = await getCollectionName(demandCollection);
  console.log ('name = ' + name  +' ' + demandCollection);
  if (!name) {
    renderError();
    return;
  }*/
  let weightedLocations = await mongoose.connection.db.collection(demandCollection).find().toArray();
  console.log('size of weightedLocations ' + weightedLocations.length);
  const mapCenter = {
    lat: weightedLocations[0].lat,
    lng: weightedLocations[0].lng
  }; //TMP, CHANGE!

  //sanitize and filter relevant data
  weightedLocations = weightedLocations.reduce((filteredRecords, record) => {
    if (record.lat && record.lng && record.demand) { //filter
      filteredRecords.push({
        lat: record.lat, //map
        lng: record.lng,
        demand: record.demand
      });
    }
    return filteredRecords;
  }, []);

  //TODO BETTER to send relevant data only (JSON) rather than render entire page again...
  response.render('pages/index', {
    mapCenter,
    weightedLocations,
    locationStr,
    demandCollections: await getDemandCollections()
  });
});
//END EXAMPLE FUNCTION






app.get('/', async function(request, response) {

  console.log(await getDemandCollections());

  let weightedLocations = await mongoose.connection.db.collection('Demand.New York').find().toArray();
  console.log('size of weightedLocations ' + weightedLocations.length);
  //sanitize and filter relevant data
  weightedLocations = weightedLocations.reduce((filteredRecords, record) => {
    if (record.lat && record.lng && record.demand) { //filter
      filteredRecords.push({ //map
        lat: record.lat, 
        lng: record.lng,
        demand: record.demand
      });
    }
    return filteredRecords;
  }, []);


  console.log('size of filtered filtered locations ' + weightedLocations.length);

  const mapCenter = {
    lat: weightedLocations[0].lat,
    lng: weightedLocations[0].lng
  }; //TMP, CHANGE!
  const locationStr = 'Seattle';
  response.render('pages/index', {
    mapCenter,
    weightedLocations,
    locationStr,
    demandCollections: await getDemandCollections()
  });
});


// Google Maps API Key = AIzaSyBaRhsRQkhhxBNljnMeO3YDaLdc7xSkuAc


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

/***********************************************************************/

function renderError() {
  console.log('error'); //TODO RENDER ERROR PAGE INSTEAD
}
async function getDemandCollections() {
  const collectionNames = await mongoose.connection.db.listCollections().toArray();
  return collectionNames.filter(collection => {
    return _.startsWith(collection.name, 'Demand.');
  }).map(collection => {
    return {
      location: _.split(collection.name, '.')[1],
      collection: collection.name
    }
  });
}

/*async function getCollectionName(name) {
  const collections = await getDemandCollections();
     _.forEach(collections, c => {
      console.log (c.collection);
      console.log(name);
      if (c.collection =e== name) return c;
    });
    return null;
}*/
