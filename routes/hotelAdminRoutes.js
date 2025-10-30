const express = require('express');
const router = express.Router();
const {
  getAllHotels,
  getHotelById,
  createHotel,
  updateHotel,
  deleteHotel,
  assignManager,
  unassignManager,
  getAvailableManagers
} = require('../controllers/hotelAdminController');

const { protect, isAdmin } = require('../middlewares/auth.middleware');

// All routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// Hotel CRUD routes
router.get('/', getAllHotels);
router.get('/:id', getHotelById);
router.post('/', createHotel);
router.put('/:id', updateHotel);
router.delete('/:id', deleteHotel);

// Manager assignment routes
router.put('/:id/assign-manager', assignManager);
router.put('/:id/unassign-manager', unassignManager);

// Get available managers for assignment
router.get('/managers/available', getAvailableManagers);

module.exports = router;
