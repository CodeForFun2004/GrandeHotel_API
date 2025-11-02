const Room = require('../models/roomModel');

module.exports = async function seedRooms({ hotels, roomTypes }) {
  await Room.deleteMany({});

  const rooms = [];
  for (let hIdx = 0; hIdx < hotels.length; hIdx++) {
    const hotel = hotels[hIdx];
    const hotelPrefix = (hIdx + 1) * 1000; // ensures global uniqueness across hotels
    let seriesOffset = 100; // 100-series per room type
    for (const rt of roomTypes) {
      // Create 5 rooms per type per hotel
      for (let i = 0; i < 5; i++) {
        const roomNumber = hotelPrefix + seriesOffset + i; // e.g., 1100,1101,... then 1200,...; 2100 for hotel 2, etc.
        const code = `${(rt.name || 'RT').slice(0, 3).toUpperCase()}-${roomNumber}`;
        rooms.push({
          hotel: hotel._id,
          roomType: rt._id,
          roomNumber: `${roomNumber}`,
          status: 'Available',
          description: `${rt.name} room at ${hotel.name}`,
          pricePerNight: rt.basePrice + i * 5 * 1000,
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
