const express = require('express');
const router = express.Router();
const passport = require('passport');
require('../config/passport');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');

const {
  registerRequest,
  verifyRegister,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

// Đăng ký
router.post('/register-request', registerRequest);
router.post('/verify-register', verifyRegister);

// Đăng nhập
router.post('/login', login);

// Làm mới access token
router.post('/refresh', refreshAccessToken);

// Đăng xuất
router.post('/logout', protect, logout);

// ✅ Google OAuth - Chỉ cần 'profile' và 'email'
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// ✅ Callback sau khi Google xác thực
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: "http://localhost:5173/login?error=google" }),
  async (req, res) => {
    try {
      const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');

      // req.user do passport-google đã upsert xong
      const accessToken = generateAccessToken(req.user);
      const refreshToken = generateRefreshToken(req.user);

      // lưu refresh token vào DB user
      req.user.refreshToken = refreshToken;
      await req.user.save();

      // Tạo payload nhẹ gọn (chỉ field cần hiển thị nhanh)
      const payload = {
        accessToken,
        refreshToken,
        user: {
          id: req.user._id,
          email: req.user.email,
          username: req.user.username,
          avatar: req.user.avatar,
        },
      };

      // chuyển payload qua hash để tránh ghi log query
      const encoded = encodeURIComponent(JSON.stringify(payload));
     // const fe = process.env.FRONTEND_URL; // ví dụ: http://localhost:5173 hoặc https://your-fe-domain
     const fe = "http://localhost:5173";
      return res.redirect(`${fe}/auth/callback#data=${encoded}`);
    } catch (err) {
      console.error('Google callback error:', err);
      return res.redirect(process.env.FRONTEND_URL + '/login?error=google');
    }
  }
);


// Test UI
// router.get(
//   '/google/callback',
//   passport.authenticate('google', { session: false, failureRedirect: '/login' }),
//   async (req, res) => {
//     const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');

//     const accessToken = generateAccessToken(req.user);
//     const refreshToken = generateRefreshToken(req.user);

//     req.user.refreshToken = refreshToken;
//     await req.user.save();

//     // ✅ Redirect về FE với token đính kèm
//     const frontendURL = 'https://chat-app-ui-ds3i.onrender.com'; // hoặc domain FE thật của bạn
//     res.redirect(`${frontendURL}/oauth-success?accessToken=${accessToken}&refreshToken=${refreshToken}`);
//   }
// );


// @route   POST /api/password/forgot
// @desc    Gửi OTP qua email để khôi phục mật khẩu
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST /api/password/reset
// @desc    Đặt lại mật khẩu bằng OTP
// @access  Public
router.post('/reset-password', resetPassword);



module.exports = router;
