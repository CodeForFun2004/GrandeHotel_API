const Hotel = require('../models/hotelModel');
const User = require('../models/user.model');

// GET /api/admin/hotels - Get all hotels with populated manager info
exports.getAllHotels = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 20, 1);

    const total = await Hotel.countDocuments();
    const hotels = await Hotel.find()
      .populate('manager', 'fullname email phone')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: hotels,
      total,
      page,
      limit,
      message: 'Hotels retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting hotels:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// GET /api/admin/hotels/:id - Get hotel by ID
exports.getHotelById = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id)
      .populate('manager', 'fullname email phone username');

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hotel,
      message: 'Hotel retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting hotel:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// POST /api/admin/hotels - Create new hotel
exports.createHotel = async (req, res) => {
  try {
    const { name, address, email, phone, description, manager } = req.body;

    // Validation
    if (!name || !address) {
      return res.status(400).json({
        success: false,
        message: 'Hotel name and address are required'
      });
    }

    // If manager is provided, verify manager exists
    if (manager) {
      const managerUser = await User.findById(manager);
      if (!managerUser) {
        return res.status(400).json({
          success: false,
          message: 'Invalid manager ID'
        });
      }
      if (managerUser.role !== 'hotel-manager') {
        return res.status(400).json({
          success: false,
          message: 'Selected user is not a hotel-manager'
        });
      }
    }

    // Get uploaded image URLs from Cloudinary
    const images = req.files ? req.files.map(file => file.path) : [];

    // Create hotel
    const hotel = new Hotel({
      name,
      address,
      email,
      phone,
      description,
      manager,
      images
    });

    await hotel.save();
    await hotel.populate('manager', 'fullname email phone username');

    res.status(201).json({
      success: true,
      data: hotel,
      message: 'Hotel created successfully'
    });

  } catch (error) {
    console.error('Error creating hotel:', error);
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Hotel name already exists'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

// PUT /api/admin/hotels/:id - Update hotel
exports.updateHotel = async (req, res) => {
  try {
    const hotelId = req.params.id;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    // If manager is being changed, validate
    if (updates.manager !== undefined) {
      if (updates.manager) {
        const managerUser = await User.findById(updates.manager);
        if (!managerUser) {
          return res.status(400).json({
            success: false,
            message: 'Invalid manager ID'
          });
        }
        if (managerUser.role !== 'hotel-manager') {
          return res.status(400).json({
            success: false,
            message: 'Selected user is not a hotel-manager'
          });
        }
      }
    }

    // Handle image updates - append new images to existing ones
    if (req.files && req.files.length > 0) {
      const existingHotel = await Hotel.findById(hotelId);
      if (existingHotel) {
        const newImages = req.files.map(file => file.path);
        updates.images = [...(existingHotel.images || []), ...newImages];
      }
    }

    const hotel = await Hotel.findByIdAndUpdate(
      hotelId,
      updates,
      { new: true, runValidators: true }
    ).populate('manager', 'fullname email phone username');

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hotel,
      message: 'Hotel updated successfully'
    });

  } catch (error) {
    console.error('Error updating hotel:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// PUT /api/admin/hotels/:id/assign-manager - Assign manager to hotel
exports.assignManager = async (req, res) => {
  try {
    const hotelId = req.params.id;
    const { managerId } = req.body;

    if (!managerId) {
      return res.status(400).json({
        success: false,
        message: 'Manager ID is required'
      });
    }

    // Find and validate manager
    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: 'Manager not found'
      });
    }
    if (manager.role !== 'hotel-manager') {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not a hotel-manager'
      });
    }

    // Find hotel
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    // Check if manager is already assigned to another hotel
    if (manager.hotelId && manager.hotelId.toString() !== hotelId) {
      return res.status(400).json({
        success: false,
        message: 'Manager is already assigned to another hotel'
      });
    }

    // Update hotel and manager bidirectionally
    hotel.manager = managerId;
    manager.hotelId = hotelId;

    await hotel.save();
    await manager.save();

    // Populate and return updated hotel
    await hotel.populate('manager', 'fullname email phone username');

    res.status(200).json({
      success: true,
      data: hotel,
      message: 'Manager assigned successfully'
    });

  } catch (error) {
    console.error('Error assigning manager:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// PUT /api/admin/hotels/:id/unassign-manager - Unassign manager from hotel
exports.unassignManager = async (req, res) => {
  try {
    const hotelId = req.params.id;

    // Find hotel
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    if (!hotel.manager) {
      return res.status(400).json({
        success: false,
        message: 'Hotel has no assigned manager'
      });
    }

    // Get current manager and clear assignment
    const manager = await User.findById(hotel.manager);
    if (manager) {
      manager.hotelId = null;
      await manager.save();
    }

    // Clear hotel manager
    hotel.manager = null;
    await hotel.save();

    res.status(200).json({
      success: true,
      data: hotel,
      message: 'Manager unassigned successfully'
    });

  } catch (error) {
    console.error('Error unassigning manager:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// DELETE /api/admin/hotels/:id - Delete hotel
exports.deleteHotel = async (req, res) => {
  try {
    const hotelId = req.params.id;

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    // If hotel has a manager, clear the manager's hotelId
    if (hotel.manager) {
      const manager = await User.findById(hotel.manager);
      if (manager) {
        manager.hotelId = null;
        await manager.save();
      }
    }

    await Hotel.findByIdAndDelete(hotelId);

    res.status(200).json({
      success: true,
      message: 'Hotel deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting hotel:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// GET /api/admin/hotels/managers/available - Get available hotel-managers
exports.getAvailableManagers = async (req, res) => {
  try {
    const managers = await User.find({
      role: 'hotel-manager',
      $or: [
        { hotelId: null },
        { hotelId: { $exists: false } }
      ]
    })
    .select('fullname username email phone')
    .sort({ fullname: 1 });

    res.status(200).json({
      success: true,
      data: managers,
      message: 'Available managers retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting available managers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
