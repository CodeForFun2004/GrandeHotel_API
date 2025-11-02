const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  threadId: { type: String, required: true, unique: true }, // VD: "T-1001"
  hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', index: true }, // Optional, để link với booking
  lastMessageAt: { type: Date, default: Date.now },
  unread: { type: Number, default: 0 }, // Số tin nhắn chưa đọc từ customer
  pinned: { type: Boolean, default: false },
}, { timestamps: true });

conversationSchema.index({ hotel: 1, customer: 1 }); // Để query nhanh
module.exports = mongoose.model('Conversation', conversationSchema);
