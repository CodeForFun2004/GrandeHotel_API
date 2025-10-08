const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const {
  changePassword
} = require('../controllers/password.controller');

// @route   POST /api/password/change
// @desc    Đổi mật khẩu cho người dùng đã đăng nhập
// @access  Private
router.post('/change', protect, changePassword);



module.exports = router; 