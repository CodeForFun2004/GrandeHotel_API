const User = require('../models/user.model');
const Hotel = require('../models/hotelModel');
const { createManagerUser } = require('../utils/createManagerUser');

// GET /api/manager/users - Get all managers
exports.getAllManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: 'hotel-manager' })
      .populate('hotelId', 'name address')
      .select('-password -refreshToken');

    res.status(200).json({
      success: true,
      data: managers,
      message: 'Managers retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting managers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// POST /api/manager/users - Create new manager
exports.createManager = async (req, res) => {
  try {
    const { fullname, username, email, password, phone, address, hotelId } = req.body;

    // Validation
    if (!fullname || !username || !email || !password || !hotelId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fullname, username, email, password, and hotelId are required' 
      });
    }

    // Create manager user
    const result = await createManagerUser({
      fullname,
      username,
      email,
      password,
      phone,
      address
    }, hotelId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);

  } catch (error) {
    console.error('Error creating manager:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// GET /api/manager/users/:id - Get manager by ID
exports.getManagerById = async (req, res) => {
  try {
    const managerId = req.params.id;

    const manager = await User.findOne({ 
      _id: managerId, 
      role: 'hotel-manager' 
    })
    .populate('hotelId', 'name address')
    .select('-password -refreshToken');

    if (!manager) {
      return res.status(404).json({ 
        success: false, 
        message: 'Manager not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: manager,
      message: 'Manager retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting manager:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// PUT /api/manager/users/:id - Update manager
exports.updateManager = async (req, res) => {
  try {
    const managerId = req.params.id;
    const updates = req.body;

    // Remove sensitive fields
    delete updates.password;
    delete updates.refreshToken;
    delete updates.role;

    const manager = await User.findOneAndUpdate(
      { _id: managerId, role: 'hotel-manager' },
      updates,
      { new: true, runValidators: true }
    )
    .populate('hotelId', 'name address')
    .select('-password -refreshToken');

    if (!manager) {
      return res.status(404).json({ 
        success: false, 
        message: 'Manager not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: manager,
      message: 'Manager updated successfully'
    });

  } catch (error) {
    console.error('Error updating manager:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// DELETE /api/manager/users/:id - Delete manager
exports.deleteManager = async (req, res) => {
  try {
    const managerId = req.params.id;

    const manager = await User.findOneAndDelete({ 
      _id: managerId, 
      role: 'hotel-manager' 
    });

    if (!manager) {
      return res.status(404).json({ 
        success: false, 
        message: 'Manager not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Manager deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting manager:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};
