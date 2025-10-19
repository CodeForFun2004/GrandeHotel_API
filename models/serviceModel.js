const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    basePrice: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
