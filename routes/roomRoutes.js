const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

const { protect, isAdmin, isHotelManager } = require('../middlewares/auth.middleware');

// Admin Room Type Management Routes - must come BEFORE parameterized routes
router.get('/types', roomController.getAllRoomTypes); // Remove auth for room types dropdown
router.get('/types/:id', protect, isHotelManager, roomController.getRoomTypeById);
router.post('/types', protect, isHotelManager, roomController.createRoomType);
router.put('/types/:id', protect, isHotelManager, roomController.updateRoomType);
router.delete('/types/:id', protect, isHotelManager, roomController.deleteRoomType);

// Admin Room Management Routes (formatted for frontend)
router.get('/', protect, isHotelManager, roomController.getAdminRooms);
router.get('/:id', protect,isHotelManager, roomController.getRoomById);
router.post('/', protect, isHotelManager, roomController.createAdminRoom);
router.put('/:id', protect, isHotelManager, roomController.updateAdminRoom);
router.delete('/:id', protect, isHotelManager, roomController.deleteAdminRoom);

// Legacy Routes (kept for compatibility)
// Uncomment if needed for non-admin usage
// router.get('/legacy/', roomController.getAllRooms);
// router.get('/legacy/:id', roomController.getRoomById);
// router.post('/legacy/', roomController.createRoom);
// router.put('/legacy/:id', roomController.updateRoom);
// router.delete('/legacy/:id', roomController.deleteRoom);

// Search endpoint (used by booking system)
router.get('/search/:hotelId', roomController.searchRooms);

// Support frontend route for room types - redirect from /api/roomtypes to /api/rooms/types
router.use('/types', (req, res, next) => {
  // Allow the /types routes to be accessed
  next();
});


module.exports = router;

//git
