const Reservation = require('../models/reservationModel');
const ReservationDetail = require('../models/reservationDetailModel');
const RoomType = require('../models/roomTypeModel');

exports.createReservation = async (req, res) => {
  try {
    const {
      hotelId,
      customerId,
      checkInDate,
      checkOutDate,
      numberOfGuests,
      rooms, // array of { roomTypeId, quantity }
      voucherCode,
    } = req.body;

    // Basic validation
    if (!hotelId || !customerId || !checkInDate || !checkOutDate || !rooms || rooms.length === 0) {
      return res.status(400).json({ message: 'Missing required reservation information.' });
    }

    // Calculate total price
    let totalPrice = 0;
    for (const item of rooms) {
      const roomType = await RoomType.findById(item.roomTypeId);
      if (!roomType) {
        return res.status(404).json({ message: `Room type ${item.roomTypeId} not found.` });
      }
      totalPrice += roomType.basePrice * item.quantity;
    }

    // (Optional) Apply voucher
    if (voucherCode) {
      // Example: assume voucher = { code, discountPercent }
      const voucher = await Voucher.findOne({ code: voucherCode, isActive: true });
      if (voucher) {
        totalPrice = totalPrice * (1 - voucher.discountPercent / 100);
      }
    }

    // ✅ Create reservation
    const reservation = await Reservation.create({
      hotel: hotelId,
      customer: customerId,
      checkInDate,
      checkOutDate,
      numberOfGuests,
      totalPrice,
      status: 'pending', 
    });

    // ✅ Create reservation details
    const details = rooms.map((item) => ({
      reservation: reservation._id,
      roomType: item.roomTypeId,
      quantity: item.quantity,
    }));
    await ReservationDetail.insertMany(details);

    return res.status(201).json({
      message: 'Reservation created successfully.',
      reservation,
    });

  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ message: 'Internal server error.', error });
  }
};

exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('customer')
      .populate({
        path: 'details',
        populate: { path: 'roomType' },
      });

    return res.status(200).json({
      message: 'Reservations retrieved successfully.',
      reservations,
    });

  } catch (error) {
    console.error('Error retrieving reservations:', error);
    res.status(500).json({ message: 'Internal server error.', error });
  }
};
exports.getReservationById = async (req, res) => {
  try {
    const reservationId = req.params.id;
    const reservation = await Reservation.findById(reservationId)
      .populate('customer')
      .populate({
        path: 'details',
        populate: { path: 'roomType' },
      });

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.' });
    }

    return res.status(200).json({
      message: 'Reservation retrieved successfully.',
      reservation,
    });

  } catch (error) {
    console.error('Error retrieving reservation:', error);
    res.status(500).json({ message: 'Internal server error.', error });
  }
};
exports.updateReservationStatus = async (req, res) => {
  try {
    const reservationId = req.params.id;
    const { status } = req.body;
    const reservation = await Reservation.findByIdAndUpdate(
      reservationId,
      { status },
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.' });
    }

    return res.status(200).json({
      message: 'Reservation status updated successfully.',
      reservation,
    });

  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ message: 'Internal server error.', error });
  }
};
exports.deleteReservation = async (req, res) => {
  try {
    const reservationId = req.params.id;
    const reservation = await Reservation.findByIdAndDelete(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.' });
    }

    return res.status(200).json({
      message: 'Reservation deleted successfully.',
      reservation,
    });

  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ message: 'Internal server error.', error });
  }
};