import mongoose from 'mongoose';
import {mongodb} from 'c0nfig';

let db = mongoose.connection;

mongoose.connect(mongodb.defaultDB.connection, {
    user: mongodb.user,
    pass: mongodb.pass
});
