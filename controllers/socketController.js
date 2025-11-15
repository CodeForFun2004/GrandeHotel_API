const Conversation = require('../models/conversation');
const Message = require('../models/message');
const User = require('../models/user.model');

// Store active users and their socket IDs
const activeUsers = new Map(); // userId -> socketId
const socketToUser = new Map(); // socketId -> userId

// Export for use in other controllers
module.exports.activeUsers = activeUsers;

// Helper: Check if reservation is active
const isReservationActive = (reservation) => {
  const now = new Date();
  return reservation &&
         ['approved', 'completed'].includes(reservation.status) &&
         now >= reservation.checkInDate &&
         now <= reservation.checkOutDate;
};

// Socket event handlers
const handleSocketConnection = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.email} (${socket.user.role}) - Socket ID: ${socket.id}`);

    // Store user connection
    activeUsers.set(socket.user.id.toString(), socket.id);
    socketToUser.set(socket.id, socket.user.id.toString());

    // Monitor connection health (heartbeat happens automatically)
    console.log(`💓 Heartbeat active for ${socket.user.email}: ping every 25s, timeout 60s`);

    // Join user-specific room for notifications
    socket.join(`user_${socket.user.id}`);

    // Handle joining a conversation room
    socket.on('join_conversation', async (data) => {
      try {
        const { threadId } = data;

        // Verify user has access to this conversation
        let conversation;
        if (socket.user.role === 'staff') {
          conversation = await Conversation.findOne({
            threadId,
            hotel: socket.user.hotelId
          });
        } else {
          conversation = await Conversation.findOne({
            threadId,
            customer: socket.user.id
          });
        }

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found or access denied' });
          return;
        }

        // Check reservation active status if exists
        if (conversation.reservation) {
          const Reservation = require('../models/reservationModel');
          const reservation = await Reservation.findById(conversation.reservation);
          if (!isReservationActive(reservation)) {
            socket.emit('error', { message: 'Conversation not active' });
            return;
          }
        }

        // Join the conversation room
        socket.join(threadId);
        console.log(`${socket.user.email} joined conversation: ${threadId}`);

        // Send confirmation
        socket.emit('joined_conversation', { threadId });

      } catch (error) {
        console.error('Error joining conversation:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Handle leaving a conversation room
    socket.on('leave_conversation', (data) => {
      const { threadId } = data;
      socket.leave(threadId);
      console.log(`${socket.user.email} left conversation: ${threadId}`);
    });

    // Handle sending message
    socket.on('send_message', async (data) => {
      try {
        const { threadId, text } = data;

        if (!text || !text.trim()) {
          socket.emit('error', { message: 'Message text is required' });
          return;
        }

        // Find conversation
        let conversation;
        if (socket.user.role === 'staff') {
          conversation = await Conversation.findOne({
            threadId,
            hotel: socket.user.hotelId
          });
        } else {
          conversation = await Conversation.findOne({
            threadId,
            customer: socket.user.id
          });
        }

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // Check reservation active status if exists
        if (conversation.reservation) {
          const Reservation = require('../models/reservationModel');
          const reservation = await Reservation.findById(conversation.reservation);
          if (!isReservationActive(reservation)) {
            socket.emit('error', { message: 'Cannot send message: conversation not active' });
            return;
          }
        }

        // Create message
        const message = new Message({
          conversation: conversation._id,
          from: socket.user.role === 'staff' ? 'staff' : 'customer',
          text: text.trim(),
          time: new Date()
        });
        await message.save();

        // Update conversation
        conversation.lastMessageAt = message.time;
        if (socket.user.role === 'customer') {
          conversation.unread += 1; // Increase unread for staff
        } else {
          conversation.unread = 0; // Staff replied, reset unread
        }
        await conversation.save();

        // Prepare message data for emission
        const messageData = {
          id: message._id.toString(),
          from: message.from,
          text: message.text,
          time: message.time.toISOString(),
          threadId
        };

        // Emit to all users in the conversation room
        io.to(threadId).emit('new_message', messageData);

        // If customer sent message, also notify staff via their personal room
        if (socket.user.role === 'customer') {
          // Find staff users for this hotel and notify them
          const staffSockets = [];
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

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { threadId } = data;
      socket.to(threadId).emit('user_typing', {
        userId: socket.user.id,
        email: socket.user.email,
        role: socket.user.role
      });
    });

    socket.on('typing_stop', (data) => {
      const { threadId } = data;
      socket.to(threadId).emit('user_stopped_typing', {
        userId: socket.user.id,
        email: socket.user.email,
        role: socket.user.role
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.email}`);
      activeUsers.delete(socket.user.id.toString());
      socketToUser.delete(socket.id);
    });

  });
};

module.exports = { handleSocketConnection };
