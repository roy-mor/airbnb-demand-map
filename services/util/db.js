import mongoose from 'mongoose';
import {mongodb} from 'c0nfig';
//todo import logger?

let db = mongoose.connection;

mongoose.connect(mongodb.defaultDB.connection, {
    user: mongodb.user,
    pass: mongodb.pass
});

db.on('error', err => console.error(`Failed to connect to database server ${mongodb.connection}. This code uses a mongo database; 
it can be installed on localhost or remotely. See /config/*.config.js for db configuration.\n`, err));

    