import mongoose from 'mongoose';

let RawListing = new mongoose.Schema({
    listing: { 
        id: {type: Number, index: true },
        city: {type: String, index: true}
    }
}); // no need to define specific fields

export default mongoose.model('RawListing', RawListing);
