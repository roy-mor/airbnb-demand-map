import mongoose from 'mongoose';

let RawListing = new mongoose.Schema({
    pricing_quote: {
        nightly_price: Number // TODO remove?
    },
    'airbnb-demand-location': {type: String, index: true},
    listing: { 
        id: {type: Number, index: true },
        star_rating: Number,
        reviews_count: Number,
        nightly_price: Number,
        primary_host: {
            is_superhost: Boolean,
        }
    }
}, {strict: false}); // no need to define specific fields

export default mongoose.model('RawListing', RawListing);
