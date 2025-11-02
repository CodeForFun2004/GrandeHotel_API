const mongoose = require('mongoose');

// Embedded guest info (no account required)
const stayingGuestSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  dateOfBirth: { type: Date, default: null },
  phone: { type: String, default: null }
}, { _id: false });

// Per-room service usage with quantity
const roomServiceSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  quantity: { type: Number, default: 1, min: 1 }
}, { _id: false });

// A single room stay record within a stay detail
const roomStaySchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  guests: { type: [stayingGuestSchema], default: [] },
  services: { type: [roomServiceSchema], default: [] },
  notes: { type: String, default: null }
}, { _id: false });

const stayDetailSchema = new mongoose.Schema({
  roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
  rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true }],
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  totalPrice: { type: Number, required: true },
  notes: { type: String, default: null },
  // Per-room stay entries with guests and services (simple and explicit)
  roomStays: { type: [roomStaySchema], default: [] }
}, { _id: false });

const staySchema = new mongoose.Schema({
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true, index: true },
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  details: { type: [stayDetailSchema], default: [] },
  actualCheckIn: { type: Date, default: null },
  actualCheckOut: { type: Date, default: null },
  status: { type: String, enum: ['Checked in', 'Checked out', 'Canceled'], default: 'Checked in', index: true },
  notes: { type: String, default: null },
  receptionist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// ensure one stay per reservation (active)
staySchema.index({ reservation: 1 }, { unique: true });

module.exports = mongoose.model('Stay', staySchema);
