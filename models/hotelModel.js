const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    description: String,
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    status: { type: String, enum: ['available', 'full', 'closed'], default: 'available' },
    images: [String],        //Khong can bang hotelImage nua neu chi luu 5-10 img/hotel
    amenities: [{ type: String }]  // Array of amenities like ["Free Wi-Fi", "Swimming Pool", "Spa"]
}, { timestamps: true });

module.exports = mongoose.model('Hotel', hotelSchema);