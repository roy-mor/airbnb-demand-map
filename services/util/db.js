import mongoose from 'mongoose';
import {mongodb} from 'c0nfig';
mongoose.Promise = require('bluebird');

let db = mongoose.connection;

mongoose.connect(mongodb.defaultDB.connection, {
    user: mongodb.user,
    pass: mongodb.pass
});

db.on('error', err => console.error(`Failed to connect to database server ${mongodb.defaultDB.connection}. 
This code uses a mongodb document store. It can be installed on localhost or remotely. See /config/*.config.js for db configuration.\n`, err));

db.on('connected', () => console.log(`Connected to ${mongodb.defaultDB.connection}.`));

