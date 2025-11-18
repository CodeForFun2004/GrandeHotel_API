# flaskserver.py - Flask AI Service với MongoDB
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import base64
from io import BytesIO
import requests

import numpy as np
from pymongo import MongoClient
from PIL import Image
import face_recognition

# Load .env file nếu có
try:
    from dotenv import load_dotenv
    # Thử load từ nhiều vị trí
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)  # Lên 1 level từ ai-service/
    
    # Thử các đường dẫn
    env_paths = [
        os.path.join(root_dir, '.env'),  # Root directory
        os.path.join(script_dir, '.env'),  # Trong ai-service/
        '.env'  # Current working directory
    ]
    
    loaded = False
    for env_path in env_paths:
        abs_path = os.path.abspath(env_path)
        if os.path.exists(abs_path):
            load_dotenv(abs_path)
            print(f"[Config]  Loaded .env from: {abs_path}")
            loaded = True
            break
    
    if not loaded:
        print(f"[Config]   .env file not found in any of these locations:")
        for env_path in env_paths:
            print(f"[Config]    - {os.path.abspath(env_path)}")
except ImportError:
    print("[Config]   python-dotenv not installed, using system environment variables only")
except Exception as e:
    print(f"[Config]   Warning: Could not load .env file: {e}")
    import traceback
    traceback.print_exc()

# ----------------------------
# Config & App
# ----------------------------
app = Flask(__name__)
CORS(app)  # Cho phép mọi origin trong dev; khi lên prod nên giới hạn domain

# Environment variables (có thể đặt qua biến môi trường hệ thống)
# Parse từ MONGO_URI nếu có, nếu không thì dùng defaults
MONGO_URI = os.getenv("MONGO_URI", "")
print(f"[Config] MONGO_URI from env: {MONGO_URI[:50]}..." if MONGO_URI else "[Config] MONGO_URI not found")

if MONGO_URI:
    # Parse database name từ mongodb://host:port/dbname
    try:
        # Remove protocol prefix
        uri_without_protocol = MONGO_URI.replace("mongodb://", "").replace("mongodb+srv://", "")
        
        # Split để lấy phần path (database name)
        if "/" in uri_without_protocol:
            parts = uri_without_protocol.split("/")
            db_name = parts[-1].split("?")[0]  # Lấy tên DB, bỏ query params
            DB_NAME = db_name if db_name else "grand_hotel"
            # Parse host và port từ phần đầu
            host_port = parts[0].split(":")
            DB_HOST = host_port[0] if host_port else "localhost"
            DB_PORT = int(host_port[1]) if len(host_port) > 1 else 27017
        else:
            # Không có database name trong URI
            DB_NAME = os.getenv("DB_NAME", "grand_hotel")
            host_port = uri_without_protocol.split(":")
            DB_HOST = host_port[0] if host_port else "localhost"
            DB_PORT = int(host_port[1]) if len(host_port) > 1 else 27017
        
        print(f"[Config] Parsed from MONGO_URI: DB_HOST={DB_HOST}, DB_PORT={DB_PORT}, DB_NAME={DB_NAME}")
    except Exception as e:
        print(f"[ERROR] Failed to parse MONGO_URI: {e}, using defaults")
        import traceback
        traceback.print_exc()
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_PORT = int(os.getenv("DB_PORT", "27017"))
        DB_NAME = os.getenv("DB_NAME", "grand_hotel")
else:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "27017"))
    DB_NAME = os.getenv("DB_NAME", "grand_hotel")

print(f"[Config] Final config: DB_HOST={DB_HOST}, DB_PORT={DB_PORT}, DB_NAME={DB_NAME}")

# Ngưỡng so khớp (càng nhỏ càng chặt) – 0.48 là điểm khởi đầu tốt
FACE_THRESHOLD = float(os.getenv("FACE_THRESHOLD", "0.48"))

# Port Flask
FLASK_PORT = int(os.getenv("FLASK_PORT", "9000"))


# ----------------------------
# MongoDB Connection
# ----------------------------
def get_db_connection():
    """Kết nối MongoDB. Trả về database object."""
    try:
        client = MongoClient(f"mongodb://{DB_HOST}:{DB_PORT}/")
        db = client[DB_NAME]
        # Test connection
        db.command('ping')
        return db
    except Exception as e:
        print(f"MongoDB connection error: {e}")
        raise


