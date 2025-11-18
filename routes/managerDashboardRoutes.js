const express = require('express');
const router = express.Router();
const {
  getKPIs,
  getRevenueSeries,
  getBookingStatus,
  getTopServices
} = require('../controllers/managerDashboardController');
const { protect, isHotelManager } = require('../middlewares/auth.middleware');

// All routes require authentication and hotel-manager role
router.use(protect);
router.use(isHotelManager);

// Manager dashboard routes
router.get('/kpis', getKPIs);
router.get('/revenue-series', getRevenueSeries);
router.get('/booking-status', getBookingStatus);
router.get('/top-services', getTopServices);

module.exports = router;

