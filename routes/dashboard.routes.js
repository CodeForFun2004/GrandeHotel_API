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
  listActiveStaysForCheckout,
  createCheckoutPayment,
  confirmCheckout,
  addServiceToRoomInStay,
  listHotelServices,
  listMyHotelServices,
  verifyCheckoutPayment
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
router.get('/checkin/search', protect, isStaff, searchReservationsForCheckIn);
router.get('/checkin/:id', protect, isStaff, getReservationForCheckIn);
router.post('/checkin/:id/confirm', protect, isStaff, confirmCheckIn);

// Checkout workflow
router.get('/checkout/inhouse', protect, isStaff, listActiveStaysForCheckout);
router.get('/checkout/find-room', protect, isStaff, findStayByRoomNumberForCheckout);
router.post('/checkout/:stayId/create-payment', protect, isStaff, createCheckoutPayment);
router.post('/checkout/:stayId/verify-payment', protect, isStaff, verifyCheckoutPayment);
router.post('/checkout/:stayId/confirm', protect, isStaff, confirmCheckout);

// Stay service management
router.post('/stays/:stayId/rooms/:roomId/services', protect, isStaff, addServiceToRoomInStay);
// Add a room to an existing stay (check-in staff)
router.post('/stays/:stayId/rooms', protect, isStaff, async (req, res, next) => {
  // forward to controller method implemented below
  try {
    const dashboardController = require('../controllers/dashboardController');
    if (typeof dashboardController.addRoomToStay === 'function') return dashboardController.addRoomToStay(req, res, next);
    return res.status(501).json({ message: 'Not implemented' });
  } catch (e) { next(e); }
});
router.get('/hotels/:hotelId/services', protect, isStaff, listHotelServices);
// Route to get services for the authenticated user's hotel (manager or staff)
router.get('/hotels/services', protect, listMyHotelServices);

module.exports = router;
