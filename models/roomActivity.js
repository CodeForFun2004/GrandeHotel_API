const mongoose = require('mongoose');

const roomActivitySchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['status_change','note','image_upload','image_delete','amenity_update','booking','price_change','assignment','other'], default: 'other', index: true },
  message: { type: String },
  meta: { type: mongoose.Schema.Types.Mixed },
  ip: String,
  userAgent: String,
  visibleTo: { type: [String], default: ['staff'] },
  removed: { type: Boolean, default: false }
}, { timestamps: true });

roomActivitySchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('RoomActivity', roomActivitySchema);
