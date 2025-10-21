const mongoose = require('mongoose');

const roomTypeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Globally unique name
    description: String,
    capacity: { type: Number, required: true },
    basePrice: { type: Number, required: true },
    numberOfBeds: { type: Number, required: true },
    amenities: [{ type: String }],
    isActive: { type: Boolean, default: true },
    maxCapacity: { type: Number, required: true }
}, { timestamps: true });

// Index for globally unique names
roomTypeSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('RoomType', roomTypeSchema);
