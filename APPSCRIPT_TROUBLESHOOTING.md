# Hướng Dẫn Xử Lý Lỗi AppScript

## 🐛 Lỗi: "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"

Lỗi này xảy ra khi AppScript trả về **HTML** thay vì **JSON**. 

### Nguyên nhân có thể:

1. **AppScript chưa được deploy đúng cách**
2. **AppScript yêu cầu authentication** nhưng backend không có
3. **AppScript URL không đúng** hoặc đã thay đổi
4. **AppScript trả về redirect HTML** thay vì JSON trực tiếp

---

## ✅ CÁCH KIỂM TRA VÀ SỬA:

### Bước 1: Kiểm tra AppScript URL trong trình duyệt

Mở URL này trong trình duyệt:
```
https://script.google.com/a/macros/fpt.edu.vn/s/AKfycbz1MKWMTywURK2WyT5kBCduwNBrxUOvaFI0KRZW5Wd8w5UtmXzuihUmxFGJwtNNIpx5qw/exec
```

**Kết quả mong đợi:**
```json
{
  "data": [
    {
      "Mã GD": 12450088,
      "Mô tả": "...",
      "Giá trị": 2500,
      ...
    }
  ]
}
```

**Nếu thấy HTML** → AppScript chưa được deploy đúng

---

### Bước 2: Kiểm tra AppScript Deployment Settings

1. **Mở Google AppScript Editor** (script.google.com)
2. **Chọn script của bạn**
3. **Deploy → Manage deployments**
4. **Chọn deployment hiện tại hoặc tạo mới**

### Cài đặt QUAN TRỌNG:

```
✅ Type: Web app
✅ Execute as: Me (hoặc Service account nếu có)
✅ Who has access: Anyone (hoặc Anyone with Google account)
✅ Description: (có thể để trống)
```

**QUAN TRỌNG:** Phải chọn **"Anyone"** hoặc **"Anyone with Google account"** để backend có thể gọi mà không cần authentication!

---

### Bước 3: Kiểm tra AppScript Code

AppScript phải trả về JSON với format:

```javascript
function doGet(e) {
  try {
    // Đọc dữ liệu từ Google Sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    // Chuyển đổi thành format JSON
    var transactions = [];
    
    // Giả sử header ở dòng 1, data từ dòng 2
    var headers = data[0];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var transaction = {};
      
      for (var j = 0; j < headers.length; j++) {
        transaction[headers[j]] = row[j];
      }
      
      transactions.push(transaction);
    }
    
    // Trả về JSON
    return ContentService
      .createTextOutput(JSON.stringify({ data: transactions }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: error.toString(),
        data: [] 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

**ĐIỂM QUAN TRỌNG:**
- Phải dùng `ContentService.createTextOutput()`
- Phải set `MimeType.JSON`
- Phải trả về object có key `data`

---

### Bước 4: Test AppScript trực tiếp

Sau khi deploy, test URL trong browser hoặc Postman:

```bash
# Test với curl
curl "https://script.google.com/a/macros/fpt.edu.vn/s/AKfycbz1MKWMTywURK2WyT5kBCduwNBrxUOvaFI0KRZW5Wd8w5UtmXzuihUmxFGJwtNNIpx5qw/exec"
```

**Expected:** JSON response
**Actual (nếu lỗi):** HTML page với thông báo lỗi

---

### Bước 5: Kiểm tra Console Logs

Sau khi restart server và test lại, xem console logs:

```
[PAYMENT] Calling AppScript URL: ...
[PAYMENT] AppScript response Content-Type: application/json
```

Nếu thấy:
- `Content-Type: text/html` → AppScript chưa deploy đúng
- `responsePreview: <!DOCTYPE...` → AppScript trả về HTML error page

---

## 🔧 CÁCH SỬA:

### Option 1: Redeploy AppScript với settings đúng

1. Vào AppScript Editor
2. **Deploy → Manage deployments**
3. **Edit** (biểu tượng bút chì)
4. Chọn **"Execute as: Me"**
5. Chọn **"Who has access: Anyone"**
6. **Deploy**
7. Copy **Web app URL** mới (nếu có)
8. Update `APPSCRIPT_URL` trong `.env`

### Option 2: Kiểm tra AppScript có return JSON không

Mở AppScript code và đảm bảo:

```javascript
return ContentService
  .createTextOutput(JSON.stringify({ data: [...] }))
  .setMimeType(ContentService.MimeType.JSON);
```

### Option 3: Test với Postman trước

1. Mở Postman
2. Tạo GET request tới AppScript URL
3. Kiểm tra response:
   - ✅ JSON → OK
   - ❌ HTML → Cần fix AppScript

---

## 📝 CHECKLIST:

- [ ] AppScript URL mở được trong browser và trả về JSON
- [ ] AppScript deployment setting: "Who has access: Anyone"
- [ ] AppScript code sử dụng `ContentService.setMimeType(JSON)`
- [ ] AppScript trả về format: `{ data: [...] }`
- [ ] `.env` file có `APPSCRIPT_URL` đúng
- [ ] Server đã restart sau khi thay đổi

---

## 🆘 Nếu vẫn lỗi:

1. **Kiểm tra console logs** để xem response preview
2. **Test AppScript URL trực tiếp** trong browser
3. **Kiểm tra Google Sheet** có dữ liệu không
4. **Kiểm tra quyền truy cập** Google Sheet trong AppScript

---

## 💡 Gợi ý Debug:

Code đã được cập nhật để log chi tiết:
- Content-Type của response
- Preview 500 ký tự đầu của response
- Chi tiết lỗi nếu có

Xem logs trong console để biết chính xác vấn đề!

