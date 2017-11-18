import _ from 'lodash';
import { log, warn, error } from './services/util/logging';
import db from './services/util/db';
import mongoose from 'mongoose';
import express from 'express';
const app = express();
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message, 
            error: err
        });
     });
 }
 
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});

function showAirbnbDemand(request, response, next) {
    const weightedLocations = request.weightedLocations.reduce((filteredRecords, record) => {
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

app.get('/demand/:location', async function(request, response, next) {
    const locationStr = decodeURI(request.params.location).trim();
    const demandCollection = 'Demand.' + _.chain(locationStr).trim().deburr().startCase();
    let weightedLocations = await mongoose.connection.db.collection(demandCollection).find().toArray();
    if (!weightedLocations || weightedLocations.length === 0) {
        return next(`Location ${locationStr} (collection ${demandCollection}) does not exist in database. 
    Make sure to run 'get-airbnb-demand <location>' script on server first in order to generate heatmap!`);
    }
    request.locationStr = locationStr;
    request.weightedLocations = weightedLocations;
    showAirbnbDemand(request, response);
});


app.get('/', async function(request, response, next) {
    const demandCollections = await getDemandCollections();
    if (!demandCollections || demandCollections.length == 0) {
        return next('No demand maps exist on the server yet. Please run "get-airbnb-demand" script on the server first to generate at least one map.');
    }
    const randomIndex = Math.floor(Math.random() * 100) % demandCollections.length;
    const demandCollection = demandCollections[randomIndex];
    let weightedLocations = await mongoose.connection.db.collection(demandCollection.collection).find().toArray();
    if (!weightedLocations || weightedLocations.length === 0) return next(`The ${demandCollection.collection} is nonexistent or empty`);
    request.locationStr = demandCollection.location;
    request.weightedLocations = weightedLocations;
    showAirbnbDemand(request, response);
});


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