const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    roomNumber: { type: String, required: true, unique: true },
    status: { type: String, enum: ['available', 'occupied', 'maintenance', 'cleaning', 'reserving'], default: 'available' },
    description: String,
    pricePerNight: { type: Number, required: true },
    images: [String] //Khong can bang roomImage nua neu chi luu 5-10 img/room
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);