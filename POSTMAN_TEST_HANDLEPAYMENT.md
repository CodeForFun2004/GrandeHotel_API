# Hướng Dẫn Test API HandlePayment bằng Postman

## 📋 CHUẨN BỊ TRƯỚC KHI TEST

### Bước 1: Tạo Reservation và Approve
Trước khi test `handlePayment`, bạn cần:

1. **Tạo Reservation:**
```
POST http://localhost:1000/api/reservations
Body:
{
  "hotelId": "YOUR_HOTEL_ID",
  "customerId": "YOUR_CUSTOMER_ID" hoặc "guest",
  "checkInDate": "2024-02-01",
  "checkOutDate": "2024-02-05",
  "numberOfGuests": 2,
  "rooms": [
    {
      "roomTypeId": "YOUR_ROOM_TYPE_ID",
      "quantity": 1,
      "services": []
    }
  ],
  "isFullPayment": false
}
```

2. **Approve Reservation:**
```
PUT http://localhost:1000/api/reservations/YOUR_RESERVATION_ID/approve
Body:
{
  "action": "approve"
}
```

3. **Lưu Reservation ID** để dùng cho test `handlePayment`

---

## 🧪 TEST API HANDLEPAYMENT

### Test Case 1: Thanh toán thành công (Full Payment)

**Request:**
```
Method: PUT
URL: http://localhost:1000/api/reservations/YOUR_RESERVATION_ID/payment
Headers: (không cần)
Body: (empty - không cần body)
```

**Luồng xử lý trong Backend:**

1. **Validation:**
   - Kiểm tra reservation tồn tại
   - Kiểm tra `status === 'approved'`
   - Nếu không → trả về error 400

2. **Gọi AppScript:**
   ```javascript
   // Backend tự động gọi AppScript URL
   const scriptUrl = process.env.APPSCRIPT_URL;
   const response = await fetch(scriptUrl);
   const result = await response.json();
   const transactions = result.data; // Array các giao dịch từ Google Sheet
   ```

3. **Tìm giao dịch matching:**
   - Ưu tiên 1: Tìm giao dịch có mô tả chứa "THANH"
   - Ưu tiên 2: Tìm theo mã reservation (6 ký tự cuối)
   - Ưu tiên 3: Tìm theo số tiền (>= depositAmount)
   - Test mode: Nếu không tìm thấy, dùng giao dịch đầu tiên

4. **Logic kiểm toán:**
   ```javascript
   if (paidAmount >= totalPrice) {
     paymentStatus = "fully_paid";
   } else if (paidAmount >= depositAmount) {
     paymentStatus = "deposit_paid";
   } else {
     paymentStatus = "partially_paid";
   }
   ```

5. **Cập nhật database:**
   - Cập nhật `paymentStatus` trong reservation
   - Trả về kết quả

**Expected Response (200):**
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

---

### Test Case 2: Thanh toán cọc (Deposit Payment)

**Request:** Giống Test Case 1, nhưng số tiền trong Google Sheet = depositAmount

**Expected Response (200):**
```json
{
  "message": "Payment confirmed via AppScript. Status updated to: deposit_paid",
  "reservation": {
    "paymentStatus": "deposit_paid"
  },
  "matchedTransaction": {
    "Mô tả": "THANH TOAN PHONG AF2E3A GRANDEHOTELDANANG DEPOSIT",
    "Giá trị": "4250000"
  },
  "paymentDetails": {
    "paidAmount": 4250000,
    "paymentType": "deposit_payment",
    "oldStatus": "unpaid",
    "newStatus": "deposit_paid"
  }
}
```

---

### Test Case 3: Không tìm thấy giao dịch

**Điều kiện:** Không có giao dịch nào trong Google Sheet khớp với reservation

**Expected Response (400):**
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

---

### Test Case 4: Reservation chưa được approve

**Điều kiện:** Reservation có `status = 'pending'` hoặc `'rejected'`

**Expected Response (400):**
```json
{
  "message": "Reservation status is pending. Payment cannot be processed."
}
```

