const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    // --- THÔNG TIN LIÊN KẾT CƠ BẢN ---
    hotel: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Hotel', 
        required: true, 
        index: true // Đánh index để truy vấn theo khách sạn nhanh hơn
    },
    customer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: false, // Cho phép null cho guest
        index: true 
    },
    
    // --- THÔNG TIN ĐẶT PHÒNG ---
    checkInDate: { 
        type: Date, 
        required: true 
    },
    checkOutDate: { 
        type: Date, 
        required: true 
    },
    numberOfGuests: { 
        type: Number, 
        required: true 
    },
    
    // --- TRẠNG THÁI QUẢN LÝ LUỒNG NGHỆP VỤ ---
    status: { // Trạng thái của Đơn đặt phòng (Duyệt & Hủy)
        type: String, 
        enum: ['pending', 'approved', 'rejected', 'canceled', 'completed'], 
        default: 'pending',
        index: true 
    },

    // --- XÁC THỰC CHECK-IN BẰNG QR CODE ---
    qrCodeToken: { // Token duy nhất để tạo mã QR cho Check-in
        type: String,
        unique: true, // Đảm bảo mỗi mã là duy nhất
        sparse: true // Cho phép giá trị null (chỉ tạo khi đã 'approved' hoặc 'paid')
    },
    
    // --- LÝ DO HỦY/REJECT ---
    reason: { // Lý do hủy hoặc từ chối đơn đặt phòng
        type: String,
        default: null
    },
    
    // --- THÔNG TIN LƯU TRỮ KHÁC ---
    // Trường này đã có trong bảng Reservation_Detail của bạn, 
    // nhưng có thể thêm nếu muốn lưu trữ mô tả tóm tắt
    // roomDetails: [{ /* ... */ }], 

}, { timestamps: true });

// Tạo Index kết hợp để tìm kiếm phòng trống hiệu quả hơn
reservationSchema.index({ hotel: 1, checkInDate: 1, checkOutDate: 1 });

// Virtual field để populate details từ ReservationDetail
reservationSchema.virtual('details', {
    ref: 'ReservationDetail',
    localField: '_id',
    foreignField: 'reservation'
});

// Virtual field để populate payment từ Payment
reservationSchema.virtual('payment', {
    ref: 'Payment',
    localField: '_id',
    foreignField: 'reservation',
    justOne: true // Một reservation chỉ có một payment
});

// Đảm bảo virtual fields được include khi convert sang JSON
reservationSchema.set('toJSON', { virtuals: true });
reservationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Reservation', reservationSchema);