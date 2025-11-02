const mongoose = require('mongoose');
const connectDB = require('../config/database');

const seedHotels = require('./seed-hotels');
const seedUsers = require('./seed-users');
const seedRoomTypes = require('./seed-room-types');
const seedRooms = require('./seed-rooms');
const seedServices = require('./seed-services');
const seedReservations = require('./seed-reservations');
const seedStays = require('./seed-stays');

(async () => {
  try {
    await connectDB();

    const shouldDrop = process.argv.includes('--drop');
    if (shouldDrop) {
      await mongoose.connection.dropDatabase();
      console.log('⚠️  Dropped existing database');
    }

  const hotels = await seedHotels();
  // users depend on hotels for staff/manager hotelId
  const users = await seedUsers();
  // seed services tied to hotels
  const services = await seedServices(hotels);
  const roomTypes = await seedRoomTypes();
  await seedRooms({ hotels, roomTypes });
  // reservations + payments
  const { reservations } = await seedReservations();
  // stays (optional, will create for one approved reservation)
  await seedStays();

    console.log('✅ Seeding completed');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
})();
