# Hướng Dẫn Kết Nối Frontend với Staff Calendar API

## 📋 Tổng Quan

Backend API đã được implement để hỗ trợ **Staff Calendar System**. API endpoint chính là:

```
GET /api/staff/calendar/events
```

## 🔐 Authentication

API yêu cầu JWT token với role `staff`. Token phải được gửi trong header:

```
Authorization: Bearer <JWT_TOKEN>
```

**Lưu ý**: Staff phải có `hotelId` được gán trong database. Nếu không có, API sẽ trả về 403 Forbidden.

---

## 📡 API Endpoint

### GET `/api/staff/calendar/events`

Lấy danh sách các sự kiện trong khoảng thời gian cho staff calendar.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | ✅ Yes | ISO date string (YYYY-MM-DD), ví dụ: "2025-11-19" |
| `endDate` | string | ✅ Yes | ISO date string (YYYY-MM-DD), ví dụ: "2025-11-25" |
| `type` | string | ❌ No | Lọc theo loại: `"reservation"`, `"stay"`, `"maintenance"`, `"task"`, hoặc `"ALL"` (default: `"ALL"`) |
| `roomId` | string/number | ❌ No | Lọc theo ID phòng |
| `roomNumber` | string | ❌ No | Lọc theo số phòng (ví dụ: "101", "102") |
| `keyword` | string | ❌ No | Tìm kiếm trong mã RSV/STAY, số phòng, tên khách |

#### Response Format

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "rsv_68f7103ab40e05f9f02fde50_68f7103ab40e05f9f02fde51",
        "type": "reservation",
        "title": "Reservation 370EA • John Doe",
        "roomNumber": "101",
        "roomId": "68f7103ab40e05f9f02fde51",
        "reservationId": "68f7103ab40e05f9f02fde50",
        "startsAt": "2025-11-19T00:00:00.000Z",
        "endsAt": "2025-11-21T00:00:00.000Z",
        "status": "confirmed",
        "customerName": "John Doe",
        "customerPhone": "0901234567",
        "customerEmail": "john@example.com"
      },
      {
        "id": "stay_68f7103ab40e05f9f02fde52_68f7103ab40e05f9f02fde53",
        "type": "stay",
        "title": "Stay 370EB • Nguyen A",
        "roomNumber": "102",
        "roomId": "68f7103ab40e05f9f02fde53",
        "stayId": "68f7103ab40e05f9f02fde52",
        "startsAt": "2025-11-18T14:00:00.000Z",
        "endsAt": "2025-11-20T12:00:00.000Z",
        "status": "checked-in",
        "customerName": "Nguyen A",
        "customerPhone": "0912345678",
        "customerEmail": "nguyen@example.com"
      },
      {
        "id": "maint_68f7103ab40e05f9f02fde54",
        "type": "maintenance",
        "title": "Bảo trì phòng 201",
        "roomNumber": "201",
        "roomId": "68f7103ab40e05f9f02fde55",
        "startsAt": "2025-11-19T08:00:00.000Z",
        "endsAt": "2025-11-19T17:00:00.000Z",
        "status": "in-progress"
      }
    ],
    "total": 3,
    "startDate": "2025-11-19",
    "endDate": "2025-11-25"
  }
}
```

**Error Responses:**

- **400 Bad Request** (Validation Error):
```json
{
  "success": false,
  "message": "startDate and endDate are required",
  "error": "ValidationError"
}
```

- **401 Unauthorized**:
```json
{
  "success": false,
  "message": "Không có token, truy cập bị từ chối"
}
```

- **403 Forbidden**:
```json
{
  "success": false,
  "message": "Staff must be assigned to a hotel"
}
```

- **500 Internal Server Error**:
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error message details"
}
```

---

## 💻 Ví Dụ Code Frontend

### 1. React/TypeScript với Axios

```typescript
// types/calendar.ts
export type EventType = "reservation" | "stay" | "maintenance" | "task";

export interface CalEvent {
  id: string;
  type: EventType;
  title: string;
  roomNumber?: string | null;
  roomId?: string | null;
  stayId?: string;
  reservationId?: string;
  startsAt: string; // ISO 8601 datetime string
  endsAt: string; // ISO 8601 datetime string
  status?: "pending" | "confirmed" | "checked-in" | "checked-out" | "in-progress" | "done";
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface GetCalendarEventsParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type?: EventType | "ALL";
  roomId?: string | number;
  roomNumber?: string;
  keyword?: string;
}

export interface GetCalendarEventsResponse {
  success: boolean;
  data: {
    events: CalEvent[];
    total: number;
    startDate: string;
    endDate: string;
  };
  message?: string;
}

// services/calendarApi.ts
import axios from 'axios';
import { GetCalendarEventsParams, GetCalendarEventsResponse } from '../types/calendar';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:1000';

export const getCalendarEvents = async (
  params: GetCalendarEventsParams,
  token: string
): Promise<GetCalendarEventsResponse> => {
  const response = await axios.get<GetCalendarEventsResponse>(
    `${API_BASE_URL}/api/staff/calendar/events`,
    {
      params,
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  return response.data;
};
```

### 2. Sử dụng trong Component

