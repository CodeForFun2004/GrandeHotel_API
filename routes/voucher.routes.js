const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucher.controller');
const { protect } = require('../middlewares/auth.middleware'); // middleware auth của bạn

// Tất cả route voucher đều require admin
router.post('/', protect, voucherController.createVoucher);
router.get('/', voucherController.getVouchers);
router.get('/:id', protect, voucherController.getVoucherById);
router.put('/:id', protect, voucherController.updateVoucher);
router.delete('/:id', protect, voucherController.deleteVoucher);
router.patch('/:id/lock', protect, voucherController.toggleLockVoucher);
// Lấy voucher theo code
router.get('/code/:code', protect, voucherController.getVoucherByCode);

module.exports = router;
