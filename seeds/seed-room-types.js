const RoomType = require('../models/roomTypeModel');

module.exports = async function seedRoomTypes() {
  const types = [
    { name: 'Standard', description: 'Cozy room', capacity: 2, basePrice: 80, numberOfBeds: 1 },
    { name: 'Deluxe', description: 'More space and comfort', capacity: 3, basePrice: 120, numberOfBeds: 2 },
    { name: 'Suite', description: 'Separate living area', capacity: 4, basePrice: 200, numberOfBeds: 2 },
    { name: 'Family Room', description: 'Spacious room for families', capacity: 5, basePrice: 150, numberOfBeds: 3 },
    { name: 'Single Room', description: 'Ideal for solo travelers', capacity: 1, basePrice: 60, numberOfBeds: 1 },
    { name: 'Double Room', description: 'Perfect for couples', capacity: 2, basePrice: 90, numberOfBeds: 1 },
    { name: 'Executive Suite', description: 'Luxurious suite with premium amenities', capacity: 4, basePrice: 250, numberOfBeds: 2 }
  ];

  await RoomType.deleteMany({});
  const docs = await RoomType.insertMany(types);
  console.log(`Seeded ${docs.length} room types`);
  return docs;
};
