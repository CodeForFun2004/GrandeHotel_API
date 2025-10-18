const mongoose = require('mongoose');

const roomTypeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    capacity: { type: Number, required: true },
    basePrice: { type: Number, required: true },
    numberOfBeds: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('RoomType', roomTypeSchema);