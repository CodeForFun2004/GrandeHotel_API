const mongoose = require('mongoose');
const connectDB = require('../config/database');
const RoomType = require('../models/roomTypeModel');

module.exports = async function seedRoomTypes() {
  // All prices in VND (800,000 – 4,000,000)
  const types = [
    { name: 'Single Room', description: 'Ideal for solo travelers', capacity: 1, basePrice: 800000, numberOfBeds: 1 },
    { name: 'Standard', description: 'Cozy room', capacity: 2, basePrice: 900000, numberOfBeds: 1 },
    { name: 'Double Room', description: 'Perfect for couples', capacity: 2, basePrice: 1200000, numberOfBeds: 1 },
    { name: 'Deluxe', description: 'More space and comfort', capacity: 3, basePrice: 1600000, numberOfBeds: 2 },
    { name: 'Family Room', description: 'Spacious room for families', capacity: 5, basePrice: 2000000, numberOfBeds: 3 },
    { name: 'Suite', description: 'Separate living area', capacity: 4, basePrice: 3000000, numberOfBeds: 2 },
    { name: 'Executive Suite', description: 'Luxurious suite with premium amenities', capacity: 4, basePrice: 4000000, numberOfBeds: 2 },
  ];

  await RoomType.deleteMany({});
  const docs = await RoomType.insertMany(types);
  console.log(`🏷️  Seeded ${docs.length} room types (VND)`);
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
