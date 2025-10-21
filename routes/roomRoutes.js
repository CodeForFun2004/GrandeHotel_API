const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect, isHotelManager } = require('../middlewares/auth.middleware');

// Room routes
router.get('/', protect, isHotelManager, roomController.getAllRooms);
router.get('/:id', protect, isHotelManager, roomController.getRoomById);
router.post('/', protect, isHotelManager, roomController.createRoom);
router.put('/:id', protect, isHotelManager, roomController.updateRoom);
router.delete('/:id', protect, isHotelManager, roomController.deleteRoom);

module.exports = router;

//git
