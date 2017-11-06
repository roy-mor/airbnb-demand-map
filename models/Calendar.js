import mongoose from 'mongoose';

let Calendar = new mongoose.Schema({
    listing_id: {type: Number, index: true},
    calendar_days: [Object]
}); // no need to define specific fields

export default mongoose.model('Calendar', Calendar);
