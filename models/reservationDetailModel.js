const mongoose = require('mongoose');

const reservationDetailSchema = new mongoose.Schema({
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true },
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    quantity: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('ReservationDetail', reservationDetailSchema);
