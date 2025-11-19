const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    roomNumber: { type: String, required: true },
    status: { type: String, enum: ['Reserved', 'Available', 'Maintenance','Cleaning','Occupied'], default: 'Available' },
    description: String,
    services: [String],
    pricePerNight: { type: Number, required: true },
    images: [String],
    code: { type: String, required: true } // Unique code for room
}, { timestamps: true });

// Index for hotel-based queries and unique code per hotel
roomSchema.index({ hotel: 1, code: 1 }, { unique: true });
roomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

// Application-level checks to enforce roomNumber uniqueness per hotel
// This helps catch duplicates early and provide clearer errors even if the DB index is misconfigured.
roomSchema.pre('save', async function(next) {
    try {
        const Room = mongoose.models.Room || mongoose.model('Room');
        if (!this.hotel || !this.roomNumber) return next();
        const query = { hotel: this.hotel, roomNumber: new RegExp(`^${this.roomNumber}$`, 'i') };
        if (this._id) query._id = { $ne: this._id };
        const existing = await Room.findOne(query).lean();
        if (existing) {
            const err = new mongoose.Error.ValidationError(this);
            err.addError('roomNumber', new mongoose.Error.ValidatorError({ message: 'Room number already exists in this hotel' }));
            return next(err);
        }
        return next();
    } catch (e) {
        return next(e);
    }
});

// For updates via findOneAndUpdate, check the update payload
roomSchema.pre('findOneAndUpdate', async function(next) {
    try {
        const update = this.getUpdate && this.getUpdate();
        if (!update) return next();
        const hotel = update.hotel || (update.$set && update.$set.hotel);
        const roomNumber = update.roomNumber || (update.$set && update.$set.roomNumber);
        // if neither hotel nor roomNumber changed, skip
        if (!hotel && !roomNumber) return next();
        const Room = mongoose.models.Room || mongoose.model('Room');
        const query = {};
        if (hotel) query.hotel = hotel;
        if (roomNumber) query.roomNumber = new RegExp(`^${roomNumber}$`, 'i');
        // exclude the document being updated
        const id = this.getQuery()._id || this.getQuery().id;
        if (id) query._id = { $ne: id };
        const existing = await Room.findOne(query).lean();
        if (existing) {
            const err = new mongoose.Error.ValidationError();
            err.addError('roomNumber', new mongoose.Error.ValidatorError({ message: 'Room number already exists in this hotel' }));
            return next(err);
        }
        return next();
    } catch (e) {
        return next(e);
    }
});

module.exports = mongoose.model('Room', roomSchema);