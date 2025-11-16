const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Service = require('../models/serviceModel');
const Hotel = require('../models/hotelModel');

module.exports = async function seedServices(hotels = null) {
  // Auto-fetch hotels if not supplied for standalone execution
  if (!hotels) hotels = await Hotel.find({});

  // VND-based service pricing
  const baseServices = [
    { name: 'Breakfast Buffet', description: 'All-you-can-eat breakfast buffet', basePrice: 150000 },
    { name: 'Airport Pickup', description: 'Private transfer from airport to hotel', basePrice: 400000 },
    { name: 'Room Cleaning', description: 'Daily room cleaning service', basePrice: 70000 },
    { name: 'Spa Access', description: 'Access to hotel spa facilities', basePrice: 350000 },
    { name: 'Extra Bed', description: 'Rollaway extra bed for an additional guest', basePrice: 200000 },
    { name: 'Laundry Service', description: 'Per load laundry service', basePrice: 80000 },
    { name: 'Mini-Bar Refill', description: 'Restock mini-bar items', basePrice: 120000 },
  ];

  await Service.deleteMany({});

  const docs = [];
  for (const hotel of hotels) {
    for (const s of baseServices) {
      docs.push({ hotel: hotel._id, ...s });
    }
  }

  const inserted = await Service.insertMany(docs);
  console.log(`🛎️  Seeded ${inserted.length} services (VND)`);
  return inserted;
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
