const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không hợp lệ']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[+\-\s0-9]+$/, 'Số điện thoại không hợp lệ']
  },
  message: {
    type: String,
    required: false,
    minlength: 10,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'ignored'],
    default: 'pending'
  },
  subject: {
    type: String,
    enum: ['room-price', 'reservation', 'services', 'events', 'complaint', 'other'],
    default: 'other'
  },
}, {
  timestamps: true
});

// Index cho tìm kiếm hiệu quả
contactSchema.index({ name: 1, email: 1, phone: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);
