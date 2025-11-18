// services/voucher.service.js
const Voucher = require('../models/voucher.model');
const Reservation = require('../models/reservationModel'); // đúng tên file model của bạn

async function applyVoucherIfValid({
  voucherCode,
  hotelId,
  customerId,
  totalPrice
}) {
  if (!voucherCode) {
    return {
      voucher: null,
      discountAmount: 0,
      finalTotalPrice: totalPrice,
      message: null
    };
  }

  const now = new Date();
  const code = voucherCode.trim().toUpperCase();

  const voucher = await Voucher.findOne({
    code,
    status: 'active', // chỉ voucher đang active
    startDate: { $lte: now },
    endDate: { $gte: now }
  });

  if (!voucher) {
    return {
      voucher: null,
      discountAmount: 0,
      finalTotalPrice: totalPrice,
      message: 'Voucher không tồn tại hoặc đã hết hạn.'
    };
  }

  // 🔐 Check nếu voucher bị Admin khóa
  if (voucher.isLock) {
    return {
      voucher: null,
      discountAmount: 0,
      finalTotalPrice: totalPrice,
      message: 'Voucher đang bị tạm khóa. Vui lòng thử lại sau.'
    };
  }

  // Check phạm vi áp dụng khách sạn
  if (voucher.scope === 'multi-hotel') {
    if (!hotelId) {
      return {
        voucher: null,
        discountAmount: 0,
        finalTotalPrice: totalPrice,
        message: 'Thiếu thông tin khách sạn để áp dụng voucher.'
      };
    }

    const isAllowed = voucher.hotelIds.some(
      (hid) => hid.toString() === hotelId.toString()
    );
    if (!isAllowed) {
      return {
        voucher: null,
        discountAmount: 0,
        finalTotalPrice: totalPrice,
        message: 'Voucher không áp dụng cho khách sạn này.'
      };
    }
  }

  // Check min booking value
  if (voucher.minBookingValue && totalPrice < voucher.minBookingValue) {
    return {
      voucher: null,
      discountAmount: 0,
      finalTotalPrice: totalPrice,
      message: 'Đơn đặt phòng chưa đạt giá trị tối thiểu để áp dụng voucher.'
    };
  }

  // Check số lượt dùng global
  if (voucher.maxUsageGlobal && voucher.maxUsageGlobal > 0) {
    const usedGlobal = await Reservation.countDocuments({
      voucher: voucher._id,
      status: { $nin: ['canceled', 'rejected'] }
    });

    if (usedGlobal >= voucher.maxUsageGlobal) {
      return {
        voucher: null,
        discountAmount: 0,
        finalTotalPrice: totalPrice,
        message: 'Voucher đã hết lượt sử dụng.'
      };
    }
  }

  // Check số lượt dùng theo user
  if (voucher.maxUsagePerUser && voucher.maxUsagePerUser > 0 && customerId) {
    const usedByUser = await Reservation.countDocuments({
      voucher: voucher._id,
      customer: customerId,
      status: { $nin: ['canceled', 'rejected'] }
    });

    if (usedByUser >= voucher.maxUsagePerUser) {
      return {
        voucher: null,
        discountAmount: 0,
        finalTotalPrice: totalPrice,
        message: 'Bạn đã sử dụng voucher này tối đa số lần cho phép.'
      };
    }
  }

  // Tính tiền giảm
  let discountAmount = 0;
  if (voucher.discountType === 'percent') {
    discountAmount = Math.round((totalPrice * voucher.discountValue) / 100);
    if (voucher.maxDiscount && voucher.maxDiscount > 0) {
      discountAmount = Math.min(discountAmount, voucher.maxDiscount);
    }
  } else if (voucher.discountType === 'fixed') {
    discountAmount = voucher.discountValue;
  }

  discountAmount = Math.min(discountAmount, totalPrice);
  const finalTotalPrice = totalPrice - discountAmount;

  return {
    voucher,
    discountAmount,
    finalTotalPrice,
    message: null
  };
}

// 👇 Quan trọng: phải export đúng kiểu này
module.exports = {
  applyVoucherIfValid
};
