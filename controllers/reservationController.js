// Giả định thư viện Mongoose Models đã được import
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Reservation = require('../models/reservationModel');
const ReservationDetail = require('../models/reservationDetailModel');
const RoomType = require('../models/roomTypeModel');
const Service = require('../models/serviceModel');
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
                    detailTotal += Number(serv.price || 0) * sqty; 
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
        const vietQRLink = await generateVietQR(
            process.env.MY_BANK_CODE, 
            process.env.MY_ACCOUNT_NUMBER, 
            amountToPay, 
            reservation._id.toString() 
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

// [3] XÁC NHẬN THANH TOÁN (WEBHOOK/STAFF MANUAL)
exports.handlePayment = async (req, res) => {
    try {
        const reservationId = req.params.id;
        // NOTE: Trong môi trường thực, hàm này có thể được gọi bởi Webhook từ ngân hàng/cổng thanh toán
        // Cần kiểm tra req.body để xác thực giao dịch
        const { paymentAmount, isDeposit } = req.body; 

        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        if (reservation.status !== 'approved') {
            return res.status(400).json({ message: `Reservation status is ${reservation.status}. Payment cannot be processed.` });
        }
        
        let newPaymentStatus = reservation.paymentStatus;

        // Logic kiểm tra số tiền thanh toán
        if (paymentAmount >= reservation.totalPrice) {
            newPaymentStatus = 'fully_paid';
        } else if (isDeposit && paymentAmount >= reservation.depositAmount && reservation.depositAmount > 0) {
            newPaymentStatus = 'deposit_paid';
        } else {
            return res.status(400).json({ message: 'Payment amount is insufficient.' });
        }

        if (newPaymentStatus === reservation.paymentStatus) {
            return res.status(200).json({ message: 'Payment status unchanged.', reservation });
        }

        // Cần tạo bản ghi Payment trong bảng Payment tại đây
        // ...

        const updatedReservation = await Reservation.findByIdAndUpdate(
            reservationId,
            { paymentStatus: newPaymentStatus },
            { new: true }
        );

        return res.status(200).json({
            message: `Payment status updated to: ${newPaymentStatus}`,
            reservation: updatedReservation,
        });

    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

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

        // Tạo lại paymentInfo dựa trên trạng thái reservation
        let paymentInfo = null;
        if (reservation.status === 'approved') {
            // Chỉ khi được approve thì mới được phép thanh toán
            // Tính toán số tiền cần thanh toán
            const DEPOSIT_PERCENTAGE = 0.5;
            const requiredDeposit = Math.ceil(reservation.totalPrice * DEPOSIT_PERCENTAGE);
            const amountToPay = reservation.paymentStatus === 'unpaid' ? requiredDeposit : 
                               (reservation.paymentStatus === 'deposit_paid' ? reservation.totalPrice - requiredDeposit : 0);
            
            if (amountToPay > 0) {
                // Tạo VietQR link cho thanh toán
                const vietQRLink = await generateVietQR(
                    process.env.MY_BANK_CODE, 
                    process.env.MY_ACCOUNT_NUMBER, 
                    amountToPay, 
                    reservation._id.toString() 
                );

                paymentInfo = {
                    requiredAmount: amountToPay,
                    vietQRLink: vietQRLink,
                    isFullPaymentRequested: reservation.paymentStatus === 'deposit_paid'
                };
            }
        }

        const responseData = {
            message: 'Reservation retrieved successfully.',
            reservation,
        };

        // Chỉ thêm paymentInfo nếu có
        if (paymentInfo) {
            responseData.paymentInfo = paymentInfo;
        }

        return res.status(200).json(responseData);

    } catch (error) {
        console.error('Error retrieving reservation:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [6] CẬP NHẬT TRẠNG THÁI CUỐI CÙNG (rejected, completed, canceled)
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
