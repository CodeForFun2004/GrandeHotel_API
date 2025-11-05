const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Room = require('../models/roomModel');
const Hotel = require('../models/hotelModel');
const RoomType = require('../models/roomTypeModel');

module.exports = async function seedRooms({ hotels, roomTypes } = {}) {
  // Auto-fetch dependencies when not provided to allow standalone execution
  if (!hotels) hotels = await Hotel.find({});
  if (!roomTypes) roomTypes = await RoomType.find({});

  await Room.deleteMany({});

  const rooms = [];
  for (let hIdx = 0; hIdx < hotels.length; hIdx++) {
    const hotel = hotels[hIdx];
    const hotelPrefix = (hIdx + 1) * 1000; // ensures global uniqueness across hotels
    let seriesOffset = 100; // 100-series per room type
    for (const rt of roomTypes) {
      // Create 5 rooms per type per hotel
      for (let i = 0; i < 5; i++) {
        const roomNumber = hotelPrefix + seriesOffset + i; // e.g., 1100, 1101, then 1200, ...; 2100 for hotel 2, etc.
        const code = `${(rt.name || 'RT').slice(0, 3).toUpperCase()}-${roomNumber}`;
        // Price strictly based on room type's base price (clamped to range)
        const base = Number(rt.basePrice) && !isNaN(Number(rt.basePrice)) ? Number(rt.basePrice) : 1000000;
        const pricePerNight = Math.min(4000000, Math.max(800000, base));
        rooms.push({
          hotel: hotel._id,
          roomType: rt._id,
          roomNumber: `${roomNumber}`,
          status: 'Available',
          description: `${rt.name} room at ${hotel.name}`,
          // Price equals the room type base price
          pricePerNight,
          images: [],
          code
        });
      }
      seriesOffset += 100;
    }
  }

  const docs = await Room.insertMany(rooms);
  console.log(`🚪 Seeded ${docs.length} rooms`);
  return docs;
};

// Allow running individually
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await module.exports();
    } catch (e) {
      console.error(e);
    } finally {
      await mongoose.connection.close();
      process.exit(0);
    }
  })();
}
