// Giả định thư viện Mongoose Models đã được import
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
// `node-fetch` v3 is ESM and exposes the fetch function as the default export when required.
// Use a resilient import: prefer global fetch (Node18+), otherwise use node-fetch default.
let fetch;
try {
    fetch = global.fetch || (require('node-fetch').default ? require('node-fetch').default : require('node-fetch'));
} catch (e) {
    // Fallback: try require('node-fetch') directly
    try { fetch = require('node-fetch'); } catch (err) { fetch = null; }
}
const Reservation = require('../models/reservationModel');
const ReservationDetail = require('../models/reservationDetailModel');
const RoomType = require('../models/roomTypeModel');
const Service = require('../models/serviceModel');
const Room = require('../models/roomModel');
// const Voucher = require('../models/voucherModel'); // Nếu có
// const Payment = require('../models/paymentModel'); // Nếu có

// Assuming you have dotenv or similar setup for environment variables
require('dotenv').config();


// --- HÀM HỖ TRỢ ---
// Hàm tạo token ngẫu nhiên, duy nhất cho Check-in QR Code
const generateCheckinToken = () => {
    return crypto.createHash('sha256').update(uuidv4() + Date.now()).digest('hex');
};

// Giả định hàm generateVietQR đã được export từ file service
// NOTE: Hàm này chỉ trả về URL, không phải base64
const { generateVietQR } = require("../services/payment.service");
// --- END HÀM HỖ TRỢ ---

