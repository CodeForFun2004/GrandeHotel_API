const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    // --- THÔNG TIN LIÊN KẾT ---
    reservation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reservation',
        required: true,
        unique: true, // Một reservation chỉ có một payment
        index: true
    },
    
    // --- THANH TOÁN & GIÁ CẢ ---
    totalPrice: { 
        type: Number, 
        required: true,
        min: 0
    },
    depositAmount: { // Số tiền cọc cần thanh toán (50% của totalPrice)
        type: Number, 
        default: 0,
        min: 0
    },
    
    // --- TRẠNG THÁI THANH TOÁN ---
    paymentStatus: { // Trạng thái Thanh toán
        type: String,
        enum: ['unpaid', 'deposit_paid', 'fully_paid', 'partially_paid', 'refunded'],
        default: 'unpaid',
        index: true
    },
    
    // --- THÔNG TIN THANH TOÁN THỰC TẾ ---
    paidAmount: { // Tổng số tiền đã thanh toán thực tế
        type: Number,
        default: 0,
        min: 0
    },
    
    // --- THÔNG TIN BỔ SUNG (OPTIONAL) ---
    paymentMethod: { // Phương thức thanh toán
        type: String,
        enum: ['bank_transfer', 'cash', 'card', 'other'],
        default: 'bank_transfer'
    },
    paymentNotes: { // Ghi chú về thanh toán
        type: String,
        default: null
    },
    
}, { timestamps: true });

// Index để tìm kiếm nhanh theo paymentStatus
paymentSchema.index({ reservation: 1, paymentStatus: 1 });

// Virtual để tính số tiền còn lại
paymentSchema.virtual('remainingAmount').get(function() {
    return Math.max(0, this.totalPrice - this.paidAmount);
});

// Virtual để kiểm tra đã thanh toán đủ chưa
paymentSchema.virtual('isFullyPaid').get(function() {
    return this.paymentStatus === 'fully_paid';
});

// Virtual để kiểm tra đã đặt cọc chưa
paymentSchema.virtual('hasDeposit').get(function() {
    return this.paymentStatus === 'deposit_paid' || this.paymentStatus === 'fully_paid';
});

// Đảm bảo virtual fields được include khi convert sang JSON
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Payment', paymentSchema);

