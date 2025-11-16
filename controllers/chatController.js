const Conversation = require('../models/conversation');
const Message = require('../models/message');
const Reservation = require('../models/reservationModel');
const User = require('../models/user.model');
const Hotel = require('../models/hotelModel');

// Get io instance for emitting events
let io;
const setSocketIO = (socketIO) => {
  io = socketIO;
};

module.exports.setSocketIO = setSocketIO;

// Generic emit helper so other controllers can notify clients
const emit = (event, payload) => {
  try {
    if (io) io.emit(event, payload);
  } catch (e) {
    console.error('chatController.emit error', e);
  }
};

module.exports.emit = emit;

// Helper: Kiểm tra reservation active
const isReservationActive = (reservation) => {
  const now = new Date();
  return reservation &&
         ['approved', 'completed'].includes(reservation.status) &&
         now >= reservation.checkInDate &&
         now <= reservation.checkOutDate;
};

// GET /api/staff/conversations - Lấy danh sách conversations
const getConversations = async (req, res) => {
  try {
    const { hotelId } = req.user; // Từ auth middleware
    const { query, tab } = req.query;

    // Query conversations - include ALL conversations for this hotel (staff should see all)
    let filter = {
      hotel: hotelId
    };

    // Filter theo tab
    if (tab === 'unread') {
      filter.unread = { $gt: 0 };
    } else if (tab === 'active') {
      // For active tab, get conversations with approved/completed reservations
      const now = new Date();
      const activeReservations = await Reservation.find({
        hotel: hotelId,
        status: { $in: ['approved', 'completed'] },
        checkInDate: { $lte: now },
        checkOutDate: { $gte: now }
      }).select('_id');
      const activeReservationIds = activeReservations.map(r => r._id);

      filter = {
        hotel: hotelId,
        $or: [
          { reservation: { $in: activeReservationIds } },
          { reservation: null }
        ]
      };
    }

    let conversations = await Conversation.find(filter)
      .populate('customer', 'fullname phone email')
      .populate('reservation', 'status checkInDate checkOutDate')
      .sort({ lastMessageAt: -1 });

    // Filter theo query (tên, phone)
    if (query) {
      const kw = query.toLowerCase();
      conversations = conversations.filter(c =>
        c.customer.fullname.toLowerCase().includes(kw) ||
        c.customer.phone.includes(kw)
      );
    }

    // Thêm lastMessage cho mỗi conversation
    const result = await Promise.all(conversations.map(async (conv) => {
      const lastMsg = await Message.findOne({ conversation: conv._id }).sort({ time: -1 });
      return {
        threadId: conv.threadId,
        customer: {
          Account_ID: conv.customer._id,
          FirstName: conv.customer.fullname.split(' ')[0] || '',
          LastName: conv.customer.fullname.split(' ').slice(1).join(' ') || '',
          Email: conv.customer.email,
          PhoneNumber: conv.customer.phone,
          Status: conv.customer.isBanned ? 'banned' : 'active'
        },
        hotelId: conv.hotel,
        lastMessageAt: conv.lastMessageAt.toISOString(),
        unread: conv.unread,
        pinned: conv.pinned,
        booking: conv.reservation ? {
          Reservation_ID: conv.reservation._id.toString(),
          Status: conv.reservation.status === 'approved' || conv.reservation.status === 'completed' ? 'confirmed' : 'pending',
          CheckIn: conv.reservation.checkInDate.toISOString().split('T')[0],
          CheckOut: conv.reservation.checkOutDate.toISOString().split('T')[0]
        } : null,
        messages: lastMsg ? [{
          id: lastMsg._id.toString(),
          from: lastMsg.from,
          text: lastMsg.text,
          time: lastMsg.time.toISOString()
        }] : []
      };
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/staff/conversations/:threadId - Chi tiết conversation
const getConversationById = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { hotelId } = req.user;

    const conversation = await Conversation.findOne({ threadId, hotel: hotelId })
      .populate('customer', 'fullname phone email')
      .populate('reservation', 'status checkInDate checkOutDate');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Kiểm tra reservation confirmed (chỉ kiểm tra nếu có reservation)
    // Allow customers to view conversations for approved/completed reservations
    if (conversation.reservation && !['approved', 'completed'].includes(conversation.reservation.status)) {
      return res.status(403).json({ message: 'Conversation not available' });
    }

    const messages = await Message.find({ conversation: conversation._id }).sort({ time: 1 });

    res.json({
      threadId: conversation.threadId,
      customer: {
        Account_ID: conversation.customer._id,
        FirstName: conversation.customer.fullname.split(' ')[0] || '',
        LastName: conversation.customer.fullname.split(' ').slice(1).join(' ') || '',
        Email: conversation.customer.email,
        PhoneNumber: conversation.customer.phone,
        Status: conversation.customer.isBanned ? 'banned' : 'active'
      },
      hotelId: conversation.hotel,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      unread: conversation.unread,
      pinned: conversation.pinned,
      booking: conversation.reservation ? {
        Reservation_ID: conversation.reservation._id.toString(),
        Status: conversation.reservation.status === 'approved' || conversation.reservation.status === 'completed' ? 'confirmed' : 'pending',
        CheckIn: conversation.reservation.checkInDate.toISOString().split('T')[0],
        CheckOut: conversation.reservation.checkOutDate.toISOString().split('T')[0]
      } : null,
      messages: messages.map(m => ({
        id: m._id.toString(),
        from: m.from,
        text: m.text,
        time: m.time.toISOString()
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/staff/conversations/:threadId/messages - Gửi tin nhắn
const sendMessage = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { text } = req.body;
    const { hotelId } = req.user;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }

    let conversation = await Conversation.findOne({ threadId, hotel: hotelId });
    if (!conversation) {
      // Tạo conversation mới nếu chưa có (cho reservation active)
      // Giả sử threadId là "T-" + reservationId
      const reservationId = threadId.replace('T-', '');
      const reservation = await Reservation.findOne({
        _id: reservationId,
        hotel: hotelId,
        status: { $in: ['approved', 'completed'] },
        checkInDate: { $lte: new Date() },
        checkOutDate: { $gte: new Date() }
      }).populate('customer');

      if (!reservation) {
        return res.status(404).json({ message: 'Active reservation not found for this thread' });
      }

      conversation = new Conversation({
        threadId,
        hotel: hotelId,
        customer: reservation.customer._id,
        reservation: reservation._id,
        lastMessageAt: new Date(),
        unread: 0,
        pinned: false
      });
      await conversation.save();
    } else {
    // Kiểm tra reservation confirmed (chỉ kiểm tra nếu có reservation)
    // Allow customers to send messages for approved/completed reservations
    if (conversation.reservation) {
      const reservation = await Reservation.findById(conversation.reservation);
      if (!['approved', 'completed'].includes(reservation.status)) {
        return res.status(403).json({ message: 'Cannot send message: reservation not confirmed' });
      }
    }
    }

    const message = new Message({
      conversation: conversation._id,
      from: 'staff',
      text: text.trim(),
      time: new Date()
    });
    await message.save();

    // Update conversation
    conversation.lastMessageAt = message.time;
    conversation.unread = 0; // Staff đã phản hồi
    await conversation.save();

    // Emit real-time event
    const messageData = {
      id: message._id.toString(),
      from: message.from,
      text: message.text,
      time: message.time.toISOString(),
      threadId
    };

    if (io) {
      // Emit to conversation room
      io.to(threadId).emit('new_message', messageData);
    }

    res.status(201).json(messageData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/staff/conversations/:threadId/read - Đánh dấu đã đọc
const markAsRead = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { hotelId } = req.user;

    const conversation = await Conversation.findOneAndUpdate(
      { threadId, hotel: hotelId },
      { unread: 0 },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/staff/conversations/:threadId/pin - Ghim/bỏ ghim
const togglePin = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { hotelId } = req.user;

    const conversation = await Conversation.findOne({ threadId, hotel: hotelId });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    conversation.pinned = !conversation.pinned;
    await conversation.save();

    res.json({ pinned: conversation.pinned });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/customer/conversations/:threadId/messages - Customer gửi tin nhắn
const sendMessageFromCustomer = async (req, res) => {
  try {
    const { threadId } = req.params;
    const { text } = req.body;
    const customerId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const conversation = await Conversation.findOne({ threadId, customer: customerId });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Kiểm tra reservation confirmed (chỉ kiểm tra nếu có reservation)
    // Allow customers to send messages for approved/completed reservations
    if (conversation.reservation) {
      const reservation = await Reservation.findById(conversation.reservation);
      if (!['approved', 'completed'].includes(reservation.status)) {
        return res.status(403).json({ message: 'Cannot send message: reservation not confirmed' });
      }
    }

    const message = new Message({
      conversation: conversation._id,
      from: 'customer',
      text: text.trim(),
      time: new Date()
    });
    await message.save();

    // Update conversation: tăng unread cho staff
    conversation.lastMessageAt = message.time;
    conversation.unread += 1;
    await conversation.save();

    // Emit real-time event
    const messageData = {
      id: message._id.toString(),
      from: message.from,
      text: message.text,
      time: message.time.toISOString(),
      threadId
    };

    if (io) {
      // Emit to conversation room
      io.to(threadId).emit('new_message', messageData);

      // Notify staff about new message
      const staffSockets = [];
      const activeUsers = require('./socketController').activeUsers || new Map();

      for (const [userId, socketId] of activeUsers.entries()) {
        const user = await User.findById(userId);
        if (user && user.role === 'staff' && user.hotelId?.toString() === conversation.hotel.toString()) {
          staffSockets.push(socketId);
        }
      }

      // Emit notification to staff
      staffSockets.forEach(socketId => {
        io.to(socketId).emit('conversation_updated', {
          threadId,
          unread: conversation.unread,
          lastMessage: messageData
        });
      });
    }

    res.status(201).json(messageData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/customer/conversations - Customer lấy danh sách conversations
const getCustomerConversations = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { query, tab } = req.query;

    // Query conversations - include ALL conversations for this customer
    let filter = {
      customer: customerId
    };

    // Filter theo tab
    if (tab === 'unread') {
      filter.unread = { $gt: 0 };
    } else if (tab === 'active') {
      // For active tab, get conversations with approved/completed reservations
      const confirmedReservations = await Reservation.find({
        customer: customerId,
        status: { $in: ['approved', 'completed'] }
      }).select('_id');
      const confirmedReservationIds = confirmedReservations.map(r => r._id);

      filter = {
        customer: customerId,
        $or: [
          { reservation: { $in: confirmedReservationIds } },
          { reservation: null }
        ]
      };
    }

    let conversations = await Conversation.find(filter)
      .populate('hotel', 'name address')
      .populate('reservation', 'status checkInDate checkOutDate')
      .sort({ lastMessageAt: -1 });

    // Filter theo query (tên hotel)
    if (query) {
      const kw = query.toLowerCase();
      conversations = conversations.filter(c =>
        c.hotel.name.toLowerCase().includes(kw) ||
        c.hotel.address.toLowerCase().includes(kw)
      );
    }

    // Thêm lastMessage cho mỗi conversation
    const result = await Promise.all(conversations.map(async (conv) => {
      const lastMsg = await Message.findOne({ conversation: conv._id }).sort({ time: -1 });
      return {
        threadId: conv.threadId,
        hotel: {
          Hotel_ID: conv.hotel._id,
          Name: conv.hotel.name,
          Address: conv.hotel.address
        },
        lastMessageAt: conv.lastMessageAt.toISOString(),
        unread: conv.unread,
        pinned: conv.pinned,
        booking: conv.reservation ? {
          Reservation_ID: conv.reservation._id.toString(),
          Status: conv.reservation.status === 'approved' || conv.reservation.status === 'completed' ? 'confirmed' : 'pending',
          CheckIn: conv.reservation.checkInDate.toISOString().split('T')[0],
          CheckOut: conv.reservation.checkOutDate.toISOString().split('T')[0]
        } : null,
        messages: lastMsg ? [{
          id: lastMsg._id.toString(),
          from: lastMsg.from,
          text: lastMsg.text,
          time: lastMsg.time.toISOString()
        }] : []
      };
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/customer/conversations/:threadId - Customer xem conversation
const getCustomerConversation = async (req, res) => {
  try {
    const { threadId } = req.params;
    const customerId = req.user._id;

    const conversation = await Conversation.findOne({ threadId, customer: customerId })
      .populate('reservation', 'status checkInDate checkOutDate');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Kiểm tra reservation active (chỉ kiểm tra nếu có reservation)
    if (conversation.reservation && !isReservationActive(conversation.reservation)) {
      return res.status(403).json({ message: 'Conversation not active' });
    }

    const messages = await Message.find({ conversation: conversation._id }).sort({ time: 1 });

    res.json({
      threadId: conversation.threadId,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      unread: conversation.unread,
      pinned: conversation.pinned,
      booking: conversation.reservation ? {
        Reservation_ID: conversation.reservation._id.toString(),
        Status: conversation.reservation.status === 'approved' || conversation.reservation.status === 'completed' ? 'confirmed' : 'pending',
        CheckIn: conversation.reservation.checkInDate.toISOString().split('T')[0],
        CheckOut: conversation.reservation.checkOutDate.toISOString().split('T')[0]
      } : null,
      messages: messages.map(m => ({
        id: m._id.toString(),
        from: m.from,
        text: m.text,
        time: m.time.toISOString()
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  setSocketIO,
  getConversations,
  getConversationById,
  sendMessage,
  markAsRead,
  togglePin,
  sendMessageFromCustomer,
  getCustomerConversations,
  getCustomerConversation
};
