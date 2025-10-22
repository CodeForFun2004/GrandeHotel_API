const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Hotel = require('../models/hotelModel');
const RoomType = require('../models/roomTypeModel');
const Room = require('../models/roomModel');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

async function seedManagerData() {
  try {
    await connectDB();
    
    console.log('🌱 Seeding manager data...');
    
    // 1. Create test hotel if not exists
    let testHotel = await Hotel.findOne({ name: 'Test Manager Hotel' });
    if (!testHotel) {
      testHotel = new Hotel({
        name: 'Test Manager Hotel',
        address: '123 Test Street, Test City',
        email: 'test@hotel.com',
        phone: '+1234567890',
        description: 'Test hotel for manager functionality',
        status: 'available',
        images: []
      });
      await testHotel.save();
      console.log('✅ Test hotel created');
    }
    
    // 2. Create test manager user
    let testManager = await User.findOne({ email: 'manager@test.com' });
    if (!testManager) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      testManager = new User({
        fullname: 'Test Manager',
        username: 'test_manager',
        email: 'manager@test.com',
        password: hashedPassword,
        phone: '+1234567890',
        address: '123 Manager Street',
        role: 'hotel-manager',
        hotelId: testHotel._id,
        isBanned: false
      });
      await testManager.save();
      console.log('✅ Test manager created');
    }
    
    // 3. Create test room types
    const roomTypesData = [
      {
        name: 'Standard Room',
        description: 'Comfortable standard room',
        basePrice: 100,
        maxCapacity: 2,
        amenities: ['WiFi', 'TV', 'Air Conditioning'],
        isActive: true,
        hotel: testHotel._id
      },
      {
        name: 'Deluxe Suite',
        description: 'Luxurious deluxe suite',
        basePrice: 250,
        maxCapacity: 4,
        amenities: ['WiFi', 'TV', 'Mini Bar', 'Balcony', 'Jacuzzi'],
        isActive: true,
        hotel: testHotel._id
      },
      {
        name: 'Family Room',
        description: 'Spacious family room',
        basePrice: 180,
        maxCapacity: 6,
        amenities: ['WiFi', 'TV', 'Kitchenette', 'Sofa Bed'],
        isActive: true,
        hotel: testHotel._id
      }
    ];
    
    // Clear existing room types for this hotel
    await RoomType.deleteMany({ hotel: testHotel._id });
    
    const roomTypes = [];
    for (const roomTypeData of roomTypesData) {
      const roomType = new RoomType({
        ...roomTypeData,
        capacity: roomTypeData.maxCapacity,
        numberOfBeds: Math.ceil(roomTypeData.maxCapacity / 2)
      });
      await roomType.save();
      roomTypes.push(roomType);
      console.log(`✅ Room type created: ${roomType.name}`);
    }
    
    // 4. Create test rooms
    const roomsData = [
      {
        code: 'STD-101',
        name: 'Standard Room 101',
        roomNumber: '101',
        status: 'Active',
        description: 'Standard room with city view',
        pricePerNight: 100,
        capacity: 2,
        images: [],
        roomType: roomTypes[0]._id,
        hotel: testHotel._id
      },
      {
        code: 'STD-102',
        name: 'Standard Room 102',
        roomNumber: '102',
        status: 'Active',
        description: 'Standard room with garden view',
        pricePerNight: 100,
        capacity: 2,
        images: [],
        roomType: roomTypes[0]._id,
        hotel: testHotel._id
      },
      {
        code: 'DLX-201',
        name: 'Deluxe Suite 201',
        roomNumber: '201',
        status: 'Active',
        description: 'Luxurious suite with ocean view',
        pricePerNight: 250,
        capacity: 4,
        images: [],
        roomType: roomTypes[1]._id,
        hotel: testHotel._id
      },
      {
        code: 'FAM-301',
        name: 'Family Room 301',
        roomNumber: '301',
        status: 'Active',
        description: 'Spacious family room',
        pricePerNight: 180,
        capacity: 6,
        images: [],
        roomType: roomTypes[2]._id,
        hotel: testHotel._id
      },
      {
        code: 'STD-103',
        name: 'Standard Room 103',
        roomNumber: '103',
        status: 'Maintenance',
        description: 'Standard room under maintenance',
        pricePerNight: 100,
        capacity: 2,
        images: [],
        roomType: roomTypes[0]._id,
        hotel: testHotel._id
      }
    ];
    
    // Clear existing rooms for this hotel
    await Room.deleteMany({ hotel: testHotel._id });
    
    for (const roomData of roomsData) {
      const room = new Room(roomData);
      await room.save();
      console.log(`✅ Room created: ${room.name}`);
    }
    
    console.log('\n🎉 Manager data seeding completed!');
    console.log('\n📋 Test Data Summary:');
    console.log(`🏨 Hotel: ${testHotel.name} (ID: ${testHotel._id})`);
    console.log(`👤 Manager: ${testManager.fullname} (Email: ${testManager.email})`);
    console.log(`🏷️  Room Types: ${roomTypes.length} created`);
    console.log(`🚪 Rooms: ${roomsData.length} created`);
    console.log('\n🔑 Test Manager Credentials:');
    console.log('Email: manager@test.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('❌ Error seeding manager data:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  seedManagerData();
}

module.exports = seedManagerData;
