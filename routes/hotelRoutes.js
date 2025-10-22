const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const roomController = require('../controllers/roomController');

router.get('/search', hotelController.searchHotelsByLocation);

router.get('/', hotelController.getAllHotels);
// Place the hotel-specific rooms search before the parameterized :id route to avoid conflicts
router.get('/:hotelId/rooms', roomController.searchRooms);
router.get('/:id', hotelController.getHotelById);
router.post('/', hotelController.createHotel);
router.put('/:id', hotelController.updateHotel);
router.delete('/:id', hotelController.deleteHotel);
//git

module.exports = router;