# ----------------------------
# Utils
# ----------------------------
def dataurl_to_image_array(data_url: str):
    """
    Nhận dataURL (data:image/png;base64,...) -> trả về numpy array cho face_recognition.
    Ném Exception nếu ảnh không hợp lệ.
    """
    if not data_url or not isinstance(data_url, str) or "," not in data_url:
        raise ValueError("Missing or invalid image field (dataURL).")

    try:
        b64 = data_url.split(",", 1)[1]
        image_bytes = base64.b64decode(b64)
    except Exception as e:
        raise ValueError(f"Base64 decode failed: {e}")

    # Dùng PIL để verify rồi chuyển sang buffer cho face_recognition
    try:
        pil_img = Image.open(BytesIO(image_bytes))
        pil_img.verify()  # verify định dạng
        pil_img = Image.open(BytesIO(image_bytes))  # reopen thực sự để load
        buf = BytesIO()
        # Lưu về PNG để ổn định decoder của face_recognition
        pil_img.save(buf, format="PNG")
        buf.seek(0)
        img_array = face_recognition.load_image_file(buf)
        return img_array
    except Exception as e:
        raise ValueError(f"Invalid image format or processing error: {e}")


def encode_single_face(img_array):
    """
    Trả về encoding (128-dim) của khuôn mặt đầu tiên.
    Nếu không có hoặc có quá nhiều khuôn mặt, raise lỗi rõ ràng để FE biết xử lý.
    """
    try:
        # Có thể dùng model 'cnn' cho detect chính xác hơn (nhưng chậm); mặc định HOG đủ cho dev
        face_locations = face_recognition.face_locations(img_array)  # , model='hog' | 'cnn'
        if len(face_locations) == 0:
            raise ValueError("No face detected in the image")
        if len(face_locations) > 1:
            raise ValueError("Multiple faces detected; please ensure only one face is in the frame")

        encs = face_recognition.face_encodings(img_array, known_face_locations=face_locations)
        if not encs:
            raise ValueError("Face encoding failed")
        return encs[0]
    except Exception as e:
        # Bọc lại thành ValueError để route trả 400
        raise ValueError(str(e))


def load_all_user_encodings_from_db():
    """
    Đọc danh sách người dùng từ MongoDB, tải ảnh từ Cloudinary URL, encode khuôn mặt.
    Trả về (encodings:list[np.ndarray], users:list[dict]).
    Bỏ qua user nếu:
      - Không có ảnh
      - Ảnh không tồn tại
      - Ảnh không có mặt
    """
    encodings = []
    users_info = []

    try:
        print(f"[DEBUG] Connecting to MongoDB: {DB_HOST}:{DB_PORT}/{DB_NAME}")
        db = get_db_connection()
        users_collection = db.users
        
        # Kiểm tra tổng số users
        total_users = users_collection.count_documents({})
        print(f"[DEBUG] Total users in database: {total_users}")
        
        # Kiểm tra số users có photoFace
        users_with_photo = users_collection.count_documents({"photoFace": {"$exists": True, "$ne": None, "$ne": ""}})
        print(f"[DEBUG] Users with photoFace: {users_with_photo}")
        
        # Lấy tất cả users (chỉ các field cần thiết)
        users = users_collection.find(
            {},
            {"fullname": 1, "email": 1, "phone": 1, "role": 1, "photoFace": 1, "username": 1}
        )
        
        user_count = 0
        no_photo_count = 0
        download_error_count = 0
        no_face_count = 0
        encoding_error_count = 0
        success_count = 0

        for user in users:
            user_count += 1
            username = user.get("username", "unknown")
            photo_url = user.get("photoFace")
            
            if not photo_url:
                no_photo_count += 1
                print(f"[DEBUG] User {user_count} ({username}): No photoFace")
                continue

            print(f"[DEBUG] Processing user {user_count} ({username}): photoFace={photo_url[:50]}...")

            try:
                # Download image from Cloudinary URL
                response = requests.get(photo_url, timeout=10)
                if response.status_code != 200:
                    download_error_count += 1
                    print(f"[DEBUG] Failed to download image for {username}: HTTP {response.status_code}")
                    continue
                
                # Load image into memory buffer
                img_bytes = BytesIO(response.content)
                img_array = face_recognition.load_image_file(img_bytes)
                
                stored_locations = face_recognition.face_locations(img_array)
                if not stored_locations:
                    no_face_count += 1
                    print(f"[DEBUG] No face detected in image for {username}")
                    continue

                stored_encs = face_recognition.face_encodings(img_array, known_face_locations=stored_locations)
                if not stored_encs:
                    encoding_error_count += 1
                    print(f"[DEBUG] Encoding failed for {username}")
                    continue

                encodings.append(stored_encs[0])
                users_info.append({
                    "username": user.get("username"),
                    "fullname": user.get("fullname"),
                    "email": user.get("email"),
                    "phone": user.get("phone"),
                    "role": user.get("role"),
                    "photoFace": photo_url
                })
                success_count += 1
                print(f"[DEBUG]  Successfully loaded encoding for {username}")
            except Exception as e:
                print(f"[DEBUG] Error processing image for {username}: {str(e)}")
                continue

        print(f"[DEBUG] === Load Summary ===")
        print(f"[DEBUG] Total users processed: {user_count}")
        print(f"[DEBUG] Users without photoFace: {no_photo_count}")
        print(f"[DEBUG] Download errors: {download_error_count}")
        print(f"[DEBUG] No face detected: {no_face_count}")
        print(f"[DEBUG] Encoding errors: {encoding_error_count}")
        print(f"[DEBUG] Successfully loaded: {success_count}")
        print(f"[DEBUG] Final encodings count: {len(encodings)}")

    except Exception as e:
        print(f"[ERROR] Error loading from MongoDB: {str(e)}")
        import traceback
        traceback.print_exc()

    return encodings, users_info


