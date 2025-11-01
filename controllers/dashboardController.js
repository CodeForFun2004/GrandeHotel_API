const User = require('../models/user.model');
const Hotel = require('../models/hotelModel');
const Room = require('../models/roomModel');
const Reservation = require('../models/reservationModel');
const ReservationDetail = require('../models/reservationDetailModel');
const RoomType = require('../models/roomTypeModel');
const Stay = require('../models/stayModel');
const Payment = require('../models/payment.model');
const Service = require('../models/serviceModel');

// @desc    Lấy thống kê tổng quan dashboard
// @route   GET /api/dashboard/stats
// @access  Private (Admin only)
const getDashboardStats = async (req, res) => {
  try {
    // Đếm tổng số
    const totalHotels = await Hotel.countDocuments();
    const totalRooms = await Room.countDocuments();
    const totalUsers = await User.countDocuments();

    // Tính doanh thu tháng hiện tại (các reservation đã paid)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const totalRevenue = await Reservation.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: currentMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalPrice' }
        }
      }
    ]);

    res.json({
      totalHotels,
      totalRooms,
      totalUsers,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0
    });

  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Lấy dữ liệu doanh thu 6 tháng gần nhất
// @route   GET /api/dashboard/revenue
// @access  Private (Admin only)
const getRevenueData = async (req, res) => {
  try {
    const currentDate = new Date();

    // Tạo mảng 6 tháng gần nhất
    const revenueData = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);

      // Get revenue for this month
      const monthRevenue = await Reservation.aggregate([
        {
          $match: {
            status: 'paid',
            createdAt: {
              $gte: date,
              $lt: nextMonth
            }
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalPrice' },
            count: { $sum: 1 }
          }
        }
      ]);

      const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      const monthName = monthNames[date.getMonth()] + '/' + date.getFullYear().toString().slice(-2);

      revenueData.push({
        month: monthName,
        revenue: monthRevenue.length > 0 ? monthRevenue[0].revenue : 0,
        bookings: monthRevenue.length > 0 ? monthRevenue[0].count : 0
      });
    }

    res.json(revenueData);

  } catch (error) {
    console.error('Error getting revenue data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Lấy hiệu suất khách sạn (Top 5 theo doanh thu)
// @route   GET /api/dashboard/hotels/performance
// @access  Private (Admin only)
const getHotelPerformance = async (req, res) => {
  try {
    // Lấy 5 khách sạn có doanh thu cao nhất trong tháng hiện tại
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const hotels = await Reservation.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: currentMonth }
        }
      },
      {
        $group: {
          _id: '$hotel',
          revenue: { $sum: '$totalPrice' },
          bookings: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'hotels',
          localField: '_id',
          foreignField: '_id',
          as: 'hotel'
        }
      },
      {
        $unwind: '$hotel'
      },
      {
        $project: {
          _id: '$hotel._id',
          name: '$hotel.name',
          revenue: 1,
          // Tính occupancy rate giả lập (có thể điều chỉnh dựa trên logic thực)
          occupancy: { $divide: ['$bookings', 30] } // Simple calculation
        }
      },
      {
        $sort: { revenue: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Format response
    const formattedHotels = hotels.map(hotel => ({
      id: hotel._id,
      name: hotel.name,
      revenue: hotel.revenue,
      occupancy: Math.min(Math.round(hotel.occupancy * 100), 100), // Max 100%
      status: 'Active' // Assume active if has bookings
    }));

    res.json(formattedHotels);

  } catch (error) {
    console.error('Error getting hotel performance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Lấy thống kê trạng thái đặt phòng
// @route   GET /api/dashboard/bookings/status
// @access  Private (Admin only)
const getBookingStatus = async (req, res) => {
  try {
    const stats = await Reservation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusMapping = {
      pending: { name: 'Đang chờ', color: '#FF9800' },
      approved: { name: 'Đã duyệt', color: '#4CAF50' },
      canceled: { name: 'Đã hủy', color: '#F44336' },
      paid: { name: 'Đã check-in', color: '#2196F3' }
    };

    const formattedStats = Object.keys(statusMapping).map(status => {
      const stat = stats.find(s => s._id === status);
      return {
        name: statusMapping[status].name,
        value: stat ? stat.count : 0,
        color: statusMapping[status].color
      };
    });

    res.json(formattedStats);

  } catch (error) {
    console.error('Error getting booking status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Lấy thống kê người dùng theo vai trò
// @route   GET /api/dashboard/users/stats
// @access  Private (Admin only)
const getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          newThisMonth: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth(), 1)] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const roleMapping = {
      customer: 'Khách hàng',
      admin: 'Admin',
      staff: 'Nhân viên',
      'hotel-manager': 'Quản lý khách sạn'
    };

    const formattedStats = Object.keys(roleMapping).map(role => {
      const stat = stats.find(s => s._id === role);
      return {
        role: roleMapping[role],
        count: stat ? stat.count : 0,
        newThisMonth: stat ? stat.newThisMonth : 0
      };
    });

    res.json(formattedStats);

  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Lấy hoạt động gần nhất (recent activities)
// @route   GET /api/dashboard/activities/recent
// @access  Private (Admin only)
const getRecentActivities = async (req, res) => {
  try {
    const activities = [];

    // Recent reservations
    const recentReservations = await Reservation.find()
      .populate('hotel', 'name')
      .populate('customer', 'fullname')
      .sort({ createdAt: -1 })
      .limit(3);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(3);

    // Format activities
    recentReservations.forEach(res => {
      activities.push({
        type: 'booking',
        message: `Đặt phòng mới tại ${res.hotel.name}`,
        time: getTimeAgo(res.createdAt),
        user: res.customer.fullname
      });
    });

    recentUsers.forEach(user => {
      activities.push({
        type: 'user',
        message: 'Tài khoản mới đăng ký',
        time: getTimeAgo(user.createdAt),
        user: user.fullname
      });
    });

    // Sort by time and limit to 5 most recent
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const recentActivities = activities.slice(0, 5);

    res.json(recentActivities);

  } catch (error) {
    console.error('Error getting recent activities:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to calculate time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;

  return date.toLocaleDateString('vi-VN');
};

module.exports = {
  getDashboardStats,
  getRevenueData,
  getHotelPerformance,
  getBookingStatus,
  getUserStats,
  getRecentActivities,
  searchReservationsForCheckIn,
  getReservationForCheckIn,
  confirmCheckIn,
  findStayByRoomNumberForCheckout,
  createCheckoutPayment,
  confirmCheckout,
  addServiceToRoomInStay,
  listHotelServices
};

// ========================= CHECK-IN (Reception) =========================

// @desc    Search reservations by customer fullname/phone for check-in
// @route   GET /api/dashboard/checkin/search?query=...
// @access  Private (Staff/Manager/Admin)
async function searchReservationsForCheckIn(req, res) {
  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Query is required' });
    }

    // Only reservations that are approved and at least deposit paid
    const reservations = await Reservation.find({
      status: 'approved',
      paymentStatus: { $in: ['deposit_paid', 'fully_paid'] }
    })
      .populate('customer', 'fullname phone email')
      .populate('hotel', 'name')
      .sort({ createdAt: -1 });

    const q = query.trim().toLowerCase();
    const filtered = reservations.filter(r => {
      const name = (r.customer?.fullname || '').toLowerCase();
      const phone = (r.customer?.phone || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });

    // Return light payload
    const result = await Promise.all(filtered.slice(0, 20).map(async r => {
      const details = await ReservationDetail.find({ reservation: r._id })
        .populate('roomType', 'name');
      return {
        id: r._id,
        customer: r.customer,
        hotel: r.hotel,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        paymentStatus: r.paymentStatus,
        details: details.map(d => ({ roomType: d.roomType, quantity: d.quantity }))
      };
    }));

    return res.json({ results: result });
  } catch (error) {
    console.error('Error searching reservations for check-in:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// ========================= CHECK-OUT (Reception) =========================

// @desc    Find current stay by room number (occupied) and show bill breakdown
// @route   GET /api/dashboard/checkout/find-room?roomNumber=...
// @access  Private (Staff/Manager/Admin)
async function findStayByRoomNumberForCheckout(req, res) {
  try {
    const { roomNumber } = req.query;
    if (!roomNumber) return res.status(400).json({ message: 'roomNumber is required' });

    const room = await Room.findOne({ roomNumber });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.status !== 'Occupied') {
      return res.status(400).json({ message: 'Room is not currently occupied' });
    }

    // Find stay that contains this room in any detail.roomStays
    const stay = await Stay.findOne({
      status: 'Checked in',
      'details.roomStays.room': room._id
    })
      .populate('reservation', 'checkInDate checkOutDate paymentStatus depositAmount totalPrice')
      .populate('hotel', 'name')
      .populate({ path: 'details.roomStays.room', select: 'roomNumber name' })
      .populate({ path: 'details.roomStays.services.service', select: 'name basePrice' });

    if (!stay) return res.status(404).json({ message: 'Active stay not found for this room' });

    // Compute nights using actual stay window (actualCheckIn -> now)
    const msPerDay = 1000 * 60 * 60 * 24;
    const checkInAt = stay.actualCheckIn ? new Date(stay.actualCheckIn) : new Date(stay.reservation.checkInDate);
    const now = new Date();
    const rawDays = (now - checkInAt) / msPerDay;
    const nights = Math.max(1, Math.ceil(rawDays));

    // Nights price = sum(room.pricePerNight * nights) for each stayed room
    const allRoomsInStay = [];
    for (const d of stay.details) {
      if (Array.isArray(d.roomStays) && d.roomStays.length > 0) {
        allRoomsInStay.push(...d.roomStays.map(rs => rs.room));
      } else if (Array.isArray(d.rooms)) {
        allRoomsInStay.push(...d.rooms);
      }
    }
    const uniqueRoomIds = [...new Set(allRoomsInStay.map(r => String(r)))];
    const roomDocs = await Room.find({ _id: { $in: uniqueRoomIds } }).select('_id pricePerNight');
    const roomPriceMap = new Map(roomDocs.map(rd => [String(rd._id), Number(rd.pricePerNight || 0)]));

    let nightsPrice = 0;
    for (const rid of uniqueRoomIds) {
      nightsPrice += (roomPriceMap.get(String(rid)) || 0) * nights;
    }

    // Services cost across all rooms
    let servicesCost = 0;
    for (const d of stay.details) {
      if (!Array.isArray(d.roomStays)) continue;
      for (const rs of d.roomStays) {
        if (!Array.isArray(rs.services)) continue;
        for (const sv of rs.services) {
          const unit = sv.service?.basePrice || 0;
          servicesCost += unit * (sv.quantity || 1);
        }
      }
    }

    // Amount due: nights minus deposit (50%) + services
    let nightsDue = 0;
    if (stay.reservation.paymentStatus === 'fully_paid') {
      nightsDue = 0;
    } else if (stay.reservation.paymentStatus === 'deposit_paid') {
      nightsDue = Math.round(nightsPrice * 0.5);
    } else {
      nightsDue = nightsPrice; // fallback
    }
    const amountDue = nightsDue + servicesCost;

    return res.json({
      stayId: stay._id,
      hotel: stay.hotel,
      room: { id: room._id, roomNumber: room.roomNumber, name: room.name },
      reservation: stay.reservation,
      breakdown: { nights, nightsPrice, nightsDue, servicesCost, amountDue }
    });
  } catch (error) {
    console.error('Error finding stay for checkout:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Create a checkout payment (Pending) with description format
// @route   POST /api/dashboard/checkout/:stayId/create-payment
// @access  Private (Staff/Manager/Admin)
// @body    { paymentMethod?: string }
async function createCheckoutPayment(req, res) {
  try {
    const { stayId } = req.params;
    const { paymentMethod = 'cash' } = req.body || {};

    const stay = await Stay.findById(stayId)
      .populate('reservation', 'checkInDate checkOutDate paymentStatus depositAmount totalPrice')
      .populate('hotel', 'name');
    if (!stay) return res.status(404).json({ message: 'Stay not found' });
    if (stay.status !== 'Checked in') return res.status(400).json({ message: 'Stay is not in a check-in state' });

    // Reuse the computation
    const msPerDay2 = 1000 * 60 * 60 * 24;
    const checkInAt2 = stay.actualCheckIn ? new Date(stay.actualCheckIn) : new Date(stay.reservation.checkInDate);
    const now2 = new Date();
    const nights2 = Math.max(1, Math.ceil((now2 - checkInAt2) / msPerDay2));
    let nightsPrice = 0;
    let servicesCost = 0;
    // Gather all rooms in the stay
    const allRooms2 = [];
    for (const d of stay.details) {
      if (Array.isArray(d.roomStays) && d.roomStays.length > 0) {
        allRooms2.push(...d.roomStays.map(rs => rs.room));
      } else if (Array.isArray(d.rooms)) {
        allRooms2.push(...d.rooms);
      }
      if (Array.isArray(d.roomStays)) {
        for (const rs of d.roomStays) {
          if (!Array.isArray(rs.services)) continue;
          for (const sv of rs.services) {
            const unit = await ServicePrice(sv.service);
            servicesCost += unit * (sv.quantity || 1);
          }
        }
      }
    }
    const uniq2 = [...new Set(allRooms2.map(r => String(r)))];
    const roomDocs2 = await Room.find({ _id: { $in: uniq2 } }).select('_id pricePerNight');
    const priceMap2 = new Map(roomDocs2.map(rd => [String(rd._id), Number(rd.pricePerNight || 0)]));
    for (const rid of uniq2) {
      nightsPrice += (priceMap2.get(String(rid)) || 0) * nights2;
    }
    let nightsDue = 0;
    if (stay.reservation.paymentStatus === 'fully_paid') nightsDue = 0;
    else if (stay.reservation.paymentStatus === 'deposit_paid') nightsDue = Math.round(nightsPrice * 0.5);
    else nightsDue = nightsPrice;
    const amountDue = nightsDue + servicesCost;

  // Description format: "checkedout" - stayID - amount - hotel
  const description = `checkedout - ${stay._id} - ${amountDue} - ${stay.hotel?.name || 'HOTEL'}`;

    const payment = await Payment.create({
      amount: amountDue,
      paymentMethod,
      description,
      status: 'Pending',
      stay: stay._id,
      reservation: stay.reservation?._id || null,
      hotel: stay.hotel?._id || null,
      customer: null,
      metadata: { nights: nights2, nightsPrice, nightsDue, servicesCost }
    });

    return res.status(201).json({ message: 'Payment created', payment });
  } catch (error) {
    console.error('Error creating checkout payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// Helper: get service base price
async function ServicePrice(serviceId) {
  const Service = require('../models/serviceModel');
  const s = await Service.findById(serviceId).select('basePrice');
  return s ? Number(s.basePrice || 0) : 0;
}

// @desc    Confirm checkout: mark payment Success, set rooms to Cleaning, close stay
// @route   POST /api/dashboard/checkout/:stayId/confirm
// @access  Private (Staff/Manager/Admin)
// @body    { paymentId, status?: 'Success'|'Failed' }
async function confirmCheckout(req, res) {
  try {
    const { stayId } = req.params;
    const { paymentId, status = 'Success' } = req.body || {};

    const stay = await Stay.findById(stayId);
    if (!stay) { return res.status(404).json({ message: 'Stay not found' }); }
    if (stay.status !== 'Checked in') { return res.status(400).json({ message: 'Stay is not in a check-in state' }); }

    // Update payment if provided
    if (paymentId) {
      await Payment.findByIdAndUpdate(paymentId, { status }, { new: true });
      if (status !== 'Success') {
        return res.status(200).json({ message: 'Payment status updated' });
      }
    }

    // Set rooms to Cleaning
    const allRooms = [];
    for (const d of stay.details) {
      if (Array.isArray(d.roomStays) && d.roomStays.length > 0) {
        allRooms.push(...d.roomStays.map(rs => rs.room));
      } else if (Array.isArray(d.rooms)) {
        allRooms.push(...d.rooms);
      }
    }
    if (allRooms.length > 0) {
      await Room.updateMany({ _id: { $in: allRooms } }, { $set: { status: 'Cleaning' } });
    }

    // Close stay
    stay.actualCheckOut = new Date();
    stay.status = 'Checked out';
    await stay.save();
    // Update reservation stay status to checked_out
    if (stay.reservation) {
      await Reservation.findByIdAndUpdate(
        stay.reservation,
        {
          stayStatus: 'checked_out',
          checkedOutAt: new Date(),
          checkedOutBy: req.user?._id || null
        },
        { new: true }
      );
    }
    return res.status(200).json({ message: 'Checkout completed', stayId: stay._id });
  } catch (error) {
    console.error('Error confirming checkout:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Get reservation detail and suggested rooms for check-in
// @route   GET /api/dashboard/checkin/:id
// @access  Private (Staff/Manager/Admin)
async function getReservationForCheckIn(req, res) {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id)
      .populate('customer', 'fullname phone email')
      .populate('hotel', 'name');
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

    if (reservation.status !== 'approved' || !['deposit_paid', 'fully_paid'].includes(reservation.paymentStatus)) {
      return res.status(400).json({ message: 'Reservation is not ready for check-in' });
    }

    const details = await ReservationDetail.find({ reservation: id })
      .populate('roomType', 'name')
      .populate({ path: 'reservedRooms', select: '_id roomNumber name status' });

    // For each roomType, suggest currently Available rooms (simple approach)
    const suggestions = await Promise.all(details.map(async d => {
      // if reserved rooms already picked, suggest those
      const reserved = Array.isArray(d.reservedRooms) ? d.reservedRooms : [];
      if (reserved.length >= d.quantity) {
        return {
          roomType: d.roomType,
          requiredQuantity: d.quantity,
          suggestedRooms: reserved.slice(0, d.quantity),
          source: 'reserved'
        };
      }

      // otherwise suggest current available rooms
      const rooms = await Room.find({
        hotel: reservation.hotel,
        roomType: d.roomType._id,
        status: { $in: ['Available', 'available', 'Active'] }
      }).select('_id roomNumber name status');

      return {
        roomType: d.roomType,
        requiredQuantity: d.quantity,
        suggestedRooms: rooms.slice(0, d.quantity),
        source: 'available'
      };
    }));

    return res.json({
      reservation,
      details: details.map(d => ({ roomType: d.roomType, quantity: d.quantity, reservedRooms: d.reservedRooms })),
      suggestions
    });
  } catch (error) {
    console.error('Error getting reservation for check-in:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Confirm check-in: create Stay and set rooms to Occupied
// @route   POST /api/dashboard/checkin/:id/confirm
// @access  Private (Staff/Manager/Admin)
// @body    { selections: [{ roomTypeId, roomIds: [..] }] }
async function confirmCheckIn(req, res) {
  try {
    const { id } = req.params;
  // Be defensive: req.body may be undefined if Content-Type is missing
  let selections = (req.body && req.body.selections) ? req.body.selections : undefined;

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    if (reservation.status !== 'approved' || !['deposit_paid', 'fully_paid'].includes(reservation.paymentStatus)) {
      return res.status(400).json({ message: 'Reservation is not ready for check-in' });
    }

  const details = await ReservationDetail.find({ reservation: id });

    // If no selections provided, auto-use reserved rooms
    if (!Array.isArray(selections) || selections.length === 0) {
      const autoSelections = [];
      for (const d of details) {
        const reserved = Array.isArray(d.reservedRooms) ? d.reservedRooms.map(r => String(r)) : [];
        if (reserved.length !== d.quantity) {
          return res.status(400).json({ message: 'Reserved rooms not fully allocated for this reservation. Please allocate or provide selections.' });
        }
        autoSelections.push({ roomTypeId: String(d.roomType), roomIds: reserved });
      }
      selections = autoSelections;
    }
    // Validate counts per roomType and enforce reserved rooms if exist
    for (const d of details) {
      const sel = selections.find(s => String(s.roomTypeId) === String(d.roomType));
      if (!sel || !Array.isArray(sel.roomIds) || sel.roomIds.length !== d.quantity) {
        return res.status(400).json({ message: 'Selected rooms must match required quantity for each room type' });
      }
      // if reserved rooms exist, enforce using them
      if (Array.isArray(d.reservedRooms) && d.reservedRooms.length === d.quantity) {
        const diff = sel.roomIds.filter(rid => !d.reservedRooms.map(r => String(r)).includes(String(rid)));
        if (diff.length > 0) {
          return res.status(400).json({ message: 'Please check-in using the reserved rooms for this reservation detail' });
        }
      }
    }

    // Validate rooms belong to hotel and roomType, and are Available/Reserved
    const allRoomIds = selections.flatMap(s => s.roomIds);
    const rooms = await Room.find({ _id: { $in: allRoomIds } });
    if (rooms.length !== allRoomIds.length) {
      return res.status(400).json({ message: 'Some rooms not found' });
    }
    for (const s of selections) {
      const subset = rooms.filter(r => String(r._id) && s.roomIds.includes(String(r._id)));
      for (const r of subset) {
        if (String(r.hotel) !== String(reservation.hotel)) {
          return res.status(400).json({ message: 'Room must belong to the reservation hotel' });
        }
        if (String(r.roomType) !== String(s.roomTypeId)) {
          return res.status(400).json({ message: 'Room must match the selected room type' });
        }
        if (!['Available', 'available', 'Active', 'Reserved', 'reserved'].includes(r.status)) {
          return res.status(400).json({ message: `Room ${r.roomNumber} is not available for check-in` });
        }
      }
    }

    // Compute nights and per-detail totalPrice (simple: roomType.basePrice * nights * quantity)
    const msPerDay = 1000 * 60 * 60 * 24;
    const nights = Math.max(1, Math.round((new Date(reservation.checkOutDate) - new Date(reservation.checkInDate)) / msPerDay));

    const roomTypeDocs = await RoomType.find({ _id: { $in: selections.map(s => s.roomTypeId) } });
    const priceMap = new Map(roomTypeDocs.map(rt => [String(rt._id), Number(rt.basePrice || 0)]));

    // Build Stay.details with roomStays
    const stayDetails = selections.map(s => {
      const total = (priceMap.get(String(s.roomTypeId)) || 0) * nights * s.roomIds.length;
      return {
        roomType: s.roomTypeId,
        rooms: s.roomIds,
        roomStays: s.roomIds.map(rid => ({ room: rid, guests: [], services: [] })),
        totalPrice: total,
        notes: null
      };
    });

  // Update rooms to Occupied
  await Room.updateMany({ _id: { $in: allRoomIds } }, { $set: { status: 'Occupied' } });

    // Create Stay
    const stay = await Stay.create([{
      reservation: reservation._id,
      hotel: reservation.hotel,
      customer: reservation.customer,
      details: stayDetails,
      actualCheckIn: new Date(),
      status: 'Checked in',
      receptionist: req.user?._id || null
    }]);
    // Update reservation stay status to checked_in
    await Reservation.findByIdAndUpdate(
      reservation._id,
      {
        stayStatus: 'checked_in',
        checkedInAt: new Date(),
        checkedInBy: req.user?._id || null
      },
      { new: true }
    );
    return res.status(200).json({ message: 'Check-in confirmed', stay: stay[0] });
  } catch (error) {
    console.error('Error confirming check-in:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// ========================= STAY SERVICE MANAGEMENT =========================

// @desc    Add or increase a service for a specific room in an active stay
// @route   POST /api/dashboard/stays/:stayId/rooms/:roomId/services
// @access  Private (Staff/Manager/Admin)
// @body    { serviceId: string, quantity?: number }
async function addServiceToRoomInStay(req, res) {
  try {
    const { stayId, roomId } = req.params;
    const { serviceId, quantity = 1 } = req.body || {};

    if (!serviceId) return res.status(400).json({ message: 'serviceId is required' });
    const qty = Math.max(1, Number(quantity || 1));

    // Load stay and ensure it's active
    const stay = await Stay.findById(stayId).populate('hotel', 'name');
    if (!stay) return res.status(404).json({ message: 'Stay not found' });
    if (stay.status !== 'Checked in') return res.status(400).json({ message: 'Stay is not active for adding services' });

    // Validate room belongs to this stay
    const detail = stay.details.find(d =>
      Array.isArray(d.roomStays) && d.roomStays.some(rs => String(rs.room) === String(roomId))
    ) || stay.details.find(d => Array.isArray(d.rooms) && d.rooms.some(r => String(r) === String(roomId)));

    if (!detail) return res.status(400).json({ message: 'Room does not belong to this stay' });

    // Ensure a roomStay entry exists for this room
    if (!Array.isArray(detail.roomStays)) detail.roomStays = [];
    let roomStay = detail.roomStays.find(rs => String(rs.room) === String(roomId));
    if (!roomStay) {
      roomStay = { room: roomId, guests: [], services: [], notes: null };
      detail.roomStays.push(roomStay);
    }

    // Validate service belongs to the same hotel
    const svc = await Service.findById(serviceId).select('hotel name basePrice');
    if (!svc) return res.status(404).json({ message: 'Service not found' });
    // stay.hotel may be populated (object) or an ObjectId; normalize to id string
    const stayHotelId = String(stay?.hotel && stay.hotel._id ? stay.hotel._id : stay.hotel);
    if (String(svc.hotel) !== stayHotelId) {
      return res.status(400).json({ message: 'Service does not belong to this hotel' });
    }

    // Add or increment service in roomStay
    if (!Array.isArray(roomStay.services)) roomStay.services = [];
    const existing = roomStay.services.find(s => String(s.service) === String(serviceId));
    if (existing) existing.quantity = Math.max(1, Number(existing.quantity || 0) + qty);
    else roomStay.services.push({ service: serviceId, quantity: qty });

    await stay.save();

    // Recompute current services cost (for feedback)
    let servicesCost = 0;
    for (const d of stay.details) {
      if (!Array.isArray(d.roomStays)) continue;
      for (const rs of d.roomStays) {
        if (!Array.isArray(rs.services)) continue;
        for (const sv of rs.services) {
          const unit = await ServicePrice(sv.service);
          servicesCost += unit * (sv.quantity || 1);
        }
      }
    }

    return res.status(200).json({
      message: 'Service added to room stay',
      stayId: stay._id,
      roomId,
      addedService: { id: svc._id, name: svc.name, basePrice: svc.basePrice, quantity: qty },
      servicesCost
    });
  } catch (error) {
    console.error('Error adding service to room stay:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// @desc    List available services for a hotel (for selection in stay service additions)
// @route   GET /api/dashboard/hotels/:hotelId/services
// @access  Private (Staff/Manager/Admin)
async function listHotelServices(req, res) {
  try {
    const { hotelId } = req.params;
    if (!hotelId) return res.status(400).json({ message: 'hotelId is required' });
    const services = await Service.find({ hotel: hotelId }).select('_id name description basePrice');
    return res.json({ services });
  } catch (error) {
    console.error('Error listing hotel services:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
