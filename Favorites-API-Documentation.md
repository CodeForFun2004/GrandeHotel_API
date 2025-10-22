# Favorites API Documentation

## Base URL
```
http://localhost:1000
```

---

## 1. POST /api/favorites - Thêm hotel vào favorites

### Request
```http
POST http://localhost:1000/api/favorites
Content-Type: application/json
```

### Body
```json
{
    "userId": "68e5d4dc5330fe88ef797299",
    "hotelId": "68f6fb33d5d4ba93788cab3e"
}
```

### Response Success (201)
```json
{
    "message": "Hotel added to favorites successfully.",
    "favorite": {
        "_id": "68f9a1b2c3d4e5f6g7h8i9j0",
        "user": "68e5d4dc5330fe88ef797299",
        "hotels": ["68f6fb33d5d4ba93788cab3e"],
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
    }
}
```

### Response Error (400)
```json
{
    "message": "Hotel is already in your favorites."
}
```

### Response Error (404)
```json
{
    "message": "Hotel not found."
}
```

---

## 2. GET /api/favorites - Lấy danh sách favorites của user

### Request
```http
GET http://localhost:1000/api/favorites?userId=68e5d4dc5330fe88ef797299
```

### Query Parameters
- `userId` (required): ID của user

### Response Success (200)
```json
{
    "message": "Favorites retrieved successfully.",
    "favorite": {
        "_id": "68f9a1b2c3d4e5f6g7h8i9j0",
        "user": {
            "_id": "68e5d4dc5330fe88ef797299",
            "name": "John Doe",
            "email": "john@example.com"
        },
        "hotels": [
            {
                "_id": "68f6fb33d5d4ba93788cab3e",
                "name": "Grande Hotel Da Nang",
                "address": "74 Lý Thái Tổ, Quận Thanh Khê, Da Nang, Việt Nam",
                "description": "Grande Hotel Da Nang là khách sạn 4 sao sang trọng...",
                "images": ["image1.jpg", "image2.jpg"]
            }
        ],
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "hotels": [
        {
            "_id": "68f6fb33d5d4ba93788cab3e",
            "name": "Grande Hotel Da Nang",
            "address": "74 Lý Thái Tổ, Quận Thanh Khê, Da Nang, Việt Nam",
            "description": "Grande Hotel Da Nang là khách sạn 4 sao sang trọng...",
            "images": ["image1.jpg", "image2.jpg"]
        }
    ]
}
```

### Response No Favorites (200)
```json
{
    "message": "No favorites found.",
    "favorite": null,
    "hotels": []
}
```

---

## 3. GET /api/favorites/check/:hotelId - Kiểm tra hotel có trong favorites không

### Request
```http
GET http://localhost:1000/api/favorites/check/68f6fb33d5d4ba93788cab3e?userId=68e5d4dc5330fe88ef797299
```

### URL Parameters
- `hotelId` (required): ID của hotel cần kiểm tra

### Query Parameters
- `userId` (required): ID của user

### Response Success - Hotel is favorited (200)
```json
{
    "isFavorited": true,
    "favorite": {
        "_id": "68f9a1b2c3d4e5f6g7h8i9j0",
        "user": "68e5d4dc5330fe88ef797299",
        "hotels": ["68f6fb33d5d4ba93788cab3e"],
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
    }
}
```

### Response Success - Hotel not favorited (200)
```json
{
    "isFavorited": false,
    "favorite": null
}
```

---

## 4. DELETE /api/favorites/:hotelId - Xóa hotel khỏi favorites

### Request
```http
DELETE http://localhost:1000/api/favorites/68f6fb33d5d4ba93788cab3e?userId=68e5d4dc5330fe88ef797299
```

### URL Parameters
- `hotelId` (required): ID của hotel cần xóa khỏi favorites

### Query Parameters
- `userId` (required): ID của user

### Response Success (200)
```json
{
    "message": "Hotel removed from favorites successfully.",
    "favorite": {
        "_id": "68f9a1b2c3d4e5f6g7h8i9j0",
        "user": "68e5d4dc5330fe88ef797299",
        "hotels": [],
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:35:00.000Z"
    }
}
```

### Response Error (404) - No favorites found
```json
{
    "message": "No favorites found for this user."
}
```

### Response Error (404) - Hotel not in favorites
```json
{
    "message": "Hotel not found in favorites."
}
```

---

## Test Data

### User IDs
```
68e5d4dc5330fe88ef797299
```

### Hotel IDs
```
68f6fb33d5d4ba93788cab3e (Grande Hotel Da Nang)
```

### Example cURL Commands

#### Add to favorites
```bash
curl -X POST http://localhost:1000/api/favorites \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "68e5d4dc5330fe88ef797299",
    "hotelId": "68f6fb33d5d4ba93788cab3e"
  }'
```

#### Get favorites
```bash
curl -X GET "http://localhost:1000/api/favorites?userId=68e5d4dc5330fe88ef797299"
```

#### Check favorite status
```bash
curl -X GET "http://localhost:1000/api/favorites/check/68f6fb33d5d4ba93788cab3e?userId=68e5d4dc5330fe88ef797299"
```

#### Remove from favorites
```bash
curl -X DELETE "http://localhost:1000/api/favorites/68f6fb33d5d4ba93788cab3e?userId=68e5d4dc5330fe88ef797299"
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (Hotel already in favorites, Invalid data) |
| 404 | Not Found (Hotel not found, User not found, Favorite not found) |
| 500 | Internal Server Error |