# ----------------------------
# Routes
# ----------------------------
@app.route("/compare-image", methods=["POST"])
def compare_image():
    """
    Nhận ảnh từ FE (dataURL), so khớp 1:N với tất cả user đã đăng ký theo khoảng cách vector.
    Trả về user best-match nếu min_distance <= FACE_THRESHOLD.
    """
    try:
        data = request.get_json(silent=True) or {}
        data_url = data.get("image")
        print("Received image data:", (data_url or "")[:100])

        # 1) Decode & convert to array
        try:
            img_array = dataurl_to_image_array(data_url)
        except ValueError as e:
            return jsonify({"success": False, "message": str(e)}), 400

        # 2) Encode face (1 khuôn mặt)
        try:
            live_enc = encode_single_face(img_array)
        except ValueError as e:
            return jsonify({"success": False, "message": str(e)}), 400

        # 3) Load tất cả encodings đã đăng ký
        print("[DEBUG] Loading all user encodings from database...")
        known_encs, users_info = load_all_user_encodings_from_db()
        print(f"[DEBUG] Loaded {len(known_encs)} encodings, {len(users_info)} user info")
        if not known_encs:
            return jsonify({
                "success": False, 
                "message": "No registered faces to compare",
                "debug": "Check server logs for details"
            }), 200

        # 4) Tính khoảng cách & chọn best match
        distances = face_recognition.face_distance(known_encs, live_enc)
        min_idx = int(np.argmin(distances))
        min_dist = float(distances[min_idx])

        print(f"[Match] idx={min_idx}, dist={min_dist:.4f}, threshold={FACE_THRESHOLD}")

        if min_dist <= FACE_THRESHOLD:
            user = users_info[min_idx]
            return jsonify({"success": True, **user}), 200
        else:
            return jsonify({"success": False, "message": "No matching user found"}), 200

    except Exception as e:
        # Lỗi bất ngờ phía server
        print("Server error:", str(e))
        return jsonify({"success": False, "message": "An error occurred on the server"}), 500


@app.route("/health")
def health():
    """Health check endpoint"""
    try:
        db = get_db_connection()
        db.command('ping')
        db_status = "connected"
        
        # Thêm thông tin debug
        users_collection = db.users
        total_users = users_collection.count_documents({})
        users_with_photo = users_collection.count_documents({"photoFace": {"$exists": True, "$ne": None, "$ne": ""}})
        
        debug_info = {
            "database": DB_NAME,
            "total_users": total_users,
            "users_with_photoFace": users_with_photo
        }
    except Exception as e:
        db_status = "disconnected"
        debug_info = {"error": str(e)}
    
    return jsonify({
        "ok": True,
        "threshold": FACE_THRESHOLD,
        "mongodb": db_status,
        "debug": debug_info
    }), 200


# ----------------------------
# Main
# ----------------------------
if __name__ == "__main__":
    try:
        print("=" * 50)
        print("[Flask] Flask AI Service Starting...")
        print(f"[Flask] Port: {FLASK_PORT}")
        print(f"[Flask] Database: {DB_NAME}@{DB_HOST}:{DB_PORT}")
        print(f"[Flask] Threshold: {FACE_THRESHOLD}")
        print("=" * 50)
        
        # Test database connection trước khi start
        try:
            db = get_db_connection()
            print("[Flask]  Database connection test successful")
        except Exception as db_error:
            print(f"[Flask]   Warning: Database connection test failed: {db_error}")
            print("[Flask] Continuing anyway...")
        
        # Debug=False cho gần giống prod; khi dev có thể bật True để xem stacktrace
        app.run(host="0.0.0.0", port=FLASK_PORT, debug=False)
    except KeyboardInterrupt:
        print("\n[Flask] Server stopped by user")
    except Exception as e:
        print(f"[Flask]  FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

