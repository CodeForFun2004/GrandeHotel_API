const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getCurrentUser,
  filterUsersByRole,
  getUserOrderHistory,
  suspendUser,
  unsuspendUser,
  getAllStaff,
  createStaff,
  getStaffById,
  updateStaff,
  deleteStaff, 
  updateUserAvatar
} = require('../controllers/user.controller');

const { protect, isAdmin } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');             //upload cloudinary
const User = require('../models/user.model');
const uploadUserAvatar = upload({
  folderPrefix: 'grand-hotel/avatars/users',
  model: User,
  nameField: 'username'
});

// @route   GET /api/users
// @desc    Lấy danh sách tất cả người dùng (admin)
// @access  Private/Admin
router.get('/', protect, isAdmin, getAllUsers);

// @route   POST /api/users
// @desc    Tạo người dùng mới (admin sử dụng)
// @access  Private/Admin
router.post('/', protect, isAdmin, createUser);

// @route   GET /api/users/me
// @desc    Lấy thông tin cá nhân đã đăng nhập
// @access  Private
router.get('/me', protect, getCurrentUser);

// @route   GET /api/users/me/orders
// @desc    Xem lịch sử đơn hàng của người dùng hiện tại
// @access  Private
router.get('/me/orders', protect, getUserOrderHistory);

// admin filter user by role, đặt trước getUserById vì nó liên quan đến thứ tự định nghĩa
router.get('/filter', protect, isAdmin, filterUsersByRole);

// @route   GET /api/users/:id
// @desc    Lấy thông tin người dùng theo ID
// @access  Private (admin hoặc chính mình)
router.get('/:id', protect, getUserById);

// @route   PUT /api/users/:id
// @desc    Cập nhật thông tin người dùng
// @access  Private (admin hoặc chính mình)
// router.put('/:id', upload.single('avatar'), updateUser);

// update user avatar only
router.put('/:id/avatar', protect, uploadUserAvatar.single('avatar'), updateUserAvatar);

router.put('/:id', protect, uploadUserAvatar.single('avatar'), updateUser);



// @route   DELETE /api/users/:id
// @desc    Xóa người dùng
// @access  Private/Admin
router.delete('/:id', protect, isAdmin, deleteUser);

// @route   PUT /api/users/:id/suspend
// @desc    Khóa hoặc tạm ngưng người dùng
// @access  Private/Admin
router.put('/suspend/:id', protect, isAdmin, suspendUser)

// @route   PUT /api/users/unsuspend/:id
// @desc    Mở khóa người dùng
// @access  Private/Admin
router.put('/unsuspend/:id', protect, isAdmin, unsuspendUser);

// @route   GET /api/staff
// @desc    Lấy danh sách tất cả staff/shipper
// @access  Private/Admin
router.get('/admin/staff', protect, isAdmin, getAllStaff);

// @route   POST /api/staff
// @desc    Tạo tài khoản staff/shipper mới
// @access  Private/Admin
router.post('/admin/staff', protect, isAdmin, createStaff);

// @route   GET /api/staff/:id
// @desc    Lấy thông tin chi tiết của staff/shipper
// @access  Private/Admin
router.get('/admin/staff/:id', protect, isAdmin, getStaffById);

// @route   PUT /api/staff/:id
// @desc    Cập nhật thông tin staff/shipper
// @access  Private/Admin
router.put('/admin/staff/:id', uploadUserAvatar.single('avatar'), protect, isAdmin, updateStaff);

// @route   DELETE /api/staff/:id
// @desc    Xóa tài khoản staff/shipper
// @access  Private/Admin
router.delete('/admin/staff/:id', protect, isAdmin, deleteStaff);

// @route   DELETE /api/users/:id
// @desc    Xóa người dùng
// @access  Private/Admin
router.delete('/admin/:id', protect, isAdmin, deleteUser);

module.exports = router;
