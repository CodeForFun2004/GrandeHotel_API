const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRevenueData,
  getHotelPerformance,
  getBookingStatus,
  getUserStats,
  getRecentActivities
} = require('../controllers/dashboardController');

// Middleware imports
const { protect, isAdmin } = require('../middlewares/auth.middleware');

// All dashboard routes are protected and admin-only
router.get('/stats', protect, isAdmin, getDashboardStats);
router.get('/revenue', protect, isAdmin, getRevenueData);
router.get('/hotels/performance', protect, isAdmin, getHotelPerformance);
router.get('/bookings/status', protect, isAdmin, getBookingStatus);
router.get('/users/stats', protect, isAdmin, getUserStats);
router.get('/activities/recent', protect, isAdmin, getRecentActivities);

module.exports = router;
