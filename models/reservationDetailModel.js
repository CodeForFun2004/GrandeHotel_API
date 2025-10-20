const mongoose = require('mongoose');

const reservationDetailSchema = new mongoose.Schema({
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true },
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    quantity: { type: Number, required: true },
    adults: { type: Number, default: 1 },
    children: { type: Number, default: 0 },
    infants: { type: Number, default: 0 },
    // selected services for this reservation detail
    services: [{ service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' }, quantity: { type: Number, default: 1 } }]
}, { timestamps: true });

module.exports = mongoose.model('ReservationDetail', reservationDetailSchema);
