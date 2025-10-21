const mongoose = require('mongoose');

const roomTypeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    capacity: { type: Number, required: true },
    basePrice: { type: Number, required: true },
    numberOfBeds: { type: Number, required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    amenities: [{ type: String }],
    isActive: { type: Boolean, default: true },
    maxCapacity: { type: Number, required: true }
}, { timestamps: true });

// Index for hotel-based queries
roomTypeSchema.index({ hotel: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('RoomType', roomTypeSchema);