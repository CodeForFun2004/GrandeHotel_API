const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'approved', 'canceled', 'paid'], default: 'pending' },
    totalPrice: { type: Number, required: true },
    numberOfGuests: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Reservation', reservationSchema);
