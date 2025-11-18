const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect, isHotelManagerOrAdmin } = require('../middlewares/auth.middleware');

// Room Type routes - global resources, managers and admins can access without hotelId
router.get('/', protect, isHotelManagerOrAdmin, roomController.getAllRoomTypes);
router.get('/:id', protect, isHotelManagerOrAdmin, roomController.getRoomTypeById);
router.post('/', protect, isHotelManagerOrAdmin, roomController.createRoomType);
router.put('/:id', protect, isHotelManagerOrAdmin, roomController.updateRoomType);
router.delete('/:id', protect, isHotelManagerOrAdmin, roomController.deleteRoomType);

module.exports = router;
