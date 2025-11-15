const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Hotel = require('../models/hotelModel');

module.exports = async function seedHotels() {
  // Curated list of cities with realistic addresses & phone codes
  const cities = [
    { city: 'Da Nang', name: 'Grande Hotel Da Nang', address: '36 Bach Dang, Hai Chau, Da Nang, Vietnam', phone: '+84 236 3 888 999' },
    { city: 'Ha Noi', name: 'Grande Hotel Ha Noi', address: '12 Ly Thai To, Hoan Kiem, Ha Noi, Vietnam', phone: '+84 24 3 888 9999' },
    { city: 'Ho Chi Minh City', name: 'Grande Hotel Ho Chi Minh', address: '8 Dong Khoi, District 1, Ho Chi Minh City, Vietnam', phone: '+84 28 3 888 9999' },
    { city: 'Nha Trang', name: 'Grande Hotel Nha Trang', address: '64 Tran Phu, Loc Tho, Nha Trang, Vietnam', phone: '+84 258 3 888 999' },
    { city: 'Da Lat', name: 'Grande Hotel Da Lat', address: '1 Le Dai Hanh, Ward 1, Da Lat, Vietnam', phone: '+84 263 3 888 999' },
    { city: 'Hai Phong', name: 'Grande Hotel Hai Phong', address: '12 Tran Phu, Ngo Quyen, Hai Phong, Vietnam', phone: '+84 225 3 888 999' },
    { city: 'Hue', name: 'Grande Hotel Hue', address: '10 Le Loi, Phu Hoi, Hue, Vietnam', phone: '+84 234 3 888 999' },
    { city: 'Can Tho', name: 'Grande Hotel Can Tho', address: '20 Hai Ba Trung, Ninh Kieu, Can Tho, Vietnam', phone: '+84 292 3 888 999' },
  ];

  const hotels = cities.map((c, idx) => ({
    name: c.name,
    address: c.address,
    email: `contact+${c.city.toLowerCase().replace(/\s+/g,'-')}@grandehotel.vn`,
    phone: c.phone,
    description: `The Grande Hotel in ${c.city} – modern comforts in the heart of the city.`,
    status: 'available',
    images: [],
  }));

  await Hotel.deleteMany({});
  const docs = await Hotel.insertMany(hotels);
  console.log(`🏨 Seeded ${docs.length} hotel(s): ${docs.map(d => d.name).join(', ')}`);
  return docs;
};

// Allow running this seed individually
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
