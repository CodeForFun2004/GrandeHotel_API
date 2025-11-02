const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    roomNumber: { type: String, required: true },
    status: { type: String, enum: ['Reserved', 'Available', 'Maintenance','Cleaning','Occupied'], default: 'Available' },
    description: String,
    pricePerNight: { type: Number, required: true },
    images: [String],
    code: { type: String, required: true } // Unique code for room
}, { timestamps: true });

// Index for hotel-based queries and unique code per hotel
roomSchema.index({ hotel: 1, code: 1 }, { unique: true });
roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);