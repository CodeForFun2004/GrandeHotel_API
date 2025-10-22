const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect, isHotelManager } = require('../middlewares/auth.middleware');

// Room Type routes
router.get('/', protect, isHotelManager, roomController.getAllRoomTypes);
router.get('/:id', protect, isHotelManager, roomController.getRoomTypeById);
router.post('/', protect, isHotelManager, roomController.createRoomType);
router.put('/:id', protect, isHotelManager, roomController.updateRoomType);
router.delete('/:id', protect, isHotelManager, roomController.deleteRoomType);

module.exports = router;
