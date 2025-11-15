const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/user.model');
const Hotel = require('../models/hotelModel');

module.exports = async function seedUsers() {
  await User.deleteMany({});

  const hotel = await Hotel.findOne({ name: /Grande Hotel/i }).sort({ name: 1 });

  const users = [
    {
      username: 'customer1',
      fullname: 'Customer One',
      email: 'customer1@example.com',
      password: '123', // will be hashed by pre-save hook
      role: 'customer',
    },
    {
      username: 'staff1',
      fullname: 'Staff One',
      email: 'staff1@example.com',
      password: 'staff123',
      role: 'staff',
      hotelId: hotel?._id || null,
    },
    {
      username: 'manager1',
      fullname: 'Manager One',
      email: 'manager1@example.com',
      password: 'manager123',
      role: 'hotel-manager',
      hotelId: hotel?._id || null,
    },
  ];

  const created = await User.insertMany(users);
  console.log(`👤 Seeded ${created.length} users`);
  return created;
}

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
