const User = require('../models/user.model');
const Hotel = require('../models/hotelModel');

/**
 * Create a hotel manager user with hotelId assignment
 * @param {Object} userData - User data
 * @param {string} userData.fullname - Full name
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email
 * @param {string} userData.password - Password
 * @param {string} userData.phone - Phone number
 * @param {string} userData.address - Address
 * @param {string} hotelId - Hotel ID to assign to manager
 * @returns {Promise<Object>} Created user
 */
async function createManagerUser(userData, hotelId) {
  try {
    // Verify hotel exists
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      throw new Error('Hotel not found');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: userData.email },
        { username: userData.username }
      ]
    });

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    // Create manager user
    const manager = new User({
      ...userData,
      role: 'hotel-manager',
      hotelId: hotelId,
      isBanned: false
    });

    await manager.save();
    await manager.populate('hotelId', 'name address');

    return {
      success: true,
      user: {
        _id: manager._id,
        fullname: manager.fullname,
        username: manager.username,
        email: manager.email,
        role: manager.role,
        hotelId: manager.hotelId,
        phone: manager.phone,
        address: manager.address
      },
      message: 'Manager user created successfully'
    };

  } catch (error) {
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
}

module.exports = { createManagerUser };
