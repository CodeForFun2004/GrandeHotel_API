# Handle Payment API Documentation

## PUT /api/reservations/:id/payment - Xác nhận thanh toán qua AppScript

### Mô tả
API này được sử dụng để xác nhận thanh toán cho reservation thông qua việc kiểm tra Google Sheet qua AppScript. Backend sẽ tự động kiểm toán và cập nhật trạng thái thanh toán.

### Request
```http
PUT http://localhost:1000/api/reservations/:id/payment
```

### URL Parameters
- `id` (required): Reservation ID

### Body
Không cần body, API sẽ tự động gọi AppScript để kiểm tra thanh toán.

### Response Success (200)
```json
{
    "message": "Payment confirmed via AppScript. Status updated to: fully_paid",
    "reservation": {
        "_id": "68f845d030e051f9d4af2e3a",
        "status": "approved",
        "paymentStatus": "fully_paid",
        "totalPrice": 8500000,
        "depositAmount": 4250000,
        "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "matchedTransaction": {
        "Mô tả": "THANH TOAN PHONG AF2E3A GRANDEHOTELDANANG FULL",
        "Giá trị": "8500000",
        "Thời gian": "2024-01-15 10:25:00"
    },
    "paymentDetails": {
        "paidAmount": 8500000,
        "totalPrice": 8500000,
        "depositAmount": 4250000,
        "paymentType": "full_payment",
        "oldStatus": "unpaid",
        "newStatus": "fully_paid"
    }
}
```

### Response Error (400) - No matching payment
```json
{
    "message": "No matching payment found in Google Sheet.",
    "reservationCode": "AF2E3A",
    "lastTransactions": [
        {
            "Mô tả": "THANH TOAN PHONG OTHER123 HOTELNAME DEPOSIT",
            "Giá trị": "2000000",
            "Thời gian": "2024-01-15 09:30:00"
        }
    ]
}
```

### Response Error (400) - Reservation not approved
```json
{
    "message": "Reservation status is pending. Payment cannot be processed."
}
```

### Response Error (404) - Reservation not found
```json
{
    "message": "Reservation not found."
}
```

---

## Logic Kiểm Toán Thanh Toán (Chỉ có 2 Option)

### 1. **Full Payment** (`paymentType: "full_payment"`)
- **Điều kiện**: `paidAmount >= totalPrice`
- **Trạng thái mới**: `fully_paid`
- **Ví dụ**: Thanh toán 8,500,000 VND cho reservation có tổng giá 8,500,000 VND

### 2. **Deposit Payment** (`paymentType: "deposit_payment"`)
- **Điều kiện**: `paidAmount >= depositAmount` (50% của tổng giá)
- **Trạng thái mới**: `deposit_paid`
- **Ví dụ**: Thanh toán 4,250,000 VND (50% cọc) cho reservation có tổng giá 8,500,000 VND

### 3. **Insufficient Payment** (`paymentType: "insufficient_payment"`)
- **Điều kiện**: `paidAmount < depositAmount` (không đủ để thanh toán cọc 50%)
- **Trạng thái mới**: `partially_paid`
- **Ví dụ**: Thanh toán 1,000,000 VND < 4,250,000 VND (cọc tối thiểu)

## Lưu ý quan trọng:
- **Không có thanh toán từng phần**: Chỉ có 2 option duy nhất
- **Không có thanh toán phần còn lại**: Một khi đã cọc 50%, không cần thanh toán thêm
- **Logic đơn giản**: Full payment hoặc Deposit payment, không có trường hợp phức tạp khác

---

## Logging

API sẽ ghi log chi tiết để tracking:

### Console Logs
```
[PAYMENT] Checking payment for reservation: 68f845d030e051f9d4af2e3a
[PAYMENT] Retrieved 15 transactions from AppScript
[PAYMENT] Found matching transaction: { description: "THANH TOAN PHONG AF2E3A GRANDEHOTELDANANG FULL", amount: "8500000" }
[PAYMENT] Full payment detected: 8500000 >= 8500000
[PAYMENT] SUCCESS - Reservation 68f845d030e051f9d4af2e3a updated: { oldStatus: "unpaid", newStatus: "fully_paid", paymentType: "full_payment" }
```

### Error Logs
```
[PAYMENT] ERROR processing payment for reservation 68f845d030e051f9d4af2e3a: AppScript fetch failed: 500
```

---

## Cách AppScript hoạt động

### 1. **AppScript chỉ có nhiệm vụ:**
- Đọc dữ liệu từ Google Sheet
- Trả về danh sách giao dịch gần nhất
- Không xử lý logic kiểm toán

### 2. **Backend xử lý:**
- Kiểm tra giao dịch có chứa mã reservation không
- Kiểm toán số tiền và cập nhật trạng thái
- Log chi tiết để tracking

### 3. **Format mô tả giao dịch:**
```
THANH TOAN PHONG [6_KY_TU_CUOI_RESERVATION_ID] [TEN_HOTEL] [LOAI_THANH_TOAN]
```

**Ví dụ:**
- `THANH TOAN PHONG AF2E3A GRANDEHOTELDANANG DEPOSIT`
- `THANH TOAN PHONG AF2E3A GRANDEHOTELDANANG FULL`

---

## Environment Variables

```env
APPSCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

---

## Test Cases

### Test Case 1: Full Payment
```bash
curl -X PUT http://localhost:1000/api/reservations/68f845d030e051f9d4af2e3a/payment
```

### Test Case 2: Deposit Payment
```bash
curl -X PUT http://localhost:1000/api/reservations/68f845d030e051f9d4af2e3a/payment
```

### Test Case 3: Remaining Payment
```bash
curl -X PUT http://localhost:1000/api/reservations/68f845d030e051f9d4af2e3a/payment
```
