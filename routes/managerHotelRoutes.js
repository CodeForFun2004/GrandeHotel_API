const express = require('express');
const router = express.Router();
const { getMyHotel, updateMyHotel } = require('../controllers/managerHotelController');
const { protect, isHotelManager } = require('../middlewares/auth.middleware');
const { uploadMultiple } = require('../utils/imageUpload');

// All routes require authentication and hotel-manager role
router.use(protect);
router.use(isHotelManager);

// Manager hotel routes
router.get('/me', getMyHotel);
router.put('/me', uploadMultiple, updateMyHotel);

module.exports = router;

