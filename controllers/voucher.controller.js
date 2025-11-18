// controllers/voucher.controller.js
const Voucher = require('../models/voucher.model');
const mongoose = require('mongoose');

// Helper: check admin quyền
function ensureAdmin(req, res) {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ message: 'Access denied. Admin only.' });
    return false;
  }
  return true;
}

// [CREATE] Admin tạo voucher
exports.createVoucher = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minBookingValue,
      scope,
      hotelIds,
      startDate,
      endDate,
      maxUsageGlobal,
      maxUsagePerUser,
      status,
      isLock
    } = req.body;

    if (!code || !name || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required voucher information.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid startDate or endDate.' });
    }
    if (end < start) {
      return res.status(400).json({ message: 'endDate must be greater than or equal to startDate.' });
    }

    const existing = await Voucher.findOne({ code: code.trim().toUpperCase() });
    if (existing) {
      return res.status(409).json({ message: 'Voucher code already exists.' });
    }

    const voucherPayload = {
      code: code.trim().toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      maxDiscount: maxDiscount ?? null,
      minBookingValue: minBookingValue ?? 0,
      scope: scope || 'global',
      startDate: start,
      endDate: end,
      maxUsageGlobal: maxUsageGlobal ?? 0,
      maxUsagePerUser: maxUsagePerUser ?? 0,
      status: status || 'active',
      isLock: !!isLock,
      createdBy: req.user?._id
    };

    if (voucherPayload.scope === 'multi-hotel' && Array.isArray(hotelIds) && hotelIds.length > 0) {
      voucherPayload.hotelIds = hotelIds;
    } else {
      voucherPayload.hotelIds = [];
    }

    const voucher = await Voucher.create(voucherPayload);

    return res.status(201).json({
      message: 'Voucher created successfully.',
      voucher
    });
  } catch (error) {
    console.error('[CREATE_VOUCHER] Error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};

// [READ] Lấy danh sách voucher (admin xem)
exports.getVouchers = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const {
      status,
      code,
      scope,
      isLock,
      hotelId,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }
    if (typeof isLock !== 'undefined') {
      query.isLock = isLock === 'true';
    }
    if (scope) {
      query.scope = scope;
    }
    if (code) {
      query.code = { $regex: code.trim(), $options: 'i' };
    }
    if (hotelId && mongoose.isValidObjectId(hotelId)) {
      query.$or = [
        { scope: 'global' },
        {
          scope: 'multi-hotel',
          hotelIds: { $in: [hotelId] }
        }
      ];
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 20;

    const [items, total] = await Promise.all([
      Voucher.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Voucher.countDocuments(query)
    ]);

    return res.status(200).json({
      data: items,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('[GET_VOUCHERS] Error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};

// [READ] Lấy chi tiết một voucher theo ID
exports.getVoucherById = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid voucher id.' });
    }

    const voucher = await Voucher.findById(id);

    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found.' });
    }

    return res.status(200).json(voucher);
  } catch (error) {
    console.error('[GET_VOUCHER_BY_ID] Error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};

// [UPDATE] Admin chỉnh sửa voucher
exports.updateVoucher = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid voucher id.' });
    }

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found.' });
    }

    // Nếu đã khóa thì chỉ cho đổi isLock, status, description (tùy business)
    if (voucher.isLock) {
      const { isLock, status, description } = req.body || {};
      voucher.isLock = typeof isLock === 'boolean' ? isLock : voucher.isLock;
      if (status) voucher.status = status;
      if (typeof description !== 'undefined') voucher.description = description;

      await voucher.save();

      return res.status(200).json({
        message: 'Locked voucher updated (limited fields).',
        voucher
      });
    }

    // Nếu chưa khóa: cho update full (trừ code cho an toàn)
    const updatableFields = [
      'name',
      'description',
      'discountType',
      'discountValue',
      'maxDiscount',
      'minBookingValue',
      'scope',
      'hotelIds',
      'startDate',
      'endDate',
      'maxUsageGlobal',
      'maxUsagePerUser',
      'status',
      'isLock'
    ];

    updatableFields.forEach(field => {
      if (typeof req.body[field] !== 'undefined') {
        voucher[field] = req.body[field];
      }
    });

    // Validate startDate <= endDate nếu có sửa
    if (voucher.startDate && voucher.endDate && voucher.endDate < voucher.startDate) {
      return res.status(400).json({
        message: 'endDate must be greater than or equal to startDate.'
      });
    }

    // Nếu scope != multi-hotel thì xóa hotelIds
    if (voucher.scope !== 'multi-hotel') {
      voucher.hotelIds = [];
    }

    await voucher.save();

    return res.status(200).json({
      message: 'Voucher updated successfully.',
      voucher
    });
  } catch (error) {
    console.error('[UPDATE_VOUCHER] Error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};

// [SOFT DELETE] Admin "xóa" voucher (set inactive + lock)
exports.deleteVoucher = async (req, res) => {
  try{
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid voucher id.' });
    }

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found.' });
    }

    voucher.status = 'inactive';
    voucher.isLock = true;

    await voucher.save();

    return res.status(200).json({
      message: 'Voucher has been deactivated and locked (soft delete).',
      voucher
    });
  } catch (error) {
    console.error('[DELETE_VOUCHER] Error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};

// [LOCK / UNLOCK] Admin khóa/mở khóa voucher nhanh
exports.toggleLockVoucher = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;
    const { isLock } = req.body; // true / false

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid voucher id.' });
    }

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found.' });
    }

    voucher.isLock = !!isLock;
    await voucher.save();

    return res.status(200).json({
      message: `Voucher has been ${voucher.isLock ? 'locked' : 'unlocked'}.`,
      voucher
    });
  } catch (error) {
    console.error('[TOGGLE_LOCK_VOUCHER] Error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};
