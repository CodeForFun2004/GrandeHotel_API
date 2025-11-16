const Room = require('../models/roomModel');
const RoomActivity = require('../models/roomActivity');
const chatController = require('./chatController');

exports.addActivity = async (req, res) => {
  try {
    const roomId = req.params.id;
    const { type, message, meta } = req.body;
    const userId = req.user?._id;

    // Ensure room exists
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const activity = await RoomActivity.create({
      room: roomId,
      user: userId,
      type: type || 'other',
      message: message || '',
      meta: meta || {},
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Emit real-time event to notify clients (if socket is initialized)
    try {
      chatController.emit && chatController.emit('room_activity', { room: roomId, activity });
    } catch (e) {
      console.error('Emit failed', e);
    }

    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    console.error('Error adding activity:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const roomId = req.params.id;
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const cursor = req.query.cursor; // optional createdAt cursor

    // Ensure room exists
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const q = { room: roomId, removed: false };
    if (cursor) q.createdAt = { $lt: new Date(cursor) };

    const activities = await RoomActivity.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    console.error('Error getting activities:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
