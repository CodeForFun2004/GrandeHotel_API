const User = require('../models/user.model');
const Otp = require('../models/otp.model');
const bcrypt = require('bcryptjs');
const { generateOTP } = require('../utils/generateOTP');
const { sendOTPEmail, sendResetPasswordEmail } = require('../services/email.service');

// Đổi mật khẩu (người dùng đã đăng nhập)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.user.id;

    // Kiểm tra thiếu dữ liệu
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin: mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới' });
    }

    // Thêm bước kiểm tra mật khẩu mới và xác nhận mật khẩu mới có khớp nhau không
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'Mật khẩu mới và mật khẩu xác nhận không khớp' });
    }
    
    // Tìm user từ database (bao gồm password)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword; // Mật khẩu sẽ được hash trong pre-save hook
    await user.save();

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

