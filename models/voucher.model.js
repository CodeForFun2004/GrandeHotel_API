// models/voucher.model.js
const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  description: { type: String },

  // Kiểu giảm giá
  discountType: {
    type: String,
    enum: ['percent', 'fixed'], // % hoặc số tiền
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxDiscount: {
    type: Number,
    default: null
  },

  minBookingValue: {
    type: Number,
    default: 0
  },

  // Phạm vi trong chuỗi khách sạn
  scope: {
    type: String,
    enum: ['global', 'multi-hotel'],
    default: 'global'
  },
  hotelIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel'
    }
  ],

  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },

  maxUsageGlobal: {
    type: Number,
    default: 0 // 0 = không giới hạn
  },
  maxUsagePerUser: {
    type: Number,
    default: 0 // 0 = không giới hạn / user
  },

  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },

  // 🔒 Cho phép admin khóa voucher (không cho sử dụng nữa, nhưng vẫn giữ để xem lịch sử)
  isLock: {
    type: Boolean,
    default: false
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

voucherSchema.index({ code: 1 });

module.exports = mongoose.model('Voucher', voucherSchema);
