const mongoose = require('mongoose');
const connectDB = require('../config/database');

const seedHotels = require('./seed-hotels');
const seedRoomTypes = require('./seed-room-types');
const seedRooms = require('./seed-rooms');
const seedServices = require('./seed-services');

(async () => {
  try {
    await connectDB();

    const shouldDrop = process.argv.includes('--drop');
    if (shouldDrop) {
      await mongoose.connection.dropDatabase();
      console.log('⚠️  Dropped existing database');
    }

  const hotels = await seedHotels();
  // seed services tied to hotels
  const services = await seedServices(hotels);
  const roomTypes = await seedRoomTypes();
  await seedRooms({ hotels, roomTypes });

    console.log('✅ Seeding completed');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
})();