---

### Test Case 5: Reservation không tồn tại

**Điều kiện:** Reservation ID không hợp lệ hoặc không tồn tại

**Expected Response (404):**
```json
{
  "message": "Reservation not found."
}
```

---

### Test Case 6: AppScript lỗi

**Điều kiện:** AppScript URL không hoạt động hoặc trả về lỗi

**Expected Response (500):**
```json
{
  "message": "Internal server error.",
  "error": "Failed to fetch AppScript data",
  "reservationId": "68f845d030e051f9d4af2e3a"
}
```

---

## 📝 LƯU Ý KHI TEST

### 1. Format dữ liệu từ AppScript
AppScript cần trả về JSON với format:
```json
{
  "data": [
    {
      "Mô tả": "THANH TOAN PHONG AF2E3A GRANDEHOTELDANANG FULL",
      "Giá trị": "8500000",
      "Thời gian": "2024-01-15 10:25:00"
    },
    {
      "Mô tả": "THANH TOAN PHONG OTHER123 HOTELNAME DEPOSIT",
      "Giá trị": "4250000",
      "Thời gian": "2024-01-15 09:30:00"
    }
  ]
}
```

### 2. Mã Reservation trong mô tả
- Backend tìm giao dịch theo 6 ký tự cuối của Reservation ID
- Ví dụ: Reservation ID = `68f845d030e051f9d4af2e3a` → Mã = `AF2E3A`
- Mô tả giao dịch nên chứa: `THANH TOAN PHONG AF2E3A...`

### 3. Kiểm tra Console Logs
Khi test, xem console của server để thấy chi tiết:
```
[PAYMENT] Reservation found: { id: '...', status: 'approved', ... }
[PAYMENT] Checking payment for reservation: ...
[PAYMENT] Retrieved 15 transactions from AppScript
[PAYMENT] Found matching transaction: { description: '...', amount: '...' }
[PAYMENT] Full payment detected: 8500000 >= 8500000
[PAYMENT] SUCCESS - Reservation ... updated: { oldStatus: 'unpaid', newStatus: 'fully_paid' }
```

### 4. Test Mode
Code hiện tại có test mode: Nếu không tìm thấy giao dịch matching, sẽ dùng giao dịch đầu tiên trong danh sách. Lưu ý khi deploy production!

---

## 🔄 FLOW HOÀN CHỈNH ĐỂ TEST

1. **Tạo Reservation** → Lấy Reservation ID
2. **Approve Reservation** → `status: 'approved'`
3. **Chọn Payment Option** (optional):
   ```
   POST /api/reservations/:id/payment-options
   Body: { "paymentType": "full" }
   ```
   → Nhận QR code để thanh toán
4. **Giả lập thanh toán** → Thêm giao dịch vào Google Sheet (hoặc dùng giao dịch có sẵn)
5. **Test handlePayment**:
   ```
   PUT /api/reservations/:id/payment
   ```
   → Kiểm tra kết quả

---

## ✅ CHECKLIST TEST

- [ ] Reservation đã được approve (`status: 'approved'`)
- [ ] Google Sheet có dữ liệu giao dịch
- [ ] AppScript URL hoạt động đúng
- [ ] Format dữ liệu từ AppScript đúng
- [ ] Kiểm tra console logs để debug
- [ ] Test các trường hợp: full payment, deposit payment, no match, error cases

---

## 🐛 DEBUGGING

Nếu không tìm thấy giao dịch:
1. Kiểm tra mã reservation trong Google Sheet (6 ký tự cuối của ID)
2. Kiểm tra format mô tả có chứa "THANH" hoặc mã reservation
3. Kiểm tra số tiền có >= depositAmount không
4. Xem console logs để biết chi tiết tìm kiếm

Nếu AppScript lỗi:
1. Kiểm tra `APPSCRIPT_URL` trong `.env`
2. Test AppScript URL trực tiếp trên browser
3. Kiểm tra quyền truy cập Google Sheet trong AppScript

