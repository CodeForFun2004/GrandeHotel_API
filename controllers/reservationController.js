// Giả định thư viện Mongoose Models đã được import
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
// Node.js 18+ có fetch built-in, không cần node-fetch
// Nếu Node.js < 18, có thể cần cài node-fetch v2: npm install node-fetch@2
const Reservation = require('../models/reservationModel');
const ReservationDetail = require('../models/reservationDetailModel');
const Payment = require('../models/paymentModel');
const RoomType = require('../models/roomTypeModel');
const Service = require('../models/serviceModel');

const Room = require('../models/roomModel');

const Conversation = require('../models/conversation');

// const Voucher = require('../models/voucherModel'); // Nếu có

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
            // customerId is ignored; we take customer from the authenticated token
            checkInDate,
            checkOutDate,
            numberOfGuests,
            rooms, // array of { roomTypeId, quantity, services }
            voucherCode,
            isFullPayment // true nếu khách chọn thanh toán 100%, false nếu thanh toán cọc
        } = req.body;

        // Business rule: must be logged in to create a reservation
        const authUser = req.user;
        if (!authUser || !authUser._id) {
            return res.status(401).json({ message: 'Authentication required to create reservation.' });
        }

        // Basic validation
        if (!hotelId || !checkInDate || !checkOutDate || !rooms || rooms.length === 0) {
            return res.status(400).json({ message: 'Missing required reservation information.' });
        }

        // Always take customer from token
        const finalCustomerId = authUser._id;

        // --- BƯỚC 1: TÍNH TOÁN TỔNG GIÁ ---
        let totalPrice = 0;
        const detailsToInsert = [];
        
        // Calculate number of nights from checkInDate and checkOutDate
        const msPerDay = 1000 * 60 * 60 * 24;
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const nights = Math.max(1, Math.round((checkOut - checkIn) / msPerDay));
        
        console.log('[CREATE_RESERVATION] Calculating total price:', {
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            checkIn: checkIn.toISOString(),
            checkOut: checkOut.toISOString(),
            nights: nights,
            msPerDay: msPerDay
        });
        
        for (const item of rooms) {
            const roomType = await RoomType.findById(item.roomTypeId);
            if (!roomType) {
                return res.status(404).json({ message: `Room type ${item.roomTypeId} not found.` });
            }

            const qty = Number(item.quantity || 1);
            const roomBase = Number(roomType.basePrice || 0);
            // Calculate total price: basePrice * quantity * nights
            let detailTotal = roomBase * qty * nights;
            
            console.log('[CREATE_RESERVATION] Room detail calculation:', {
                roomTypeId: item.roomTypeId,
                roomTypeName: roomType.name,
                roomBase: roomBase,
                quantity: qty,
                nights: nights,
                roomSubtotal: roomBase * qty * nights,
                detailTotalBeforeServices: detailTotal
            });

            const serviceEntries = [];
            if (Array.isArray(item.services)) {
                for (const s of item.services) {
                    const serv = await Service.findById(s.serviceId);
                    if (!serv) continue;
                    const sqty = Math.max(1, Number(s.quantity || 1));
                    // Use Service.basePrice defined in serviceModel
                    const servicePrice = Number(serv.basePrice || 0) * sqty;
                    detailTotal += servicePrice; 
                    serviceEntries.push({ service: serv._id, quantity: sqty });
                    console.log('[CREATE_RESERVATION] Service added:', {
                        serviceId: s.serviceId,
                        serviceName: serv.name,
                        serviceBasePrice: serv.basePrice,
                        serviceQuantity: sqty,
                        serviceTotal: servicePrice
                    });
                }
            }

            totalPrice += detailTotal;
            console.log('[CREATE_RESERVATION] Detail total after services:', {
                detailTotal: detailTotal,
                runningTotalPrice: totalPrice
            });

            detailsToInsert.push({
                roomType: roomType._id,
                quantity: qty,
                adults: Number(item.adults ?? 1),
                children: Number(item.children ?? 0),
                infants: Number(item.infants ?? 0),
                services: serviceEntries,
            });
        }
        
        // (Optional) Apply voucher logic...

        // --- BƯỚC 2: XÁC ĐỊNH SỐ TIỀN THANH TOÁN YÊU CẦU ---
        // Validate totalPrice before proceeding
        if (totalPrice <= 0) {
            console.error('[CREATE_RESERVATION] ERROR: Invalid totalPrice calculated:', {
                totalPrice: totalPrice,
                nights: nights,
                roomsCount: rooms.length
            });
            return res.status(400).json({ 
                message: 'Invalid total price calculated. Please check room prices and number of nights.' 
            });
        }
        
        const DEPOSIT_PERCENTAGE = 0.5; // 50%
        const requiredDeposit = Math.ceil(totalPrice * DEPOSIT_PERCENTAGE);
        
        let amountToPay = isFullPayment ? totalPrice : requiredDeposit;
        
        console.log('[CREATE_RESERVATION] Payment calculation:', {
            totalPrice: totalPrice,
            nights: nights,
            DEPOSIT_PERCENTAGE: DEPOSIT_PERCENTAGE,
            requiredDeposit: requiredDeposit,
            isFullPayment: isFullPayment,
            amountToPay: amountToPay,
            calculationFormula: 'totalPrice = basePrice * quantity * nights + services'
        });

        // --- BƯỚC 3: TẠO RESERVATION ---
        const reservation = await Reservation.create({
            hotel: hotelId,
            customer: finalCustomerId,
            checkInDate,
            checkOutDate,
            numberOfGuests,
            status: 'pending', 
        });

        // --- BƯỚC 4: TẠO PAYMENT ---
        // Double-check values before creating payment
        console.log('[CREATE_RESERVATION] Creating payment with values:', {
            reservationId: reservation._id,
            totalPrice: totalPrice,
            depositAmount: requiredDeposit,
            nights: nights,
            validation: {
                totalPriceIsValid: totalPrice > 0,
                depositAmountIsValid: requiredDeposit > 0,
                depositIsHalfOfTotal: Math.abs(requiredDeposit - (totalPrice * 0.5)) < 1
            }
        });
        
        const payment = await Payment.create({
            reservation: reservation._id,
            totalPrice,
            depositAmount: requiredDeposit, // Lưu 50% tổng giá trị
            paymentStatus: 'unpaid',
            paidAmount: 0
        });
        
        console.log('[CREATE_RESERVATION] Payment created successfully:', {
            paymentId: payment._id,
            totalPrice: payment.totalPrice,
            depositAmount: payment.depositAmount,
            paymentStatus: payment.paymentStatus,
            verification: {
                storedTotalPrice: payment.totalPrice,
                expectedTotalPrice: totalPrice,
                match: payment.totalPrice === totalPrice,
                storedDeposit: payment.depositAmount,
                expectedDeposit: requiredDeposit,
                depositMatch: payment.depositAmount === requiredDeposit
            }
        });

        // --- BƯỚC 5: TẠO RESERVATION DETAILS ---
        console.log('[CREATE_RESERVATION] Creating reservation details...', {
            reservationId: reservation._id,
            detailsCount: detailsToInsert.length,
            details: detailsToInsert.map(d => ({
                roomType: d.roomType,
                quantity: d.quantity
            }))
        });
        
        const detailsWithReservation = detailsToInsert.map(d => ({ reservation: reservation._id, ...d }));
        const insertedDetails = await ReservationDetail.insertMany(detailsWithReservation);
        
        console.log('[CREATE_RESERVATION] Reservation details created:', {
            insertedCount: insertedDetails.length,
            detailIds: insertedDetails.map(d => d._id)
        });

        // Allocate rooms immediately after reservation is created so reservedRooms is persisted
        let allocation = null;
        try {
            console.log('[CREATE_RESERVATION] Starting room allocation...', {
                reservationId: reservation._id,
                hotelId: reservation.hotel
            });
            allocation = await allocateRoomsForReservation(reservation);
            console.log('[CREATE_RESERVATION] Room allocation result:', allocation);
        } catch (allocErr) {
            console.error('[CREATE_RESERVATION] Allocation on creation failed:', {
                error: allocErr.message,
                stack: allocErr.stack,
                reservationId: reservation._id
            });
        }
        
        // --- BƯỚC 6: TẠO LINK VIETQR CHO THANH TOÁN ĐỢT 1 ---
         // Sử dụng ID đơn giản để tránh lỗi URL encoding
         const transferContent = reservation._id.toString().slice(-6); // Chỉ lấy 6 ký tự cuối
        const vietQRLink = await generateVietQR(
            process.env.MY_BANK_CODE, 
            process.env.MY_ACCOUNT_NUMBER, 
            amountToPay, 
             transferContent 
        );

    // Populate payment và customer vào reservation để trả về
    await reservation.populate('payment');
    await reservation.populate('customer', 'fullname username email phone');

        return res.status(201).json({
            message: 'Reservation created successfully and is pending approval.',
            reservation,
            paymentInfo: {
                requiredAmount: amountToPay,
                vietQRLink: vietQRLink, // Trả về link QR để khách hàng thanh toán
                isFullPaymentRequested: isFullPayment
            },
            allocation
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

                // Allocate rooms immediately upon approval so reservation details have reservedRooms
                // This addresses the issue where reservedRooms remained empty after confirming reservations.
                let allocation = null;
                if (action === 'approve') {
                    try {
                        allocation = await allocateRoomsForReservation(updatedReservation);
                    } catch (allocErr) {
                        console.warn('[APPROVE] Allocation failed after approval:', allocErr.message);
                    }
                }

        // Tạo Conversation nếu approved
        if (action === 'approve') {
          const existingConv = await Conversation.findOne({ reservation: updatedReservation._id });
          if (!existingConv) {
            const conv = new Conversation({
              threadId: `T-${updatedReservation._id}`,
              hotel: updatedReservation.hotel,
              customer: updatedReservation.customer,
              reservation: updatedReservation._id,
              lastMessageAt: new Date(),
              unread: 0,
              pinned: false
            });
            await conv.save();
          }
        }

        const message = action === 'approve'
            ? 'Reservation approved. Check-in Token generated.'
            : 'Reservation canceled.';

        return res.status(200).json({
            message: message,
            reservation: updatedReservation,
            allocation
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

    const reservation = await Reservation.findById(reservationId).populate('payment');
    if (!reservation) {
      console.log(`[PAYMENT] Reservation not found: ${reservationId}`);
      return res.status(404).json({ message: "Reservation not found." });
    }
    
    // Kiểm tra payment có tồn tại không
    if (!reservation.payment) {
      console.log(`[PAYMENT] Payment not found for reservation: ${reservationId}`);
      return res.status(404).json({ message: "Payment information not found for this reservation." });
    }
    
    const payment = reservation.payment;
    
    console.log(`[PAYMENT] Reservation found:`, {
      id: reservation._id,
      status: reservation.status,
      totalPrice: payment.totalPrice,
      depositAmount: payment.depositAmount,
      paymentStatus: payment.paymentStatus
    });

    if (reservation.status !== "approved") {
      return res.status(400).json({
        message: `Reservation status is ${reservation.status}. Payment cannot be processed.`,
      });
    }

    console.log(`[PAYMENT] Checking payment for reservation: ${reservationId}`);

    // === [1] GỌI APPSCRIPT ===
    const scriptUrl = process.env.APPSCRIPT_URL || "https://script.google.com/a/macros/fpt.edu.vn/s/AKfycbz1MKWMTywURK2WyT5kBCduwNBrxUOvaFI0KRZW5Wd8w5UtmXzuihUmxFGJwtNNIpx5qw/exec";

    console.log(`[PAYMENT] Calling AppScript URL: ${scriptUrl}`);
    
    // Gọi AppScript với redirect follow và kiểm tra response
    const response = await fetch(scriptUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    // Kiểm tra status code
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PAYMENT] AppScript fetch failed:`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        responsePreview: errorText.substring(0, 500)
      });
      throw new Error(`Failed to fetch AppScript data: ${response.status} ${response.statusText}`);
    }

    // Kiểm tra Content-Type trước khi parse JSON
    const contentType = response.headers.get('content-type') || '';
    console.log(`[PAYMENT] AppScript response Content-Type: ${contentType}`);
    
    if (!contentType.includes('application/json')) {
      // Nếu không phải JSON, log để debug
      const responseText = await response.text();
      console.error(`[PAYMENT] AppScript returned non-JSON response:`, {
        contentType: contentType,
        responsePreview: responseText.substring(0, 500),
        responseLength: responseText.length
      });
      
      // Thử parse nếu có thể (một số AppScript trả về JSON nhưng Content-Type sai)
      try {
        const result = JSON.parse(responseText);
        if (result && result.data) {
          console.log(`[PAYMENT] Successfully parsed JSON despite wrong Content-Type`);
          var transactions = result.data;
        } else {
          throw new Error("AppScript response is not valid JSON. Check AppScript deployment settings.");
        }
      } catch (parseError) {
        throw new Error(`AppScript returned HTML instead of JSON. Please check AppScript deployment settings. Response preview: ${responseText.substring(0, 200)}`);
      }
    } else {
      // Parse JSON bình thường
      const result = await response.json();
      var transactions = result.data;
    }

    console.log(`[PAYMENT] Retrieved ${transactions.length} transactions from AppScript`);

    // === [2] KIỂM TRA GIAO DỊCH CÓ CHỨA MÃ ĐƠN HAY KHÔNG ===
    const reservationCode = reservationId.slice(-6).toUpperCase(); // Lấy 6 ký tự cuối
    const fullReservationId = reservationId.toUpperCase();
    
    console.log(`[PAYMENT] Looking for reservation code: ${reservationCode}`);
    console.log(`[PAYMENT] Looking for full reservation ID: ${fullReservationId}`);
    console.log(`[PAYMENT] Reservation details:`, {
      totalPrice: payment.totalPrice,
      depositAmount: payment.depositAmount,
      paymentStatus: payment.paymentStatus
    });
    
    // Tìm giao dịch matching theo thứ tự ưu tiên
    // QUAN TRỌNG: Phải có mã reservation trong mô tả để đảm bảo an toàn
    let matchedTx = null;
    
    // 1. Ưu tiên: Tìm giao dịch có chứa "THANH" VÀ mã reservation (từ QR code)
    matchedTx = transactions.find((tx) => {
      const description = (tx["Mô tả"] || "").toUpperCase();
      const amount = Number(tx["Giá trị"] || 0);
      const hasThanh = description.includes("THANH");
      const hasReservationCode = description.includes(reservationCode) || description.includes(fullReservationId);
      
      console.log(`[PAYMENT] Checking transaction:`, {
        description: description,
        amount: amount,
        hasThanh: hasThanh,
        hasReservationCode: hasReservationCode,
        reservationCode: reservationCode
      });
      
      // Phải có CẢ "THANH" VÀ mã reservation
      return hasThanh && hasReservationCode && amount > 0;
    });
    
    // 2. Nếu không tìm thấy, tìm theo mã reservation (không cần "THANH")
    // Ưu tiên fullReservationId trước (chính xác hơn), sau đó mới đến reservationCode
    if (!matchedTx) {
      // Ưu tiên 1: Tìm theo fullReservationId (chính xác nhất)
      matchedTx = transactions.find((tx) => {
        const description = (tx["Mô tả"] || "").toUpperCase();
        const amount = Number(tx["Giá trị"] || 0);
        const hasFullId = description.includes(fullReservationId);
        
        console.log(`[PAYMENT] Checking transaction by full reservation ID:`, {
          description: description,
          amount: amount,
          hasFullId: hasFullId,
          fullReservationId: fullReservationId
        });
        
        return hasFullId && amount > 0;
      });
      
      // Ưu tiên 2: Nếu không tìm thấy, tìm theo reservationCode (6 ký tự cuối)
      if (!matchedTx) {
        matchedTx = transactions.find((tx) => {
          const description = (tx["Mô tả"] || "").toUpperCase();
          const amount = Number(tx["Giá trị"] || 0);
          const hasReservationCode = description.includes(reservationCode);
          
          console.log(`[PAYMENT] Checking transaction by reservation code (6 chars):`, {
            description: description,
            amount: amount,
            hasReservationCode: hasReservationCode,
            reservationCode: reservationCode
          });
          
          // QUAN TRỌNG: Phải có mã reservation trong mô tả
          return hasReservationCode && amount > 0;
        });
      }
    }
    
    // KHÔNG tìm theo số tiền nếu không có mã reservation - ĐÂY LÀ NGUYÊN NHÂN LỖI
    // Logic cũ: tìm theo số tiền chính xác → CÓ THỂ NHẬN NHẦM GIAO DỊCH CỦA RESERVATION KHÁC
    // Logic mới: CHỈ chấp nhận nếu có mã reservation trong mô tả để đảm bảo an toàn

    if (!matchedTx) {
      console.log(`[PAYMENT] No matching transaction found for reservation: ${reservationId}`);
      console.log(`[PAYMENT] Looking for:`, {
        reservationCode: reservationCode,
        fullReservationId: fullReservationId,
        totalPrice: payment.totalPrice,
        depositAmount: payment.depositAmount
      });
      console.log(`[PAYMENT] Total transactions checked: ${transactions.length}`);
      
      return res.status(400).json({
        message: "No matching payment found in Google Sheet. The transaction description must contain the reservation code.",
        reservationCode: reservationCode,
        fullReservationId: fullReservationId,
        expectedAmounts: {
          totalPrice: payment.totalPrice,
          depositAmount: payment.depositAmount
        },
        hint: "Make sure the bank transfer description contains the reservation code (last 6 characters) or full reservation ID.",
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
    const totalPrice = payment.totalPrice;
    const depositAmount = payment.depositAmount;
    const currentPaymentStatus = payment.paymentStatus;

    let newPaymentStatus;
    let paymentType;
    let newPaidAmount = payment.paidAmount + paidAmount; // Cộng dồn số tiền đã thanh toán

    // Logic kiểm toán đơn giản: chỉ có 2 option (full hoặc 50%)
    if (newPaidAmount >= totalPrice) {
      // Option 1: Thanh toán toàn bộ (full payment)
      newPaymentStatus = "fully_paid";
      paymentType = "full_payment";
      newPaidAmount = totalPrice; // Đảm bảo không vượt quá totalPrice
      console.log(`[PAYMENT] Full payment detected: ${newPaidAmount} >= ${totalPrice}`);
    } else if (newPaidAmount >= depositAmount) {
      // Option 2: Thanh toán cọc 50%
      newPaymentStatus = "deposit_paid";
      paymentType = "deposit_payment";
      console.log(`[PAYMENT] Deposit payment detected: ${newPaidAmount} >= ${depositAmount}`);
    } else {
      // Số tiền không đủ cho cả 2 option
      newPaymentStatus = "partially_paid";
      paymentType = "insufficient_payment";
      console.log(`[PAYMENT] Insufficient payment: ${newPaidAmount} < ${depositAmount} (minimum deposit required)`);
    }

    // Nếu không thay đổi trạng thái thì trả về luôn
    if (newPaymentStatus === currentPaymentStatus && newPaidAmount === payment.paidAmount) {
      console.log(`[PAYMENT] Payment status unchanged: ${currentPaymentStatus}`);
      return res.status(200).json({
        message: "Payment status unchanged.",
        reservation,
        matchedTransaction: matchedTx,
        paymentType: paymentType
      });
    }

    // === [4] CẬP NHẬT PAYMENT ===
    const updatedPayment = await Payment.findByIdAndUpdate(
      payment._id,
      { 
        paymentStatus: newPaymentStatus,
        paidAmount: newPaidAmount,
        updatedAt: new Date()
      },
      { new: true }
    );

        // Populate payment vào reservation
        const updatedReservation = await Reservation.findById(reservationId).populate('payment');

        // === [4.1] PHÂN BỔ PHÒNG KHI ĐẶT CỌC/THANH TOÁN ĐỦ ===
        let allocation = null;
        if (newPaymentStatus === 'deposit_paid' || newPaymentStatus === 'fully_paid') {
            try {
                allocation = await allocateRoomsForReservation(updatedReservation);
            } catch (allocErr) {
                console.warn('[PAYMENT] Allocation failed:', allocErr.message);
            }
        }

        // === [5] LOG THÀNH CÔNG ===
    console.log(`[PAYMENT] SUCCESS - Reservation ${reservationId} updated:`, {
      oldStatus: currentPaymentStatus,
      newStatus: newPaymentStatus,
      paymentType: paymentType,
      paidAmount: newPaidAmount,
      totalPrice: totalPrice,
      depositAmount: depositAmount,
      transactionDescription: matchedTx["Mô tả"]
    });
        return res.status(200).json({
            message: `Payment confirmed via AppScript. Status updated to: ${newPaymentStatus}`,
            reservation: updatedReservation,
            matchedTransaction: matchedTx,
            paymentDetails: {
                paidAmount: newPaidAmount,
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
// where status is 'Available' and mark them as 'Reserved'. Persist to reservedRooms.
async function allocateRoomsForReservation(reservationDoc) {
    console.log('[ALLOCATE_ROOMS] Starting allocation process...', {
        reservationId: reservationDoc._id,
        isPopulated: typeof reservationDoc.populate === 'function'
    });
    
    const reservation = typeof reservationDoc.populate === 'function'
        ? reservationDoc
        : await Reservation.findById(reservationDoc._id);
    if (!reservation) throw new Error('Reservation not found for allocation');

    console.log('[ALLOCATE_ROOMS] Reservation found:', {
        reservationId: reservation._id,
        hotelId: reservation.hotel,
        status: reservation.status
    });

    const details = await ReservationDetail.find({ reservation: reservation._id });
    console.log('[ALLOCATE_ROOMS] Found reservation details:', {
        detailsCount: details.length,
        details: details.map(d => ({
            detailId: d._id,
            roomType: d.roomType,
            quantity: d.quantity,
            currentReservedRooms: d.reservedRooms?.length || 0
        }))
    });

    if (details.length === 0) {
        console.warn('[ALLOCATE_ROOMS] No reservation details found for reservation:', reservation._id);
        return { performed: true, success: false, totalAllocated: 0, picksPerDetail: [], error: 'No reservation details found' };
    }

    let totalAllocated = 0;
    const picksPerDetail = [];

    for (const d of details) {
        console.log('[ALLOCATE_ROOMS] Processing detail:', {
            detailId: d._id,
            roomType: d.roomType,
            quantity: d.quantity,
            currentReservedRooms: d.reservedRooms?.length || 0
        });

        // if already allocated enough, skip
        if (Array.isArray(d.reservedRooms) && d.reservedRooms.length >= d.quantity) {
            console.log('[ALLOCATE_ROOMS] Detail already fully allocated, skipping:', {
                detailId: d._id,
                alreadyAllocated: d.reservedRooms.length,
                required: d.quantity
            });
            picksPerDetail.push({ detailId: d._id, alreadyAllocated: d.reservedRooms.length });
            continue;
        }

        const need = d.quantity - (Array.isArray(d.reservedRooms) ? d.reservedRooms.length : 0);
        if (need <= 0) {
            console.log('[ALLOCATE_ROOMS] No rooms needed for this detail:', {
                detailId: d._id,
                need: need
            });
            continue;
        }

        console.log('[ALLOCATE_ROOMS] Searching for available rooms:', {
            detailId: d._id,
            hotelId: reservation.hotel,
            hotelIdType: typeof reservation.hotel,
            hotelIdString: String(reservation.hotel),
            roomTypeId: d.roomType,
            roomTypeIdType: typeof d.roomType,
            roomTypeIdString: String(d.roomType),
            need: need,
            searchStatus: 'Available'
        });

        // DEBUG: Check all rooms in this hotel with this roomType (regardless of status)
        const allRoomsInHotel = await Room.find({
            hotel: reservation.hotel,
            roomType: d.roomType
        }).select('_id status roomNumber hotel roomType');
        
        console.log('[ALLOCATE_ROOMS] DEBUG - All rooms in hotel with this roomType:', {
            detailId: d._id,
            totalRoomsFound: allRoomsInHotel.length,
            rooms: allRoomsInHotel.map(r => ({
                roomId: r._id,
                roomNumber: r.roomNumber,
                status: r.status,
                statusType: typeof r.status,
                hotelId: r.hotel,
                hotelIdString: String(r.hotel),
                roomTypeId: r.roomType,
                roomTypeIdString: String(r.roomType)
            })),
            statusCounts: allRoomsInHotel.reduce((acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
            }, {})
        });

        // Note: Room model enum only has: ['Reserved', 'Available', 'Maintenance','Cleaning','Occupied']
        // So we only search for 'Available' status
        const candidates = await Room.find({
            hotel: reservation.hotel,
            roomType: d.roomType,
            status: 'Available' // Only search for 'Available' status as per Room model enum
        }).select('_id status roomNumber').limit(need);

        console.log('[ALLOCATE_ROOMS] Found candidate rooms:', {
            detailId: d._id,
            candidatesCount: candidates.length,
            needed: need,
            candidates: candidates.map(c => ({
                roomId: c._id,
                roomNumber: c.roomNumber,
                status: c.status
            }))
        });

        if (candidates.length < need) {
            console.warn('[ALLOCATE_ROOMS] Not enough available rooms:', {
                detailId: d._id,
                found: candidates.length,
                needed: need,
                roomType: d.roomType
            });
            picksPerDetail.push({ detailId: d._id, allocated: candidates.length, needed: need, error: 'Insufficient available rooms' });
            continue; // partial or none; we won't fail the whole flow
        }

        const pickIds = candidates.map(c => c._id);
        console.log('[ALLOCATE_ROOMS] Allocating rooms:', {
            detailId: d._id,
            roomIds: pickIds,
            count: pickIds.length
        });

        // mark rooms Reserved
        const updateResult = await Room.updateMany({ _id: { $in: pickIds } }, { $set: { status: 'Reserved' } });
        console.log('[ALLOCATE_ROOMS] Rooms marked as Reserved:', {
            detailId: d._id,
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount
        });

        // persist in detail
        const previousReservedRooms = d.reservedRooms || [];
        d.reservedRooms = [...previousReservedRooms, ...pickIds];
        
        console.log('[ALLOCATE_ROOMS] Saving reservation detail with reservedRooms:', {
            detailId: d._id,
            previousCount: previousReservedRooms.length,
            newCount: d.reservedRooms.length,
            reservedRooms: d.reservedRooms
        });
        
        await d.save();
        
        // Verify the save
        const savedDetail = await ReservationDetail.findById(d._id);
        console.log('[ALLOCATE_ROOMS] Verified saved detail:', {
            detailId: savedDetail._id,
            reservedRoomsCount: savedDetail.reservedRooms?.length || 0,
            reservedRooms: savedDetail.reservedRooms
        });

        totalAllocated += pickIds.length;
        picksPerDetail.push({ detailId: d._id, allocated: pickIds.length, roomIds: pickIds });
    }

    const success = picksPerDetail.every(p => (p.alreadyAllocated ?? 0) + (p.allocated ?? 0) >= (details.find(x => String(x._id) === String(p.detailId))?.quantity || 0));

    console.log('[ALLOCATE_ROOMS] Allocation completed:', {
        success: success,
        totalAllocated: totalAllocated,
        picksPerDetail: picksPerDetail
    });

    return { performed: true, success, totalAllocated, picksPerDetail };
}


// [4] XEM TẤT CẢ ĐƠN ĐẶT PHÒNG (GIỮ NGUYÊN)
exports.getAllReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find()
            .populate('hotel', 'name address')
            .populate('customer', 'fullname username email phone')
            .populate('payment') // Populate payment thông tin
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

// [4.5] XEM TẤT CẢ ĐƠN ĐẶT PHÒNG CỦA USER HIỆN TẠI (VỚI FILTER)
exports.getUserReservations = async (req, res) => {
    try {
        // Lấy user từ token (đã được authenticate bởi protect middleware)
        const userId = req.user._id;
        
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        // Lấy query parameters cho filter
        const { stayStatus, dateFrom, dateTo, hotelName } = req.query;

        // Xây dựng query filter
        const filter = { customer: userId };

        // Filter theo stayStatus
        if (stayStatus && stayStatus !== 'all') {
            filter.stayStatus = stayStatus;
        }

        // Filter theo ngày (checkInDate hoặc checkOutDate)
        if (dateFrom || dateTo) {
            filter.$or = [];
            
            if (dateFrom && dateTo) {
                // Tìm reservations có checkInDate hoặc checkOutDate nằm trong khoảng
                const fromDate = new Date(dateFrom);
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999); // Set đến cuối ngày
                
                filter.$or.push(
                    {
                        checkInDate: { $gte: fromDate, $lte: toDate }
                    },
                    {
                        checkOutDate: { $gte: fromDate, $lte: toDate }
                    },
                    {
                        $and: [
                            { checkInDate: { $lte: fromDate } },
                            { checkOutDate: { $gte: toDate } }
                        ]
                    }
                );
            } else if (dateFrom) {
                const fromDate = new Date(dateFrom);
                filter.$or.push(
                    { checkInDate: { $gte: fromDate } },
                    { checkOutDate: { $gte: fromDate } }
                );
            } else if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                filter.$or.push(
                    { checkInDate: { $lte: toDate } },
                    { checkOutDate: { $lte: toDate } }
                );
            }
        }

        // Tìm tất cả reservations của user này với filter
        let query = Reservation.find(filter)
            .populate('hotel', 'name address city country email phone images')
            .populate('customer', 'fullname username email phone')
            .populate('payment')
            .populate({
                path: 'details',
                populate: [
                    {
                        path: 'roomType',
                        select: 'name basePrice description amenities images'
                    },
                    {
                        path: 'services.service',
                        select: 'name basePrice description'
                    },
                    {
                        path: 'reservedRooms',
                        select: 'roomNumber floor status'
                    }
                ]
            })
            .sort({ createdAt: -1 });

        const reservations = await query.exec();

        // Filter theo tên hotel (client-side vì đã populate)
        let filteredReservations = reservations;
        if (hotelName && hotelName.trim()) {
            const searchTerm = hotelName.trim().toLowerCase();
            filteredReservations = reservations.filter(reservation => {
                const hotel = reservation.hotel;
                if (!hotel || typeof hotel !== 'object') return false;
                const hotelNameStr = hotel.name || '';
                return hotelNameStr.toLowerCase().includes(searchTerm);
            });
        }

        return res.status(200).json({
            message: 'User reservations retrieved successfully.',
            reservations: filteredReservations,
        });

    } catch (error) {
        console.error('Error retrieving user reservations:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [5] XEM CHI TIẾT ĐƠN ĐẶT PHÒNG (GIỮ NGUYÊN)
exports.getReservationById = async (req, res) => {
    try {
        const reservationId = req.params.id;
        // Populate reservation with related data: payment, customer, and details.
        // Also populate each ReservationDetail.reservedRooms as Room documents so frontend
        // can directly inspect reserved room ids/numbers/status without extra calls.
        const reservation = await Reservation.findById(reservationId)
            .populate('hotel', 'name address description')
            .populate('customer', 'fullname username email phone address')
            .populate('payment') // Populate payment thông tin
            .populate({
                path: 'details',
                populate: [
                    { path: 'roomType', select: 'name basePrice description amenities' },
                    // populate reservedRooms as Room docs and include their roomType and hotel refs
                    { path: 'reservedRooms', model: 'Room', select: 'roomNumber code status roomType hotel', populate: [{ path: 'roomType', select: 'name' }, { path: 'hotel', select: 'name address' }] },
                    // populate services[].service for detailed service info
                    { path: 'services.service', model: 'Service', select: 'name basePrice description' }
                ],
            });

        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Kiểm tra payment có tồn tại không
        if (!reservation.payment) {
            return res.status(404).json({ message: 'Payment information not found for this reservation.' });
        }

        const payment = reservation.payment;

        // Hiển thị payment options thay vì tự động generate QR
        let paymentOptions = null;
        if (reservation.status === 'approved') {
            // Chỉ khi được approve thì mới hiển thị payment options
            paymentOptions = {
                reservationTotal: payment.totalPrice,
                depositAmount: payment.depositAmount,
                currentPaymentStatus: payment.paymentStatus,
                paidAmount: payment.paidAmount,
                remainingAmount: payment.remainingAmount,
                availableOptions: []
            };

            // Xác định các payment options có sẵn
            if (payment.paymentStatus === 'unpaid') {
                paymentOptions.availableOptions = [
                    { type: 'deposit', amount: payment.depositAmount, description: 'Thanh toán cọc 50%' },
                    { type: 'full', amount: payment.totalPrice, description: 'Thanh toán toàn bộ 100%' }
                ];
            } else if (payment.paymentStatus === 'deposit_paid') {
                const remainingAmount = payment.totalPrice - payment.depositAmount;
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

        console.log(`[PAYMENT_OPTION] Request received:`, {
            reservationId: reservationId,
            paymentType: paymentType,
            body: req.body
        });

        // Validate paymentType
        if (!paymentType || !['full', 'deposit'].includes(paymentType)) {
            console.log(`[PAYMENT_OPTION] Invalid payment type: ${paymentType}`);
            return res.status(400).json({ message: 'Payment type must be either "full" or "deposit".' });
        }

        const reservation = await Reservation.findById(reservationId).populate('payment');
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Kiểm tra payment có tồn tại không
        if (!reservation.payment) {
            return res.status(404).json({ message: 'Payment information not found for this reservation.' });
        }

        const payment = reservation.payment;
        
        console.log('[PAYMENT_OPTION] Payment data from database:', {
            paymentId: payment._id,
            totalPrice: payment.totalPrice,
            depositAmount: payment.depositAmount,
            paidAmount: payment.paidAmount,
            paymentStatus: payment.paymentStatus,
            reservationStatus: reservation.status,
            checkInDate: reservation.checkInDate,
            checkOutDate: reservation.checkOutDate
        });

        // Chỉ cho phép thanh toán khi reservation đã được approve
        if (reservation.status !== 'approved') {
            return res.status(400).json({ 
                message: `Reservation is ${reservation.status}. Payment is only allowed for approved reservations.` 
            });
        }

        // Tính toán số tiền cần thanh toán
        let amountToPay = 0;

        if (paymentType === 'full') {
            // Nếu đã đặt cọc, chỉ tính phần còn lại
            if (payment.paymentStatus === 'deposit_paid') {
                amountToPay = payment.totalPrice - payment.depositAmount;
                console.log('[PAYMENT_OPTION] Full payment (after deposit):', {
                    totalPrice: payment.totalPrice,
                    depositAmount: payment.depositAmount,
                    amountToPay: amountToPay
                });
            } else {
                amountToPay = payment.totalPrice;
                console.log('[PAYMENT_OPTION] Full payment (no deposit yet):', {
                    totalPrice: payment.totalPrice,
                    amountToPay: amountToPay
                });
            }
        } else if (paymentType === 'deposit') {
            amountToPay = payment.depositAmount;
            console.log('[PAYMENT_OPTION] Deposit payment:', {
                depositAmount: payment.depositAmount,
                amountToPay: amountToPay
            });
        }

        // Kiểm tra xem đã thanh toán chưa
        if (payment.paymentStatus === 'fully_paid') {
            return res.status(400).json({ message: 'Reservation is already fully paid.' });
        }

        if (amountToPay <= 0) {
            return res.status(400).json({ message: 'No payment required.' });
        }

        // Sử dụng ID đơn giản để tránh lỗi URL encoding
        const transferContent = reservation._id.toString().slice(-6); // Chỉ lấy 6 ký tự cuối
        
        console.log('[PAYMENT_OPTION] Generating QR code:', {
            amountToPay: amountToPay,
            transferContent: transferContent,
            bankCode: process.env.MY_BANK_CODE,
            accountNumber: process.env.MY_ACCOUNT_NUMBER
        });
        
        const vietQRLink = await generateVietQR(
            process.env.MY_BANK_CODE, 
            process.env.MY_ACCOUNT_NUMBER, 
            amountToPay, 
            transferContent 
        );
        
        const responseData = {
            paymentType: paymentType,
            requiredAmount: amountToPay,
            vietQRLink: vietQRLink,
            reservationTotal: payment.totalPrice,
            depositAmount: payment.depositAmount,
            paidAmount: payment.paidAmount,
            remainingAmount: payment.totalPrice - payment.paidAmount
        };
        
        console.log('[PAYMENT_OPTION] Response data:', responseData);

        return res.status(200).json({
            message: 'Payment QR code generated successfully.',
            paymentInfo: responseData
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
        if (status === 'canceled' && reservation.payment?.paymentStatus !== 'unpaid') {
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

// [8] LẤY DANH SÁCH ĐƠN ĐẶT PHÒNG CỦA MỘT USER (THEO CUSTOMER ID)
exports.getReservationsByUser = async (req, res) => {
    try {
        const userId = req.params.userId;

        const reservations = await Reservation.find({ customer: userId })
            .populate('hotel', 'name address')
            .populate('customer', 'fullname username email phone')
            .populate('payment') // Populate payment thông tin
            .populate({
                path: 'details',
                populate: {
                    path: 'roomType',
                    select: 'name basePrice'
                },
            })
            .sort({ createdAt: -1 }); // most recent first

        return res.status(200).json({
            message: 'Reservations retrieved successfully.',
            reservations,
        });

    } catch (error) {
        console.error('Error retrieving reservations:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [9] XÓA ĐƠN ĐẶT PHÒNG (Chỉ nên cho phép với trạng thái nhất định hoặc Admin)
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
