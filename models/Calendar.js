import mongoose from 'mongoose';

let Calendar = new mongoose.Schema({
    listing_id: {
        type: Number,
        index: true
    },
    calendar_days: mongoose.Schema.Types.Mixed,
    occupancyScore: Number
}, {
    strict: false
}); // no need to indicate all specific fields

export default mongoose.model('Calendar', Calendar);
