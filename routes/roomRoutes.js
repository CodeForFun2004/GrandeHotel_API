const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

const { protect, isAdmin, isHotelManager, isStaff } = require('../middlewares/auth.middleware');

// Room Type Management Routes - global/shared (require auth, but for any user)
router.get('/types', protect, roomController.getAllRoomTypes); // Any authenticated user can see room types
router.get('/types/:id', protect, roomController.getRoomTypeById);
router.post('/types', protect, isHotelManager, roomController.createRoomType); // Only managers can modify
router.put('/types/:id', protect, isHotelManager, roomController.updateRoomType);
router.delete('/types/:id', protect, isHotelManager, roomController.deleteRoomType);

// Staff view: list rooms in their assigned hotel (must be placed BEFORE '/:id')
router.get('/staff', protect, isStaff, roomController.getRoomsForStaff);

// Public: list ALL rooms across hotels (no auth)
router.get('/all', roomController.getAdminRooms);

// Public room detail: allow UI to fetch a single room without requiring manager role
router.get('/public/:id', roomController.getRoomById);

// Room Management Routes (for hotel managers - check permissions)
router.get('/', protect, isHotelManager, roomController.getAllRooms);
router.get('/:id', protect, isHotelManager, roomController.getRoomById);
router.post('/', protect, isHotelManager, roomController.createRoom);
router.put('/:id', protect, isHotelManager, roomController.updateRoom);
router.delete('/:id', protect, isHotelManager, roomController.deleteRoom);

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
