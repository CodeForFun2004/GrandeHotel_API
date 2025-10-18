const Hotel = require('../models/hotelModel');

module.exports = async function seedHotels() {
  const sample = [
  {
    "name": "Mường Thanh Luxury Saigon Hotel",
    "address": "261C Nguyen Van Troi, Phu Nhuan District, Ho Chi Minh City, Vietnam",
    "email": "saigon@muongthanh.vn",
    "phone": "+84 28 3999 6688",
    "description": "A luxury hotel located in the heart of Saigon, offering modern rooms, fine dining, and easy access to Tan Son Nhat Airport.",
    "status": "available",
    "images": [
      "https://muongthanh.com/files/images/saigon-1.jpg",
      "https://muongthanh.com/files/images/saigon-2.jpg"
    ]
  },
  {
    "name": "Mường Thanh Luxury Hà Nội Centre Hotel",
    "address": "78 Tho Nhuom Street, Hoan Kiem District, Hanoi, Vietnam",
    "email": "hanoicentre@muongthanh.vn",
    "phone": "+84 24 3933 3333",
    "description": "Located in Hanoi’s Old Quarter, this hotel blends Vietnamese hospitality with 5-star amenities and scenic views of the city.",
    "status": "available",
    "images": [
      "https://muongthanh.com/files/images/hanoi-centre-1.jpg",
      "https://muongthanh.com/files/images/hanoi-centre-2.jpg"
    ]
  },
  {
    "name": "Mường Thanh Grand Nha Trang Hotel",
    "address": "60 Tran Phu Street, Loc Tho Ward, Nha Trang, Khanh Hoa, Vietnam",
    "email": "nhatrang@muongthanh.vn",
    "phone": "+84 258 389 6789",
    "description": "Located on the main beach road, this hotel offers sea-view rooms, a rooftop pool, and easy access to Nha Trang nightlife.",
    "status": "available",
    "images": [
      "https://muongthanh.com/files/images/nhatrang-1.jpg",
      "https://muongthanh.com/files/images/nhatrang-2.jpg"
    ]
  },
  {
    "name": "Mường Thanh Holiday Da Nang Hotel",
    "address": "962 Ngo Quyen Street, Son Tra District, Da Nang, Vietnam",
    "email": "danang@muongthanh.vn",
    "phone": "+84 236 392 9999",
    "description": "A beachfront hotel featuring contemporary design, spa services, and proximity to Da Nang’s most famous attractions.",
    "status": "available",
    "images": [
      "https://muongthanh.com/files/images/danang-1.jpg",
      "https://muongthanh.com/files/images/danang-2.jpg"
    ]
  },
  {
    "name": "Mường Thanh Luxury Quảng Ninh Hotel",
    "address": "Ha Long Road, Bai Chay Ward, Ha Long City, Quang Ninh Province, Vietnam",
    "email": "quangninh@muongthanh.vn",
    "phone": "+84 203 381 1999",
    "description": "Overlooking Ha Long Bay, this hotel offers premium accommodations, fine dining, and event facilities.",
    "status": "available",
    "images": [
      "https://muongthanh.com/files/images/quangninh-1.jpg",
      "https://muongthanh.com/files/images/quangninh-2.jpg"
    ]
  },
  {
    "name": "Mường Thanh Grand Phương Đông Hotel",
    "address": "02 Ha Huy Tap Street, Vinh City, Nghe An Province, Vietnam",
    "email": "phuongdong@muongthanh.vn",
    "phone": "+84 238 383 8888",
    "description": "One of the earliest Mường Thanh hotels, offering traditional charm and comfortable rooms in the center of Vinh City.",
    "status": "available",
    "images": [
      "https://muongthanh.com/files/images/phuongdong-1.jpg",
      "https://muongthanh.com/files/images/phuongdong-2.jpg"
    ]
  }
];

  await Hotel.deleteMany({});
  const docs = await Hotel.insertMany(sample);
  console.log(`🏨 Seeded ${docs.length} hotels`);
  return docs;
};
