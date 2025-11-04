const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user info to socket
    socket.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      hotelId: user.hotelId // For staff users
    };

    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

module.exports = { authenticateSocket };
