const Service = require('../models/serviceModel');

module.exports = async function seedServices(hotels = []) {
  // Sample services to add to each hotel
  const baseServices = [
    { name: 'Breakfast Buffet', description: 'All-you-can-eat breakfast buffet', basePrice: 10 },
    { name: 'Airport Pickup', description: 'Private transfer from airport to hotel', basePrice: 25 },
    { name: 'Room Cleaning', description: 'Daily room cleaning service', basePrice: 5 },
    { name: 'Spa Access', description: 'Complimentary access to hotel spa facilities', basePrice: 20 },
    { name: 'Extra Bed', description: 'Rollaway extra bed for an additional guest', basePrice: 15 }
  ];

  await Service.deleteMany({});

  const docs = [];
  for (const hotel of hotels) {
    for (const s of baseServices) {
      docs.push({ hotel: hotel._id, ...s });
    }
  }

  const inserted = await Service.insertMany(docs);
  console.log(`🛎️  Seeded ${inserted.length} services`);
  return inserted;
};
