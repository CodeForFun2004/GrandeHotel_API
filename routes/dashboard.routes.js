const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRevenueData,
  getHotelPerformance,
  getBookingStatus,
  getUserStats,
  getRecentActivities,
  searchReservationsForCheckIn,
  getReservationForCheckIn,
  confirmCheckIn,
  findStayByRoomNumberForCheckout,
  createCheckoutPayment,
  confirmCheckout,
  addServiceToRoomInStay,
  listHotelServices
} = require('../controllers/dashboardController');

// Middleware imports
const { protect, isAdmin, isStaff, isHotelManager } = require('../middlewares/auth.middleware');

// All dashboard routes are protected and admin-only
router.get('/stats', protect, isAdmin, getDashboardStats);
router.get('/revenue', protect, isAdmin, getRevenueData);
router.get('/hotels/performance', protect, isAdmin, getHotelPerformance);
router.get('/bookings/status', protect, isAdmin, getBookingStatus);
router.get('/users/stats', protect, isAdmin, getUserStats);
router.get('/activities/recent', protect, isAdmin, getRecentActivities);

// Check-in workflow
router.get('/checkin/search', protect, isHotelManager, searchReservationsForCheckIn);
router.get('/checkin/:id', protect, isHotelManager, getReservationForCheckIn);
router.post('/checkin/:id/confirm', protect, isHotelManager, confirmCheckIn);

// Checkout workflow
router.get('/checkout/find-room', protect, isHotelManager, findStayByRoomNumberForCheckout);
router.post('/checkout/:stayId/create-payment', protect, isHotelManager, createCheckoutPayment);
router.post('/checkout/:stayId/confirm', protect, isHotelManager, confirmCheckout);

// Stay service management
router.post('/stays/:stayId/rooms/:roomId/services', protect, isHotelManager, addServiceToRoomInStay);
router.get('/hotels/:hotelId/services', protect, isHotelManager, listHotelServices);

module.exports = router;
