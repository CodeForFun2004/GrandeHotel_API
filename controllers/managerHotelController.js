const Hotel = require('../models/hotelModel');
const { uploadMultiple } = require('../utils/imageUpload');

// GET /api/manager/hotel/me - Get manager's hotel
exports.getMyHotel = async (req, res) => {
  try {
    const userId = req.user._id;
    const hotelId = req.user.hotelId || req.user.storeId;

    if (!hotelId) {
      return res.status(404).json({
        success: false,
        message: 'Manager chưa được gán vào khách sạn nào'
      });
    }

    const hotel = await Hotel.findById(hotelId);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn'
      });
    }

    // Verify that the hotel belongs to this manager
    if (hotel.manager && hotel.manager.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập khách sạn này'
      });
    }

    res.status(200).json({
      success: true,
      data: hotel,
      message: 'Lấy thông tin khách sạn thành công'
    });

  } catch (error) {
    console.error('Error getting manager hotel:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// PUT /api/manager/hotel/me - Update manager's hotel
exports.updateMyHotel = async (req, res) => {
  try {
    const userId = req.user._id;
    const hotelId = req.user.hotelId || req.user.storeId;

    if (!hotelId) {
      return res.status(404).json({
        success: false,
        message: 'Manager chưa được gán vào khách sạn nào'
      });
    }

    const hotel = await Hotel.findById(hotelId);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn'
      });
    }

    // Verify that the hotel belongs to this manager
    if (hotel.manager && hotel.manager.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật khách sạn này'
      });
    }

    // Extract allowed fields to update
    let { name, address, email, phone, description, amenities, status } = req.body;

    // Parse amenities if it's a JSON string
    if (amenities && typeof amenities === 'string') {
      try {
        amenities = JSON.parse(amenities);
      } catch (e) {
        // If parsing fails, treat as single value or empty array
        amenities = [];
      }
    }

    // Update fields
    if (name !== undefined) hotel.name = name;
    if (address !== undefined) hotel.address = address;
    if (email !== undefined) hotel.email = email;
    if (phone !== undefined) hotel.phone = phone;
    if (description !== undefined) hotel.description = description;
    if (amenities !== undefined) {
      hotel.amenities = Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []);
    }
    if (status !== undefined && ['available', 'full', 'closed'].includes(status)) {
      hotel.status = status;
    }

    // Handle images if uploaded
    if (req.files && req.files.length > 0) {
      const imageUrls = req.files.map(file => file.path || file.location);
      hotel.images = [...(hotel.images || []), ...imageUrls];
    }

    await hotel.save();

    res.status(200).json({
      success: true,
      data: hotel,
      message: 'Cập nhật thông tin khách sạn thành công'
    });

  } catch (error) {
    console.error('Error updating manager hotel:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

