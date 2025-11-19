const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const roomActivityController = require('../controllers/roomActivityController');

const { protect, isAdmin, isHotelManager, isHotelManagerOrAdmin, isStaff } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const Room = require('../models/roomModel');

// Upload middleware for room images
const uploadRoomImage = upload({ folderPrefix: 'grand-hotel/rooms', model: Room, nameField: 'code' });

// Room Type Management Routes - global/shared (require auth, but for any user)
router.get('/types', protect, roomController.getAllRoomTypes); // Any authenticated user can see room types
router.get('/types/:id', protect, roomController.getRoomTypeById);
router.post('/types', protect, isHotelManagerOrAdmin, roomController.createRoomType); // Managers or admins can modify (no hotelId required for global resources)
router.put('/types/:id', protect, isHotelManagerOrAdmin, roomController.updateRoomType);
router.delete('/types/:id', protect, isHotelManagerOrAdmin, roomController.deleteRoomType);

// Staff view: list rooms in their assigned hotel (must be placed BEFORE '/:id')
router.get('/staff', protect, isStaff, roomController.getRoomsForStaff);

// Check room number uniqueness for manager's hotel
router.get('/check-number', protect, isHotelManager, roomController.checkRoomNumber);

// Public: list ALL rooms across hotels (no auth)
router.get('/all', roomController.getAdminRooms);

// Public room detail: allow UI to fetch a single room without requiring manager role
router.get('/public/:id', roomController.getRoomById);

// Room activity endpoints
router.get('/:id/activities', protect, (req, res, next) => {
  // allow staff or managers to view activities
  next();
}, roomActivityController.getActivities);

router.post('/:id/activities', protect, roomActivityController.addActivity);

// Room Management Routes (for hotel managers - check permissions)
router.get('/', protect, isHotelManager, roomController.getAllRooms);
// Allow hotel managers and staff to view a specific room (staff can view their hotel's rooms)
router.get('/:id', protect, (req, res, next) => {
  const role = req.user?.role;
  if (role === 'hotel-manager' || role === 'staff' || role === 'admin') return next();
  return res.status(403).json({ message: 'Truy cập bị từ chối: chỉ dành cho hotel-manager hoặc staff' });
}, roomController.getRoomById);
router.post('/', protect, isHotelManager, roomController.createRoom);
// Allow hotel managers full update; allow staff but controller will enforce staff-only status updates
router.put('/:id', protect, (req, res, next) => {
  const role = req.user?.role;
  if (role === 'hotel-manager' || role === 'staff' || role === 'admin') return next();
  return res.status(403).json({ message: 'Truy cập bị từ chối: chỉ dành cho hotel-manager hoặc staff' });
}, roomController.updateRoom);
// upload a single image for room (manager only)
router.put('/:id/images', protect, isHotelManager, uploadRoomImage.single('image'), roomController.addRoomImage);
// upload multiple images for room in one request (manager only)
router.put('/:id/images/batch', protect, isHotelManager, uploadRoomImage.array('images', 10), roomController.addRoomImages);
// delete a single image (manager only)
router.delete('/:id/images', protect, isHotelManager, roomController.deleteRoomImage);
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
