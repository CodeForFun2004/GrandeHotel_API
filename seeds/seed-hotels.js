const Hotel = require('../models/hotelModel');

module.exports = async function seedHotels() {
  // Create at least 5 "Grande Hotel" entries with simple variations
  const base = {
    address: 'Ocean Drive, Da Nang, Vietnam',
    email: 'contact@grandehotel.vn',
    phone: '+84 236 123 4567',
    description: 'The Grande Hotel – a modern, comfortable stay by the beach.',
    status: 'available',
    images: []
  };

  const sample = Array.from({ length: 5 }).map((_, i) => ({
    name: `Grande Hotel ${i + 1}`,
    address: `${i + 1} ${base.address}`,
    email: base.email.replace('@', `+${i + 1}@`),
    phone: `+84 236 123 45${(67 + i).toString().padStart(2, '0')}`,
    description: base.description,
    status: base.status,
    images: base.images
  }));

  await Hotel.deleteMany({});
  const docs = await Hotel.insertMany(sample);
  console.log(`🏨 Seeded ${docs.length} hotel(s): ${docs.map(d => d.name).join(', ')}`);
  return docs;
};
