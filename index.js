import _ from 'lodash';
import db from './scripts/util/db';
import mongoose from 'mongoose';
import express from 'express';
const app = express();
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.listen(app.get('port'), () => {
    console.log('get-airbnb-demand app is running on port', app.get('port'));
});


app.get('/demand/:location', async function(request, response, next) {
    request.locationStr = decodeURI(request.params.location).trim();
    request.demandCollection = 'Demand.' + _.chain(request.locationStr).trim().deburr().startCase();
    await showAirbnbDemand(request, response, next);
});


app.get('/', async function(request, response, next) {
    const demandCollections = await getDemandCollections();
    if (!demandCollections || demandCollections.length === 0) {
        return next('No demand maps exist on the server yet. Please run "get-airbnb-demand" script on the server first to generate at least one map.');
    }
    const randomIndex = Math.floor(Math.random() * 100) % demandCollections.length;
    request.demandCollection = demandCollections[randomIndex].collection;
    request.locationStr = demandCollections[randomIndex].location;
    await showAirbnbDemand(request, response, next);
});


async function showAirbnbDemand(request, response, next) {
    let weightedLocations = await mongoose.connection.db.collection(request.demandCollection).find().toArray();
    if (!weightedLocations || weightedLocations.length === 0) {
        return next(`Location ${request.locationStr} (collection ${request.demandCollection}) does not exist in database. 
    Make sure to run 'get-airbnb-demand <location>' script on server first in order to generate heatmap!`);
    } 
    weightedLocations = weightedLocations.reduce((filteredRecords, record) => {
        if (record.lat && record.lng && record.demand) {  
            filteredRecords.push({lat: record.lat, lng: record.lng, demand: record.demand});  
        }
        return filteredRecords;
    }, []); 

    response.render('pages/index', {
        weightedLocations,
        locationStr: request.locationStr
    });
}


async function getDemandCollections() {
    const collectionNames = await mongoose.connection.db.listCollections().toArray();
    return collectionNames.filter(collection => {
        return _.startsWith(collection.name, 'Demand.');
    }).map(collection => {
        return {
            location: _.split(collection.name, '.')[1],
            collection: collection.name
        };
    });
}
 