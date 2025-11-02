const Reservation = require('../models/reservationModel');
const ReservationDetail = require('../models/reservationDetailModel');
const Payment = require('../models/paymentModel');
const User = require('../models/user.model');
const Hotel = require('../models/hotelModel');
const RoomType = require('../models/roomTypeModel');

module.exports = async function seedReservations() {
  await Reservation.deleteMany({});
  await ReservationDetail.deleteMany({});
  await Payment.deleteMany({});

  const hotel = await Hotel.findOne({ name: /Grande Hotel/i }).sort({ name: 1 });
  const customer = await User.findOne({ role: 'customer' });
  const roomTypes = await RoomType.find({}).limit(3);

  if (!hotel || !customer || roomTypes.length === 0) {
    console.log('⚠️  Missing hotel/customer/roomTypes, skipping reservations seed');
    return { reservations: [], details: [], payments: [] };
  }

  // Build a few reservations
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const reservationsPayload = [
    {
      hotel: hotel._id,
      customer: customer._id,
      checkInDate: new Date(now.getTime() + 3 * day),
      checkOutDate: new Date(now.getTime() + 5 * day),
      numberOfGuests: 3,
      status: 'pending',
      stayStatus: 'not_checked_in',
    },
    {
      hotel: hotel._id,
      customer: customer._id,
      checkInDate: new Date(now.getTime() + 7 * day),
      checkOutDate: new Date(now.getTime() + 10 * day),
      numberOfGuests: 2,
      status: 'approved',
      stayStatus: 'not_checked_in',
    },
    {
      hotel: hotel._id,
      customer: customer._id,
      checkInDate: new Date(now.getTime() + 1 * day),
      checkOutDate: new Date(now.getTime() + 3 * day),
      numberOfGuests: 2,
      status: 'approved',
      stayStatus: 'not_checked_in',
    },
  ];

  const reservations = await Reservation.insertMany(reservationsPayload);
  console.log(`📘 Seeded ${reservations.length} reservations`);

  // For each reservation, create details and a payment
  const detailsAll = [];
  const paymentsAll = [];

  for (const res of reservations) {
    // Example: Suite x1, Single Room x2 if available
    const suite = roomTypes.find(rt => /suite/i.test(rt.name)) || roomTypes[0];
    const single = roomTypes.find(rt => /single/i.test(rt.name)) || roomTypes[1] || roomTypes[0];

    // Compute totals using room type base prices (ReservationDetail schema has no 'price' field)
    const totalPrice = Number((suite?.basePrice || 0)) * 1 + Number((single?.basePrice || 0)) * 2;
    const depositAmount = Math.ceil(totalPrice * 0.5);

    // Insert details without price field
    const detailsPayload = [
      { reservation: res._id, roomType: suite._id, quantity: 1, services: [] },
      { reservation: res._id, roomType: single._id, quantity: 2, services: [] },
    ];
    const details = await ReservationDetail.insertMany(detailsPayload);
    detailsAll.push(...details);

    const payment = await Payment.create({
      reservation: res._id,
      totalPrice,
      depositAmount,
      paymentStatus: 'unpaid',
      paidAmount: 0,
      paymentMethod: 'bank_transfer',
    });
    paymentsAll.push(payment);
  }

  console.log(`🧾 Seeded ${detailsAll.length} reservation details & ${paymentsAll.length} payments`);
  return { reservations, details: detailsAll, payments: paymentsAll };
}
