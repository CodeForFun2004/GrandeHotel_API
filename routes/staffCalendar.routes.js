const express = require('express');
const router = express.Router();
const { getCalendarEvents } = require('../controllers/staffCalendarController');
const { protect, isStaff } = require('../middlewares/auth.middleware');

/**
 * GET /api/staff/calendar/events
 * Lấy danh sách các sự kiện trong khoảng thời gian cho staff calendar
 * 
 * Query Parameters:
 * - startDate: string (required) - ISO date "YYYY-MM-DD"
 * - endDate: string (required) - ISO date "YYYY-MM-DD"
 * - type?: "reservation" | "stay" | "maintenance" | "task" | "ALL" (default: "ALL")
 * - roomId?: string | number
 * - roomNumber?: string
 * - keyword?: string - Tìm kiếm trong mã RSV/STAY, số phòng, tên khách
 * 
 * Authentication: Required (JWT token với role 'staff')
 * Authorization: Staff must be assigned to a hotel (req.user.hotelId)
 */
router.get('/events', protect, isStaff, getCalendarEvents);

module.exports = router;

