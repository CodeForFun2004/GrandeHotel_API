const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Stay = require('../models/stayModel');
const Reservation = require('../models/reservationModel');
const Room = require('../models/roomModel');

module.exports = async function seedStays() {
  await Stay.deleteMany({});

  // Pick one approved reservation to create a stay
  const reservation = await Reservation.findOne({ status: 'approved' }).populate('details').populate('hotel').populate('customer');
  if (!reservation) {
    console.log('⚠️  No approved reservation found, skipping stays seed');
    return null;
  }

  // Find rooms in the hotel, pick 2
  const rooms = await Room.find({ hotel: reservation.hotel }).limit(2);
  if (rooms.length === 0) {
    console.log('⚠️  No rooms found to attach to stay');
    return null;
  }

  const stay = await Stay.create({
    reservation: reservation._id,
    hotel: reservation.hotel._id || reservation.hotel,
    customer: reservation.customer._id || reservation.customer,
    details: [],
    actualCheckIn: new Date(),
    status: 'Checked in',
    notes: 'Seeded stay record',
  });

  console.log(`🛌 Seeded 1 stay for reservation ${String(reservation._id).slice(-6).toUpperCase()}`);
  return stay;
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
