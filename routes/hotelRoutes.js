const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const roomController = require('../controllers/roomController');

router.get('/', hotelController.getAllHotels);
router.get('/:id', hotelController.getHotelById);
router.post('/', hotelController.createHotel);
router.put('/:id', hotelController.updateHotel);
router.delete('/:id', hotelController.deleteHotel);
router.get('/:hotelId/rooms', roomController.searchRooms);

module.exports = router;