```typescript
// components/StaffCalendar.tsx
import React, { useEffect, useState } from 'react';
import { getCalendarEvents } from '../services/calendarApi';
import { CalEvent } from '../types/calendar';

const StaffCalendar: React.FC = () => {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lấy token từ localStorage hoặc context
  const token = localStorage.getItem('token') || '';

  // Ví dụ: Lấy events cho tuần hiện tại
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay()); // Chủ nhật
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // Thứ bảy

      const response = await getCalendarEvents(
        {
          startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD
          endDate: endDate.toISOString().split('T')[0],
          type: 'ALL' // hoặc 'reservation', 'stay', etc.
        },
        token
      );

      if (response.success) {
        setEvents(response.data.events);
      } else {
        setError(response.message || 'Failed to fetch events');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Staff Calendar</h1>
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong> - {event.type} - Room: {event.roomNumber || 'N/A'}
            <br />
            {new Date(event.startsAt).toLocaleString()} → {new Date(event.endsAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StaffCalendar;
```

### 3. Ví dụ với Fetch API (Vanilla JavaScript)

```javascript
// services/calendarApi.js
const API_BASE_URL = 'http://localhost:1000';

export const getCalendarEvents = async (params, token) => {
  const queryString = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
    ...(params.type && { type: params.type }),
    ...(params.roomId && { roomId: params.roomId }),
    ...(params.roomNumber && { roomNumber: params.roomNumber }),
    ...(params.keyword && { keyword: params.keyword })
  }).toString();

  const response = await fetch(
    `${API_BASE_URL}/api/staff/calendar/events?${queryString}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch events');
  }

  return await response.json();
};

// Usage
const token = localStorage.getItem('token');
const events = await getCalendarEvents(
  {
    startDate: '2025-11-19',
    endDate: '2025-11-25',
    type: 'ALL'
  },
  token
);

console.log(events.data.events);
```

---

## 🎨 Mapping Event Types với Colors (theo UI spec)

Theo file `STAFF_CALENDAR_BACKEND_PROMPT.md`, các màu sắc cho từng loại event:

```typescript
const EVENT_COLORS = {
  reservation: '#0049a9', // Màu xanh dương
  stay: '#b8192b',        // Màu đỏ
  maintenance: '#b7791f', // Màu cam
  task: '#0f766e'         // Màu teal
};

// Sử dụng trong component
const getEventColor = (eventType: EventType) => {
  return EVENT_COLORS[eventType] || '#666';
};
```

---

## 🔍 Filtering & Searching Examples

### Lọc theo loại event
```typescript
const reservationEvents = await getCalendarEvents(
  {
    startDate: '2025-11-19',
    endDate: '2025-11-25',
    type: 'reservation' // Chỉ lấy reservations
  },
  token
);
```

### Lọc theo phòng
```typescript
const room101Events = await getCalendarEvents(
  {
    startDate: '2025-11-19',
    endDate: '2025-11-25',
    roomNumber: '101'
  },
  token
);
```

### Tìm kiếm
```typescript
const searchResults = await getCalendarEvents(
  {
    startDate: '2025-11-19',
    endDate: '2025-11-25',
    keyword: 'John' // Tìm theo tên khách, mã RSV/STAY, số phòng
  },
  token
);
```

### Kết hợp nhiều filters
```typescript
const filteredEvents = await getCalendarEvents(
  {
    startDate: '2025-11-19',
    endDate: '2025-11-25',
    type: 'stay',
    roomNumber: '102',
    keyword: 'Nguyen'
  },
  token
);
```

---

## 📅 Date Range Handling

### Tính toán date range cho các view modes

```typescript
// Day view
const getDayRange = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};

// Week view (Chủ nhật → Thứ bảy)
const getWeekRange = (date: Date) => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay()); // Chủ nhật
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Thứ bảy
  end.setHours(23, 59, 59, 999);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};

// Month view (6 tuần)
const getMonthRange = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Ngày đầu tiên của tháng
  const firstDay = new Date(year, month, 1);
  // Ngày đầu tuần (Chủ nhật) của tuần chứa ngày đầu tháng
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  start.setHours(0, 0, 0, 0);
  
  // 6 tuần = 42 ngày
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  end.setHours(23, 59, 59, 999);
  
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **Date Format**: Luôn sử dụng format `YYYY-MM-DD` cho `startDate` và `endDate` (không có time).

2. **Timezone**: Backend trả về dates dưới dạng ISO 8601 strings (UTC). Frontend cần tự convert sang local timezone nếu cần.

3. **Date Range Limit**: Date range không được vượt quá 365 ngày. Nếu vượt, API sẽ trả về 400 Bad Request.

4. **Empty Results**: Nếu không có events, API vẫn trả về 200 OK với `events: []`. Đây không phải là error.

5. **Maintenance & Task**: Hiện tại, Maintenance events được lấy từ rooms có status 'Maintenance'. Task events chưa được implement (trả về empty array) vì chưa có Task model.

6. **Multiple Rooms**: Một reservation có nhiều phòng sẽ tạo nhiều events (1 event per room).

---

## 🧪 Testing với Postman/cURL

### cURL Example

```bash
curl -X GET "http://localhost:1000/api/staff/calendar/events?startDate=2025-11-19&endDate=2025-11-25&type=ALL" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Postman Collection

1. Method: `GET`
2. URL: `http://localhost:1000/api/staff/calendar/events`
3. Headers:
   - `Authorization: Bearer <YOUR_TOKEN>`
   - `Content-Type: application/json`
4. Query Params:
   - `startDate`: `2025-11-19`
   - `endDate`: `2025-11-25`
   - `type`: `ALL` (optional)

---

## 📞 Support

Nếu gặp vấn đề, kiểm tra:
1. Token có hợp lệ và chưa hết hạn?
2. User có role `staff`?
3. Staff có `hotelId` được gán?
4. Date format đúng `YYYY-MM-DD`?
5. Date range không quá 365 ngày?

---

**Chúc bạn tích hợp thành công! 🚀**

