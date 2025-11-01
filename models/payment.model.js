const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, default: 'unknown' },
  status: { type: String, enum: ['Success', 'Failed', 'Pending'], default: 'Pending', index: true },
  // Generic references for flexibility across flows
  stay: { type: mongoose.Schema.Types.ObjectId, ref: 'Stay', default: null, index: true },
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null, index: true },
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', default: null, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  description: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