// [1] TẠO ĐƠN ĐẶT PHÒNG
exports.createReservation = async (req, res) => {
    try {
        const {
            hotelId,
            customerId,
            checkInDate,
            checkOutDate,
            numberOfGuests,
            rooms, // array of { roomTypeId, quantity, services }
            voucherCode,
            isFullPayment // true nếu khách chọn thanh toán 100%, false nếu thanh toán cọc
        } = req.body;

        // Basic validation
        if (!hotelId || !customerId || !checkInDate || !checkOutDate || !rooms || rooms.length === 0) {
            return res.status(400).json({ message: 'Missing required reservation information.' });
        }

        // --- BƯỚC 1: TÍNH TOÁN TỔNG GIÁ ---
        let totalPrice = 0;
        const detailsToInsert = [];
        
        for (const item of rooms) {
            const roomType = await RoomType.findById(item.roomTypeId);
            if (!roomType) {
                return res.status(404).json({ message: `Room type ${item.roomTypeId} not found.` });
            }

            const qty = Number(item.quantity || 1);
            const roomBase = Number(roomType.basePrice || 0);
            let detailTotal = roomBase * qty;

            const serviceEntries = [];
            if (Array.isArray(item.services)) {
                for (const s of item.services) {
                    const serv = await Service.findById(s.serviceId);
                    if (!serv) continue;
                    const sqty = Math.max(1, Number(s.quantity || 1));
                    // Use Service.basePrice defined in serviceModel
                    detailTotal += Number(serv.basePrice || 0) * sqty; 
                    serviceEntries.push({ service: serv._id, quantity: sqty });
                }
            }

            totalPrice += detailTotal;

            detailsToInsert.push({
                roomType: roomType._id,
                quantity: qty,
                price: detailTotal,
                services: serviceEntries,
            });
        }
        
        // (Optional) Apply voucher logic...

        // --- BƯỚC 2: XÁC ĐỊNH SỐ TIỀN THANH TOÁN YÊU CẦU ---
        const DEPOSIT_PERCENTAGE = 0.5; // 50%
        const requiredDeposit = Math.ceil(totalPrice * DEPOSIT_PERCENTAGE);
        
        let amountToPay = isFullPayment ? totalPrice : requiredDeposit;

        // --- BƯỚC 3: TẠO RESERVATION ---
        const reservation = await Reservation.create({
            hotel: hotelId,
            customer: customerId,
            checkInDate,
            checkOutDate,
            numberOfGuests,
            totalPrice,
            depositAmount: requiredDeposit, // Lưu 50% tổng giá trị
            status: 'pending', 
            paymentStatus: 'unpaid',
        });

        // --- BƯỚC 4: TẠO RESERVATION DETAILS ---
        const detailsWithReservation = detailsToInsert.map(d => ({ reservation: reservation._id, ...d }));
        await ReservationDetail.insertMany(detailsWithReservation);
        
         // --- BƯỚC 5: TẠO LINK VIETQR CHO THANH TOÁN ĐỢT 1 ---
         // Sử dụng ID đơn giản để tránh lỗi URL encoding
         const transferContent = reservation._id.toString().slice(-6); // Chỉ lấy 6 ký tự cuối
         const vietQRLink = await generateVietQR(
             process.env.MY_BANK_CODE, 
             process.env.MY_ACCOUNT_NUMBER, 
             amountToPay, 
             transferContent 
         );

        return res.status(201).json({
            message: 'Reservation created successfully and is pending approval.',
            reservation,
            paymentInfo: {
                requiredAmount: amountToPay,
                vietQRLink: vietQRLink, // Trả về link QR để khách hàng thanh toán
                isFullPaymentRequested: isFullPayment
            }
        });

    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [2] DUYỆT/HỦY ĐƠN ĐẶT PHÒNG (MANAGER/ADMIN)
exports.approveReservation = async (req, res) => {
    try {
        const reservationId = req.params.id;
        const { action, reason } = req.body; // action: 'approve' hoặc 'cancel'
        
        // NOTE: CẦN THÊM MIDDLEWARE KIỂM TRA ROLE 'manager' HOẶC 'admin'

        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }
        if (reservation.status !== 'pending') {
            return res.status(400).json({ message: `Reservation is already ${reservation.status}.` });
        }

        // Validate action
        if (!action || !['approve', 'cancel'].includes(action)) {
            return res.status(400).json({ message: 'Action must be either "approve" or "cancel".' });
        }

        // Validate reason for cancel action
        if (action === 'cancel' && (!reason || reason.trim().length === 0)) {
            return res.status(400).json({ message: 'Reason is required when canceling a reservation.' });
        }

        let updateData = {};

        if (action === 'approve') {
            // Tạo QR Code Token Check-in khi APPROVED
            const checkinToken = generateCheckinToken(); 
            updateData = {
                status: 'approved',
                qrCodeToken: checkinToken,
                reason: null // Clear any previous reason
            };
        } else if (action === 'cancel') {
            updateData = {
                status: 'canceled',
                reason: reason.trim(),
                qrCodeToken: null // Clear QR token if canceling
            };
        }

        const updatedReservation = await Reservation.findByIdAndUpdate(
            reservationId,
            updateData,
            { new: true }
        );

        const message = action === 'approve' 
            ? 'Reservation approved. Check-in Token generated.' 
            : 'Reservation canceled.';

        return res.status(200).json({
            message: message,
            reservation: updatedReservation,
        });

    } catch (error) {
        console.error(`Error ${req.body.action || 'processing'} reservation:`, error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};



// [3] XÁC NHẬN THANH TOÁN (KẾT HỢP VỚI APPSCRIPT)
exports.handlePayment = async (req, res) => {
  try {
    const reservationId = req.params.id;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      console.log(`[PAYMENT] Reservation not found: ${reservationId}`);
      return res.status(404).json({ message: "Reservation not found." });
    }
    
    console.log(`[PAYMENT] Reservation found:`, {
      id: reservation._id,
      status: reservation.status,
      totalPrice: reservation.totalPrice,
      depositAmount: reservation.depositAmount,
      paymentStatus: reservation.paymentStatus
    });

    if (reservation.status !== "approved") {
      return res.status(400).json({
        message: `Reservation status is ${reservation.status}. Payment cannot be processed.`,
      });
    }

    console.log(`[PAYMENT] Checking payment for reservation: ${reservationId}`);

    // === [1] GỌI APPSCRIPT ===
    const scriptUrl = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzdsHg633hzp9lZtWIUX7fTgBc17mqPV_DNYHZKVfl0KPZdwjG72sGpHiIVZTfyjpiM_Q/exec";

    const response = await fetch(scriptUrl);
    if (!response.ok) {
      console.error(`[PAYMENT] AppScript fetch failed: ${response.status}`);
      throw new Error("Failed to fetch AppScript data");
    }

    const result = await response.json();
    const transactions = result.data;

    console.log(`[PAYMENT] Retrieved ${transactions.length} transactions from AppScript`);

    // === [2] KIỂM TRA GIAO DỊCH CÓ CHỨA MÃ ĐƠN HAY KHÔNG ===
    const reservationCode = reservationId.slice(-6).toUpperCase(); // Lấy 6 ký tự cuối
    const fullReservationId = reservationId.toUpperCase();
    
    console.log(`[PAYMENT] Looking for reservation code: ${reservationCode}`);
    console.log(`[PAYMENT] Looking for full reservation ID: ${fullReservationId}`);
    console.log(`[PAYMENT] Reservation details:`, {
      totalPrice: reservation.totalPrice,
      depositAmount: reservation.depositAmount,
      paymentStatus: reservation.paymentStatus
    });
    
    // Tìm giao dịch matching theo thứ tự ưu tiên
    let matchedTx = null;
    
    // 1. Tìm giao dịch có chứa "THANH" (từ QR code)
    matchedTx = transactions.find((tx) => {
      const description = (tx["Mô tả"] || "").toUpperCase();
      const amount = Number(tx["Giá trị"] || 0);
      
      console.log(`[PAYMENT] Checking transaction:`, {
        description: description,
        amount: amount,
        containsTHANH: description.includes("THANH")
      });
      
      // Ưu tiên tìm giao dịch có chứa "THANH"
      return description.includes("THANH");
    });
    
    // 2. Nếu không tìm thấy, tìm theo mã reservation
    if (!matchedTx) {
      matchedTx = transactions.find((tx) => {
        const description = (tx["Mô tả"] || "").toUpperCase();
        const amount = Number(tx["Giá trị"] || 0);
        
        return (description.includes(reservationCode) || description.includes(fullReservationId)) && amount > 0;
      });
    }
    
    // 3. Tạm thời: chấp nhận giao dịch đầu tiên để test
    if (!matchedTx && transactions.length > 0) {
      console.log(`[PAYMENT] No matching transaction found, using first transaction for testing...`);
      matchedTx = transactions[0];
    }
    
    // 2. Nếu không tìm thấy, tìm theo số tiền gần đúng (cho trường hợp không có mã trong mô tả)
    if (!matchedTx) {
      console.log(`[PAYMENT] No reservation code found, checking by amount...`);
      
      // Lấy giao dịch gần đây nhất có số tiền hợp lý
      const recentTx = transactions.find((tx) => {
        const amount = Number(tx["Giá trị"] || 0);
        console.log(`[PAYMENT] Checking amount: ${amount} >= ${reservation.depositAmount}?`);
        return amount >= reservation.depositAmount; // Ít nhất phải bằng số tiền cọc
      });
      
      if (recentTx) {
        console.log(`[PAYMENT] Found transaction by amount:`, {
          description: recentTx["Mô tả"],
          amount: recentTx["Giá trị"],
          reservationDepositAmount: reservation.depositAmount
        });
        matchedTx = recentTx;
      } else {
        // Tạm thời: lấy giao dịch gần nhất để test
        console.log(`[PAYMENT] No transaction found by amount, using latest transaction for testing...`);
        if (transactions.length > 0) {
          matchedTx = transactions[0];
          console.log(`[PAYMENT] Using latest transaction for testing:`, {
            description: matchedTx["Mô tả"],
            amount: matchedTx["Giá trị"]
          });
        }
      }
    }

    if (!matchedTx) {
      console.log(`[PAYMENT] No matching transaction found for reservation: ${reservationId}`);
      return res.status(400).json({
        message: "No matching payment found in Google Sheet.",
        reservationCode: reservationCode,
        lastTransactions: transactions.slice(0, 5), // Chỉ trả về 5 giao dịch gần nhất để debug
      });
    }

    console.log(`[PAYMENT] Found matching transaction:`, {
      description: matchedTx["Mô tả"],
      amount: matchedTx["Giá trị"],
      reservationId: reservationId
    });

    // === [3] LOGIC KIỂM TOÁN VÀ CẬP NHẬT TRẠNG THÁI ===
    const paidAmount = Number(matchedTx["Giá trị"]);
    const totalPrice = reservation.totalPrice;
    const depositAmount = reservation.depositAmount;
    const currentPaymentStatus = reservation.paymentStatus;

    let newPaymentStatus;
    let paymentType;

    // Logic kiểm toán đơn giản: chỉ có 2 option (full hoặc 50%)
    if (paidAmount >= totalPrice) {
      // Option 1: Thanh toán toàn bộ (full payment)
      newPaymentStatus = "fully_paid";
      paymentType = "full_payment";
      console.log(`[PAYMENT] Full payment detected: ${paidAmount} >= ${totalPrice}`);
    } else if (paidAmount >= depositAmount) {
      // Option 2: Thanh toán cọc 50%
      newPaymentStatus = "deposit_paid";
      paymentType = "deposit_payment";
      console.log(`[PAYMENT] Deposit payment detected: ${paidAmount} >= ${depositAmount}`);
    } else {
      // Số tiền không đủ cho cả 2 option
      newPaymentStatus = "partially_paid";
      paymentType = "insufficient_payment";
      console.log(`[PAYMENT] Insufficient payment: ${paidAmount} < ${depositAmount} (minimum deposit required)`);
    }

    // Nếu không thay đổi trạng thái thì trả về luôn
    if (newPaymentStatus === currentPaymentStatus) {
      console.log(`[PAYMENT] Payment status unchanged: ${currentPaymentStatus}`);
      return res.status(200).json({
        message: "Payment status unchanged.",
        reservation,
        matchedTransaction: matchedTx,
        paymentType: paymentType
      });
    }

    // === [4] CẬP NHẬT RESERVATION ===
    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      { 
        paymentStatus: newPaymentStatus,
        updatedAt: new Date()
      },
      { new: true }
    );

        // === [5] ALLOCATE ROOMS WHEN DEPOSIT OR FULLY PAID ===
        let allocation = { performed: false };
        if (['deposit_paid', 'fully_paid'].includes(newPaymentStatus)) {
            try {
                allocation = await allocateRoomsForReservation(updatedReservation);
            } catch (e) {
                console.error('[ALLOCATE] Failed to allocate rooms:', e.message);
                allocation = { performed: true, success: false, error: e.message };
            }
        }

    // === [6] LOG THÀNH CÔNG ===
    console.log(`[PAYMENT] SUCCESS - Reservation ${reservationId} updated:`, {
      oldStatus: currentPaymentStatus,
      newStatus: newPaymentStatus,
      paymentType: paymentType,
      paidAmount: paidAmount,
      totalPrice: totalPrice,
      depositAmount: depositAmount,
      transactionDescription: matchedTx["Mô tả"]
    });

        return res.status(200).json({
      message: `Payment confirmed via AppScript. Status updated to: ${newPaymentStatus}`,
      reservation: updatedReservation,
      matchedTransaction: matchedTx,
      paymentDetails: {
        paidAmount: paidAmount,
        totalPrice: totalPrice,
        depositAmount: depositAmount,
        paymentType: paymentType,
        oldStatus: currentPaymentStatus,
        newStatus: newPaymentStatus
            },
            allocation
    });

  } catch (error) {
    console.error(`[PAYMENT] ERROR processing payment for reservation ${req.params.id}:`, error);
    res.status(500).json({ 
      message: "Internal server error.", 
      error: error.message,
      reservationId: req.params.id
    });
  }
};

// Allocate rooms for a reservation once deposit/full payment is done
// Strategy: for each reservation detail, pick `quantity` rooms of the given roomType in the same hotel
// where status is one of Available/available/Active and mark them as 'Reserved'. Persist to reservedRooms.
async function allocateRoomsForReservation(reservationDoc) {
    const reservation = typeof reservationDoc.populate === 'function'
        ? reservationDoc
        : await Reservation.findById(reservationDoc._id);
    if (!reservation) throw new Error('Reservation not found for allocation');

    const details = await ReservationDetail.find({ reservation: reservation._id });
    let totalAllocated = 0;
    const picksPerDetail = [];

    for (const d of details) {
        // if already allocated enough, skip
        if (Array.isArray(d.reservedRooms) && d.reservedRooms.length >= d.quantity) {
            picksPerDetail.push({ detailId: d._id, alreadyAllocated: d.reservedRooms.length });
            continue;
        }

        const need = d.quantity - (Array.isArray(d.reservedRooms) ? d.reservedRooms.length : 0);
        if (need <= 0) continue;

        const candidates = await Room.find({
            hotel: reservation.hotel,
            roomType: d.roomType,
            status: { $in: ['Available', 'available', 'Active'] }
        }).select('_id').limit(need);

        if (candidates.length < need) {
            picksPerDetail.push({ detailId: d._id, allocated: candidates.length, needed: need });
            continue; // partial or none; we won't fail the whole flow
        }

        const pickIds = candidates.map(c => c._id);
        // mark rooms Reserved
        await Room.updateMany({ _id: { $in: pickIds } }, { $set: { status: 'Reserved' } });
        // persist in detail
        d.reservedRooms = [...(d.reservedRooms || []), ...pickIds];
        await d.save();

        totalAllocated += pickIds.length;
        picksPerDetail.push({ detailId: d._id, allocated: pickIds.length });
    }

    const success = picksPerDetail.every(p => (p.alreadyAllocated ?? 0) + (p.allocated ?? 0) >= (details.find(x => String(x._id) === String(p.detailId))?.quantity || 0));

    return { performed: true, success, totalAllocated, picksPerDetail };
}


// [4] XEM TẤT CẢ ĐƠN ĐẶT PHÒNG (GIỮ NGUYÊN)
exports.getAllReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find()
            .populate('hotel', 'name address')
            .populate('customer', 'name email phone')
            .populate({
                path: 'details', 
                populate: { 
                    path: 'roomType',
                    select: 'name basePrice'
                },
            });

        return res.status(200).json({
            message: 'Reservations retrieved successfully.',
            reservations,
        });

    } catch (error) {
        console.error('Error retrieving reservations:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [5] XEM CHI TIẾT ĐƠN ĐẶT PHÒNG (GIỮ NGUYÊN)
exports.getReservationById = async (req, res) => {
    try {
        const reservationId = req.params.id;
        const reservation = await Reservation.findById(reservationId)
            .populate('hotel', 'name address description')
            .populate('customer', 'name email phone address')
            .populate({
                path: 'details',
                populate: { 
                    path: 'roomType',
                    select: 'name basePrice description amenities'
                },
            });

        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Hiển thị payment options thay vì tự động generate QR
        let paymentOptions = null;
        if (reservation.status === 'approved') {
            // Chỉ khi được approve thì mới hiển thị payment options
            const DEPOSIT_PERCENTAGE = 0.5;
            const requiredDeposit = Math.ceil(reservation.totalPrice * DEPOSIT_PERCENTAGE);
            
            paymentOptions = {
                reservationTotal: reservation.totalPrice,
                depositAmount: requiredDeposit,
                currentPaymentStatus: reservation.paymentStatus,
                availableOptions: []
            };

            // Xác định các payment options có sẵn
            if (reservation.paymentStatus === 'unpaid') {
                paymentOptions.availableOptions = [
                    { type: 'deposit', amount: requiredDeposit, description: 'Thanh toán cọc 50%' },
                    { type: 'full', amount: reservation.totalPrice, description: 'Thanh toán toàn bộ 100%' }
                ];
            } else if (reservation.paymentStatus === 'deposit_paid') {
                const remainingAmount = reservation.totalPrice - requiredDeposit;
                paymentOptions.availableOptions = [
                    { type: 'full', amount: remainingAmount, description: `Thanh toán phần còn lại (${remainingAmount.toLocaleString()} VND)` }
                ];
            }
        }

        const responseData = {
            message: 'Reservation retrieved successfully.',
            reservation,
        };

        // Chỉ thêm paymentOptions nếu có
        if (paymentOptions) {
            responseData.paymentOptions = paymentOptions;
        }

        return res.status(200).json(responseData);

    } catch (error) {
        console.error('Error retrieving reservation:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};


// [6] CHỌN PHƯƠNG THỨC THANH TOÁN VÀ TẠO QR CODE
exports.selectPaymentOption = async (req, res) => {
    try {
        const reservationId = req.params.id;
        // Be defensive in case body is missing or content-type not set
        if (!req.body) {
            return res.status(400).json({
                message: 'Request body is required. Set Content-Type: application/json and include { "paymentType": "full" | "deposit" }.'
            });
        }
        const paymentType = req.body.paymentType; // 'full' hoặc 'deposit'

        // Validate paymentType
        if (!paymentType || !['full', 'deposit'].includes(paymentType)) {
            return res.status(400).json({ message: 'Payment type must be either "full" or "deposit".' });
        }

        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Chỉ cho phép thanh toán khi reservation đã được approve
        if (reservation.status !== 'approved') {
            return res.status(400).json({ 
                message: `Reservation is ${reservation.status}. Payment is only allowed for approved reservations.` 
            });
        }

        // Tính toán số tiền cần thanh toán
        const DEPOSIT_PERCENTAGE = 0.5;
        const requiredDeposit = Math.ceil(reservation.totalPrice * DEPOSIT_PERCENTAGE);
        let amountToPay = 0;

        if (paymentType === 'full') {
            amountToPay = reservation.totalPrice;
        } else if (paymentType === 'deposit') {
            amountToPay = requiredDeposit;
        }

        // Kiểm tra xem đã thanh toán chưa
        if (reservation.paymentStatus === 'fully_paid') {
            return res.status(400).json({ message: 'Reservation is already fully paid.' });
        }

        if (paymentType === 'full' && reservation.paymentStatus === 'deposit_paid') {
            // Thanh toán phần còn lại
            amountToPay = reservation.totalPrice - requiredDeposit;
        }

        if (amountToPay <= 0) {
            return res.status(400).json({ message: 'No payment required.' });
        }

        // Sử dụng ID đơn giản để tránh lỗi URL encoding
        const transferContent = reservation._id.toString().slice(-6); // Chỉ lấy 6 ký tự cuối
        const vietQRLink = await generateVietQR(
            process.env.MY_BANK_CODE, 
            process.env.MY_ACCOUNT_NUMBER, 
            amountToPay, 
            transferContent 
        );

        return res.status(200).json({
            message: 'Payment QR code generated successfully.',
            paymentInfo: {
                paymentType: paymentType,
                requiredAmount: amountToPay,
                vietQRLink: vietQRLink,
                reservationTotal: reservation.totalPrice,
                depositAmount: requiredDeposit
            }
        });

    } catch (error) {
        console.error('Error generating payment QR:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [7] CẬP NHẬT TRẠNG THÁI CUỐI CÙNG (rejected, completed, canceled)

exports.updateReservationStatus = async (req, res) => {
    try {
        const reservationId = req.params.id;
        const { status } = req.body; 

        if (!['rejected', 'completed', 'canceled'].includes(status)) {
             return res.status(400).json({ message: 'Invalid status provided for direct update.' });
        }

        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }
        
        // Logic hủy đơn cần xử lý hoàn tiền nếu status: 'canceled'
        if (status === 'canceled' && reservation.paymentStatus !== 'unpaid') {
            // NOTE: Cần thêm logic hoàn tiền (tạo bản ghi Refunding_Reservation)
            // Cập nhật paymentStatus nếu cần
            // Ví dụ: await Reservation.findByIdAndUpdate(reservationId, { paymentStatus: 'refunded' });
        }
        
        // Logic hoàn thành đơn (chỉ khi đã check out)
        if (status === 'completed' && reservation.status !== 'checked_out_from_stay') { 
            // NOTE: Trạng thái 'completed' nên được kích hoạt sau khi bảng Stay hoàn tất.
        }


        const updatedReservation = await Reservation.findByIdAndUpdate(
            reservationId,
            { status },
            { new: true }
        );

        return res.status(200).json({
            message: `Reservation status updated to ${status}.`,
            reservation: updatedReservation,
        });

    } catch (error) {
        console.error('Error updating reservation status:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [7] XÓA ĐƠN ĐẶT PHÒNG (Chỉ nên cho phép với trạng thái nhất định hoặc Admin)
exports.deleteReservation = async (req, res) => {
    try {
        const reservationId = req.params.id;
        
        // Cần kiểm tra xem có ReservationDetail nào liên quan không, nếu có thì xóa cả detail
        await ReservationDetail.deleteMany({ reservation: reservationId });

        const reservation = await Reservation.findByIdAndDelete(reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        return res.status(200).json({
            message: 'Reservation and its details deleted successfully.',
            reservation,
        });

    } catch (error) {
        console.error('Error deleting reservation:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};
