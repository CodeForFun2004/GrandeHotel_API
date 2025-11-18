# PROMPT: Backend API cho Staff Calendar System

## Mục đích
Xây dựng backend API để hỗ trợ **Staff Calendar** - hệ thống lịch làm việc cho nhân viên khách sạn để quản lý và check-in/checkout khách hàng.

---

## 1. TỔNG QUAN VỀ UI

### 1.1. Các loại sự kiện (Event Types)
Calendar hiển thị 4 loại sự kiện:

1. **Reservation** (Đặt phòng) - Màu xanh dương (#0049a9)
   - Đại diện cho các đơn đặt phòng đã được xác nhận hoặc đang chờ
   - Staff có thể check-in từ reservation này

2. **Stay** (Lưu trú) - Màu đỏ (#b8192b)
   - Đại diện cho khách đang ở trong phòng (đã check-in)
   - Staff có thể check-out từ stay này

3. **Maintenance** (Bảo trì) - Màu cam (#b7791f)
   - Đại diện cho các công việc bảo trì phòng
   - Có thể liên kết với phòng cụ thể

4. **Task** (Nhiệm vụ) - Màu teal (#0f766e)
   - Đại diện cho các nhiệm vụ cần thực hiện (ví dụ: chuẩn bị giường phụ)

### 1.2. Các chế độ xem (View Modes)
- **Day** (Ngày): Hiển thị 1 ngày
- **Week** (Tuần): Hiển thị 7 ngày (từ Chủ nhật đến Thứ bảy)
- **Month** (Tháng): Hiển thị lịch tháng (6 tuần)

### 1.3. Tính năng tìm kiếm và lọc
- **Tìm kiếm**: Theo mã RSV/STAY, số phòng, tên khách
- **Lọc theo loại**: `reservation`, `stay`, `maintenance`, `task`, hoặc `ALL`
- **Lọc theo phòng**: Theo `roomId` hoặc `roomNumber`, hoặc `ALL`

---

## 2. CẤU TRÚC DỮ LIỆU

### 2.1. Calendar Event Type (TypeScript Interface)

```typescript
type EventType = "reservation" | "stay" | "maintenance" | "task";

type CalEvent = {
  id: string;                    // Unique identifier cho event
  type: EventType;               // Loại sự kiện
  title: string;                // Tiêu đề hiển thị (ví dụ: "Reservation RSV-1001 • John Doe")
  roomNumber?: string;          // Số phòng (ví dụ: "101", "102")
  roomId?: number | string;     // ID phòng trong database
  stayId?: number | string;     // ID của Stay (nếu type = "stay")
  reservationId?: string;        // Mã reservation (nếu type = "reservation")
  startsAt: string;             // ISO 8601 datetime string (ví dụ: "2025-11-19T00:00:00.000Z")
  endsAt: string;              // ISO 8601 datetime string
  status?: "pending" | "confirmed" | "checked-in" | "checked-out" | "in-progress" | "done";
  // Optional: Thêm các field khác nếu cần
  customerName?: string;        // Tên khách hàng
  customerPhone?: string;       // SĐT khách hàng
  customerEmail?: string;       // Email khách hàng
};
```

### 2.2. Request Parameters

```typescript
interface GetCalendarEventsParams {
  // Date range filtering
  startDate: string;           // ISO date string (YYYY-MM-DD) - bắt đầu của khoảng thời gian
  endDate: string;             // ISO date string (YYYY-MM-DD) - kết thúc của khoảng thời gian
  
  // Filters
  type?: EventType | "ALL";     // Lọc theo loại sự kiện
  roomId?: string | number;     // Lọc theo roomId
  roomNumber?: string;          // Lọc theo số phòng
  
  // Search
  keyword?: string;             // Tìm kiếm theo mã RSV/STAY, số phòng, tên khách
  
  // Pagination (optional, nếu cần)
  page?: number;
  limit?: number;
  
  // Hotel context (từ JWT token của staff)
  // Backend tự động lấy hotelId từ req.user.hotelId hoặc req.user.assignedHotelId
}
```

### 2.3. Response Format

```typescript
interface GetCalendarEventsResponse {
  success: boolean;
  data: {
    events: CalEvent[];
    total: number;              // Tổng số events (nếu có pagination)
    startDate: string;         // ISO date string
    endDate: string;           // ISO date string
  };
  message?: string;
}
```

---

## 3. API ENDPOINTS CẦN THIẾT

### 3.1. GET `/api/staff/calendar/events`

**Mục đích**: Lấy danh sách các sự kiện trong khoảng thời gian cho staff calendar.

**Authentication**: Required (JWT token với role `staff`)

**Query Parameters**:
```
startDate: string (required) - ISO date "YYYY-MM-DD"
endDate: string (required) - ISO date "YYYY-MM-DD"
type?: "reservation" | "stay" | "maintenance" | "task" | "ALL" (default: "ALL")
roomId?: string | number
roomNumber?: string
keyword?: string - Tìm kiếm trong mã RSV/STAY, số phòng, tên khách
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "rsv_68f7103ab40e05f9f02fde50",
        "type": "reservation",
        "title": "Reservation RSV-1001 • John Doe",
        "roomNumber": "101",
        "roomId": "68f7103ab40e05f9f02fde51",
        "reservationId": "RSV-1001",
        "startsAt": "2025-11-19T00:00:00.000Z",
        "endsAt": "2025-11-21T00:00:00.000Z",
        "status": "confirmed",
        "customerName": "John Doe",
        "customerPhone": "0901234567",
        "customerEmail": "john@example.com"
      },
      {
        "id": "stay_68f7103ab40e05f9f02fde52",
        "type": "stay",
        "title": "Stay STAY-1101 • Nguyen A",
        "roomNumber": "102",
        "roomId": "68f7103ab40e05f9f02fde53",
        "stayId": "1101",
        "startsAt": "2025-11-18T14:00:00.000Z",
        "endsAt": "2025-11-20T12:00:00.000Z",
        "status": "checked-in",
        "customerName": "Nguyen A",
        "customerPhone": "0912345678"
      },
      {
        "id": "maint_68f7103ab40e05f9f02fde54",
        "type": "maintenance",
        "title": "Bảo trì phòng 201 (A/C)",
        "roomNumber": "201",
        "roomId": "68f7103ab40e05f9f02fde55",
        "startsAt": "2025-11-19T08:00:00.000Z",
        "endsAt": "2025-11-19T17:00:00.000Z",
        "status": "in-progress"
      },
      {
        "id": "task_68f7103ab40e05f9f02fde56",
        "type": "task",
        "title": "Chuẩn bị giường phụ phòng 101",
        "roomNumber": "101",
        "roomId": "68f7103ab40e05f9f02fde51",
        "startsAt": "2025-11-19T10:00:00.000Z",
        "endsAt": "2025-11-19T12:00:00.000Z",
        "status": "pending"
      }
    ],
    "total": 4,
    "startDate": "2025-11-16",
    "endDate": "2025-11-22"
  }
}
```

**Response 400** (Validation Error):
```json
{
  "success": false,
  "message": "startDate and endDate are required",
  "error": "ValidationError"
}
```

**Response 401** (Unauthorized):
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**Response 403** (Forbidden):
```json
{
  "success": false,
  "message": "Staff access required"
}
```

---

## 4. LOGIC XỬ LÝ BACKEND

### 4.1. Lấy Events từ Reservations

**Nguồn dữ liệu**: Collection `reservations` (hoặc `Reservation` model)

**Điều kiện**:
- `reservation.status` ∈ `['pending', 'confirmed', 'approved']` (hoặc các status phù hợp)
- `reservation.hotel` = `req.user.hotelId` (hoặc `req.user.assignedHotelId`)
- `reservation.checkInDate` ≤ `endDate` AND `reservation.checkOutDate` ≥ `startDate` (overlap với date range)

**Mapping**:
```javascript
{
  id: `rsv_${reservation._id}`,
  type: "reservation",
  title: `Reservation ${reservation.code || reservation._id} • ${customer.fullname || customer.username || 'Guest'}`,
  roomNumber: reservation.room?.number || reservation.roomNumber, // Từ reservation details
  roomId: reservation.room?._id || reservation.roomId,
  reservationId: reservation.code || reservation._id.toString(),
  startsAt: reservation.checkInDate, // ISO string
  endsAt: reservation.checkOutDate,  // ISO string
  status: reservation.status === 'pending' ? 'pending' : 'confirmed',
  customerName: customer.fullname || customer.username,
  customerPhone: customer.phone,
  customerEmail: customer.email
}
```

**Lưu ý**:
- Nếu reservation có nhiều phòng (reservation details), tạo nhiều events (1 event per room)
- Populate `customer` và `room` từ reservation để lấy thông tin đầy đủ

### 4.2. Lấy Events từ Stays

**Nguồn dữ liệu**: Collection `stays` (hoặc `Stay` model)

**Điều kiện**:
- `stay.hotel` = `req.user.hotelId`
- `stay.status` ∈ `['checked-in', 'in-progress']` (đang ở)
- `stay.checkIn` ≤ `endDate` AND `stay.checkOut` ≥ `startDate` (overlap)

**Mapping**:
```javascript
{
  id: `stay_${stay._id}`,
  type: "stay",
  title: `Stay ${stay.code || stay._id} • ${customer.fullname || customer.username || 'Guest'}`,
  roomNumber: stay.room?.number || stay.roomNumber,
  roomId: stay.room?._id || stay.roomId,
  stayId: stay.code || stay._id.toString(),
  startsAt: stay.checkIn,  // ISO datetime string
  endsAt: stay.checkOut || stay.expectedCheckOut, // ISO datetime string
  status: stay.status === 'checked-in' ? 'checked-in' : 'in-progress',
  customerName: customer.fullname || customer.username,
  customerPhone: customer.phone,
  customerEmail: customer.email
}
```

### 4.3. Lấy Events từ Maintenance

**Nguồn dữ liệu**: Collection `maintenances` hoặc `roomMaintenances` (nếu có)

**Điều kiện**:
- `maintenance.hotel` = `req.user.hotelId`
- `maintenance.status` ∈ `['scheduled', 'in-progress']` (chưa hoàn thành)
- `maintenance.startDate` ≤ `endDate` AND `maintenance.endDate` ≥ `startDate`

**Mapping**:
```javascript
{
  id: `maint_${maintenance._id}`,
  type: "maintenance",
  title: `Bảo trì phòng ${room.number} (${maintenance.description || maintenance.type || 'Maintenance'})`,
  roomNumber: room.number,
  roomId: room._id,
  startsAt: maintenance.startDate, // ISO datetime string
  endsAt: maintenance.endDate || maintenance.startDate, // Nếu không có endDate, dùng startDate
  status: maintenance.status === 'scheduled' ? 'pending' : 'in-progress'
}
```

**Lưu ý**: Nếu chưa có model Maintenance, có thể tạo model mới hoặc lấy từ `Room.status === 'maintenance'` với `Room.maintenanceStartDate` và `Room.maintenanceEndDate`.

### 4.4. Lấy Events từ Tasks

**Nguồn dữ liệu**: Collection `tasks` hoặc `staffTasks` (nếu có)

**Điều kiện**:
- `task.hotel` = `req.user.hotelId` (hoặc `task.assignedTo` = `req.user._id`)
- `task.status` ∈ `['pending', 'in-progress']` (chưa hoàn thành)
- `task.dueDate` hoặc `task.scheduledDate` nằm trong khoảng `[startDate, endDate]`

**Mapping**:
```javascript
{
  id: `task_${task._id}`,
  type: "task",
  title: task.title || task.description,
  roomNumber: task.room?.number || task.roomNumber,
  roomId: task.room?._id || task.roomId,
  startsAt: task.scheduledDate || task.dueDate || task.createdAt, // ISO datetime string
  endsAt: task.dueDate || task.scheduledDate || task.createdAt, // Nếu không có, dùng startsAt
  status: task.status === 'pending' ? 'pending' : 'in-progress'
}
```

**Lưu ý**: Nếu chưa có model Task, có thể tạo model mới hoặc bỏ qua phần này nếu chưa cần.

### 4.5. Xử lý Filtering

**Filter theo type**:
- Nếu `type === "ALL"`: Lấy tất cả 4 loại
- Nếu `type === "reservation"`: Chỉ lấy từ reservations
- Tương tự cho `stay`, `maintenance`, `task`

**Filter theo roomId/roomNumber**:
- Nếu có `roomId`: Lọc events có `roomId` khớp
- Nếu có `roomNumber`: Tìm room theo `roomNumber` trước, sau đó lọc theo `roomId`

**Search keyword**:
- Tìm trong:
  - `reservation.code` hoặc `reservation._id`
  - `stay.code` hoặc `stay._id`
  - `room.number`
  - `customer.fullname`, `customer.username`
  - `task.title`, `task.description`
  - `maintenance.description`

**Date Range Overlap Logic**:
```javascript
// Event overlaps với date range nếu:
event.startsAt <= endDate && event.endsAt >= startDate
```

### 4.6. Sắp xếp và Trả về

- Sắp xếp events theo `startsAt` (tăng dần)
- Nếu có nhiều events cùng `startsAt`, sắp xếp theo `type` (reservation → stay → maintenance → task)
- Trả về array `events` với format đã định nghĩa

---

## 5. CẤU TRÚC DATABASE (GỢI Ý)

### 5.1. Reservation Model (đã có sẵn)
```javascript
{
  _id: ObjectId,
  code: String, // "RSV-1001"
  hotel: ObjectId, // ref Hotel
  customer: ObjectId, // ref User
  checkInDate: Date,
  checkOutDate: Date,
  status: String, // "pending", "confirmed", "approved", "cancelled"
  // ... các field khác
}
```

### 5.2. Stay Model (nếu có)
```javascript
{
  _id: ObjectId,
  code: String, // "STAY-1101"
  hotel: ObjectId,
  customer: ObjectId,
  room: ObjectId, // ref Room
  checkIn: Date,
  checkOut: Date,
  expectedCheckOut: Date,
  status: String, // "checked-in", "checked-out", "in-progress"
  // ... các field khác
}
```

### 5.3. Maintenance Model (nếu cần tạo mới)
```javascript
{
  _id: ObjectId,
  hotel: ObjectId,
  room: ObjectId, // ref Room
  type: String, // "A/C", "Plumbing", "Electrical", etc.
  description: String,
  startDate: Date,
  endDate: Date,
  status: String, // "scheduled", "in-progress", "completed", "cancelled"
  assignedTo: ObjectId, // ref User (staff)
  // ... các field khác
}
```

### 5.4. Task Model (nếu cần tạo mới)
```javascript
{
  _id: ObjectId,
  hotel: ObjectId,
  room: ObjectId, // ref Room (optional)
  title: String,
  description: String,
  scheduledDate: Date,
  dueDate: Date,
  status: String, // "pending", "in-progress", "done", "cancelled"
  assignedTo: ObjectId, // ref User (staff)
  priority: String, // "low", "medium", "high"
  // ... các field khác
}
```

### 5.5. Room Model (đã có sẵn)
```javascript
{
  _id: ObjectId,
  number: String, // "101", "102", "201"
  hotel: ObjectId,
  roomType: ObjectId, // ref RoomType
  status: String, // "available", "occupied", "maintenance", "cleaning"
  // ... các field khác
}
```

---

## 6. YÊU CẦU BẢO MẬT

1. **Authentication**: Tất cả endpoints phải yêu cầu JWT token
2. **Authorization**: Chỉ staff có quyền truy cập (role = `staff` hoặc `employee`)
3. **Hotel Scope**: Staff chỉ xem được events của hotel mà họ được assign (`req.user.hotelId` hoặc `req.user.assignedHotelId`)
4. **Validation**: Validate `startDate` và `endDate` (phải là date hợp lệ, `startDate <= endDate`, không quá 1 năm)

---

## 7. ERROR HANDLING

### 7.1. Validation Errors
- `startDate` và `endDate` là required
- `startDate` phải ≤ `endDate`
- Date range không được quá 1 năm (365 ngày)

### 7.2. Business Logic Errors
- Nếu không tìm thấy hotel của staff → 403 Forbidden
- Nếu không có events → Trả về `events: []` (không phải error)

### 7.3. Server Errors
- 500 Internal Server Error với message phù hợp

---

## 8. TESTING CHECKLIST

- [ ] GET `/api/staff/calendar/events` với `startDate` và `endDate` hợp lệ
- [ ] Filter theo `type` (reservation, stay, maintenance, task, ALL)
- [ ] Filter theo `roomId` và `roomNumber`
- [ ] Search với `keyword`
- [ ] Kết hợp nhiều filters
- [ ] Date range overlap logic (events nằm ngoài range không được trả về)
- [ ] Authentication và Authorization
- [ ] Hotel scope (staff chỉ xem được hotel của mình)
- [ ] Response format đúng với TypeScript interface
- [ ] Xử lý edge cases (không có events, date range rất lớn, etc.)

---

## 9. NOTES CHO BACKEND DEVELOPER

1. **Performance**: Nếu có nhiều events, nên sử dụng aggregation pipeline hoặc index trên `checkInDate`, `checkOutDate`, `hotel`, `room` để tối ưu query.

2. **Date Handling**: 
   - Luôn sử dụng UTC cho dates trong database
   - Trả về ISO 8601 strings cho frontend
   - Xử lý timezone nếu cần (frontend sẽ tự convert sang local time)

3. **Reservation Details**: Nếu một reservation có nhiều phòng (ReservationDetail), tạo nhiều events (1 event per room).

4. **Stay vs Reservation**: 
   - Reservation: Đơn đặt phòng (chưa check-in)
   - Stay: Khách đã check-in và đang ở

5. **Maintenance và Task**: Nếu chưa có model, có thể tạm thời trả về empty array `[]` cho 2 loại này, sau đó implement sau.

6. **Pagination**: Nếu số lượng events quá lớn, có thể thêm pagination, nhưng thông thường calendar chỉ hiển thị trong 1 tháng nên không cần thiết.

---

## 10. EXAMPLE IMPLEMENTATION (Pseudo-code)

```javascript
// routes/staff/calendar.js
router.get('/events', authenticateStaff, async (req, res) => {
  try {
    const { startDate, endDate, type, roomId, roomNumber, keyword } = req.query;
    
    // Validation
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be <= endDate'
      });
    }
    
    // Get hotelId from staff user
    const hotelId = req.user.hotelId || req.user.assignedHotelId;
    if (!hotelId) {
      return res.status(403).json({
        success: false,
        message: 'Staff must be assigned to a hotel'
      });
    }
    
    const events = [];
    
    // 1. Get Reservations
    if (!type || type === 'ALL' || type === 'reservation') {
      const reservations = await Reservation.find({
        hotel: hotelId,
        status: { $in: ['pending', 'confirmed', 'approved'] },
        checkInDate: { $lte: end },
        checkOutDate: { $gte: start }
      })
      .populate('customer', 'fullname username phone email')
      .populate('details.roomType')
      .lean();
      
      for (const rsv of reservations) {
        // Handle multiple rooms in reservation details
        for (const detail of rsv.details || []) {
          const room = await Room.findById(detail.room);
          if (room && (!roomId || room._id.toString() === roomId) && 
              (!roomNumber || room.number === roomNumber)) {
            const title = `Reservation ${rsv.code || rsv._id} • ${rsv.customer?.fullname || rsv.customer?.username || 'Guest'}`;
            if (!keyword || title.toLowerCase().includes(keyword.toLowerCase()) ||
                room.number.toLowerCase().includes(keyword.toLowerCase())) {
              events.push({
                id: `rsv_${rsv._id}_${room._id}`,
                type: 'reservation',
                title,
                roomNumber: room.number,
                roomId: room._id.toString(),
                reservationId: rsv.code || rsv._id.toString(),
                startsAt: rsv.checkInDate.toISOString(),
                endsAt: rsv.checkOutDate.toISOString(),
                status: rsv.status === 'pending' ? 'pending' : 'confirmed',
                customerName: rsv.customer?.fullname || rsv.customer?.username,
                customerPhone: rsv.customer?.phone,
                customerEmail: rsv.customer?.email
              });
            }
          }
        }
      }
    }
    
    // 2. Get Stays (similar logic)
    // 3. Get Maintenance (similar logic)
    // 4. Get Tasks (similar logic)
    
    // Sort by startsAt
    events.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    
    res.json({
      success: true,
      data: {
        events,
        total: events.length,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});
```

---

## KẾT LUẬN

Backend cần implement endpoint `GET /api/staff/calendar/events` với đầy đủ tính năng filtering, searching, và trả về đúng format `CalEvent[]` để frontend có thể render calendar một cách chính xác.

**Priority**:
1. ✅ **Reservation events** (bắt buộc - đã có model)
2. ✅ **Stay events** (bắt buộc - nếu đã có model)
3. ⚠️ **Maintenance events** (tùy chọn - có thể implement sau)
4. ⚠️ **Task events** (tùy chọn - có thể implement sau)

Nếu chưa có model Maintenance và Task, có thể trả về empty array `[]` cho 2 loại này, sau đó implement sau khi có model.

