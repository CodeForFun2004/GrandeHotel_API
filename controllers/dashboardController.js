const User = require('../models/user.model');
const Hotel = require('../models/hotelModel');
const Room = require('../models/roomModel');
const Reservation = require('../models/reservationModel');
const ReservationDetail = require('../models/reservationDetailModel');
const RoomType = require('../models/roomTypeModel');
const Stay = require('../models/stayModel');
const RoomActivity = require('../models/roomActivity');
// Use the reservation-scoped Payment summary model for all payment state
const ReservationPayment = require('../models/paymentModel');
const Service = require('../models/serviceModel');
// Chat models for deletion after checkout
const Conversation = require('../models/conversation');
const Message = require('../models/message');
// VietQR generator reused for checkout payments
const { generateVietQR } = require('../services/payment.service');
const chatController = require('./chatController');

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
  addRoomToStay,
  searchReservationsForCheckIn,
  getReservationForCheckIn,
  confirmCheckIn,
  findStayByRoomNumberForCheckout,
  listActiveStaysForCheckout,
  createCheckoutPayment,
  confirmCheckout,
  addServiceToRoomInStay,
  listHotelServices,
  verifyCheckoutPayment
};

// ========================= CHECK-IN (Reception) =========================

// @desc    Search reservations by customer fullname/phone for check-in
// @route   GET /api/dashboard/checkin/search?query=...
// @access  Private (Staff/Manager/Admin)
async function searchReservationsForCheckIn(req, res) {
  try {
    const { query, checkInDate, todayOnly, room } = req.query;

  // Build base matcher: approved reservations that are not yet checked in/out
  const baseMatch = { status: 'approved', stayStatus: { $nin: ['checked_in', 'checked_out'] } };

    // Optional date filter: if todayOnly=true, or checkInDate provided
    if (todayOnly === 'true' || (checkInDate && String(checkInDate).trim())) {
      const day = todayOnly === 'true' ? new Date() : new Date(checkInDate);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
      const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
      baseMatch.checkInDate = { $gte: start, $lte: end };
    }

    // If caller passed a specific room (room number or room id), restrict to reservations
    // that have that room reserved. This helps `staff -> go to checkin` flow which
    // navigates with `?room=<roomNumber>` when reservation wasn't resolvable.
    if (room && String(room).trim()) {
      // Try to resolve room by id first, then by roomNumber
      let roomDoc = null;
      try {
        if (/^[0-9a-fA-F]{24}$/.test(String(room).trim())) {
          roomDoc = await Room.findById(String(room).trim()).select('_id roomNumber');
        }
      } catch (e) { roomDoc = null; }
      if (!roomDoc) {
        roomDoc = await Room.findOne({ roomNumber: String(room).trim() }).select('_id roomNumber');
      }
      if (!roomDoc) {
        // No such room -> return empty result set
        return res.json({ results: [] });
      }
      // Find reservation details that reference this room
      const rDetails = await ReservationDetail.find({ reservedRooms: roomDoc._id }).select('reservation');
      const resIds = rDetails.map(d => d.reservation).filter(Boolean);
      if (!resIds || resIds.length === 0) return res.json({ results: [] });
      baseMatch._id = { $in: resIds };
    }

    // Load candidates (approved reservations not yet checked in/out)
    const reservations = await Reservation.find(baseMatch)
      .populate('customer', 'fullname phone email username')
      .populate('hotel', 'name')
      .populate('payment')
      .sort({ createdAt: -1 });

    // NOTE: Previously we filtered reservations to only those with a payment
    // status of deposit_paid/fully_paid. For staff search we want to show
    // approved reservations regardless of payment status (minimal filter).
    // Optional text query across fullname, phone, username, reservation id
    let filtered = reservations;
    if (query && String(query).trim()) {
      const q = String(query).trim().toLowerCase();
      filtered = reservations.filter(r => {
        const name = (r.customer?.fullname || '').toLowerCase();
        const phone = (r.customer?.phone || '').toLowerCase();
        const uname = (r.customer?.username || '').toLowerCase();
        const rid = String(r._id || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || uname.includes(q) || rid.includes(q);
      });
    }

    // Return light payload (limit to 50 to avoid overload)
    const result = await Promise.all(filtered.slice(0, 50).map(async r => {
      const details = await ReservationDetail.find({ reservation: r._id })
        .populate('roomType', 'name');
      return {
        id: r._id,
        customer: r.customer,
        hotel: r.hotel,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        paymentStatus: r.payment?.paymentStatus || 'unpaid',
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

// @desc    List all current stays (checked in) with per-room entries for checkout
// @route   GET /api/dashboard/checkout/inhouse?query=...
// @access  Private (Staff/Manager/Admin)
async function listActiveStaysForCheckout(req, res) {
  try {
    const { query } = req.query || {};
    // Include stays that are marked as Checked in OR those that have an actualCheckIn timestamp
    const stays = await Stay.find({ $or: [{ status: 'Checked in' }, { actualCheckIn: { $exists: true, $ne: null } }] })
      .populate('reservation', 'checkInDate checkOutDate customer')
      .populate({ path: 'reservation.customer', select: 'fullname phone email' })
      .populate({ path: 'details.roomType', select: 'name basePrice' })
      .populate({ path: 'details.roomStays.room', select: 'roomNumber name pricePerNight status' })
      .populate({ path: 'details.rooms', select: 'roomNumber name pricePerNight status' })
      .populate('hotel', 'name');

    // Fetch payment summaries for all reservations
    const resIds = stays.map(s => s.reservation?._id).filter(Boolean);
    const pays = await ReservationPayment.find({ reservation: { $in: resIds } }).select('reservation paymentStatus depositAmount totalPrice paidAmount');
    const payMap = new Map(pays.map(p => [String(p.reservation), p]));

    const msPerDay = 1000 * 60 * 60 * 24;
    const items = [];
    for (const stay of stays) {
      for (const d of (stay.details || [])) {
        const rt = d.roomType;
        // reservation may be null for walk-ins; handle gracefully
        const reservation = stay.reservation || null;
        const payment = reservation ? payMap.get(String(reservation._id)) : null;
        // Determine check-in anchor: prefer actualCheckIn, then reservation.checkInDate, then stay.createdAt
        let checkInAt;
        if (stay.actualCheckIn) checkInAt = new Date(stay.actualCheckIn);
        else if (reservation && reservation.checkInDate) checkInAt = new Date(reservation.checkInDate);
        else checkInAt = new Date(stay.createdAt || Date.now());
        const nightsSoFar = Math.max(1, Math.ceil((new Date() - checkInAt) / msPerDay));
        const baseGuestName = reservation?.customer?.fullname || (stay.customer && stay.customer.fullname) || '—';
        const phone = reservation?.customer?.phone || (stay.customer && stay.customer.phone) || '—';
        const email = reservation?.customer?.email || (stay.customer && stay.customer.email) || '—';
        const deposit = payment ? Number(payment.depositAmount || 0) : 0;

        // Preferred path: roomStays
        if (Array.isArray(d.roomStays) && d.roomStays.length > 0) {
          for (const rs of d.roomStays) {
            // skip rooms already checked out (partial checkout support)
            if (rs.status === 'Checked out' || rs.checkedOutAt || rs.actualCheckedOut) continue;
            const room = rs.room;
            const pricePerNight = room?.pricePerNight != null ? Number(room.pricePerNight) : Number(rt?.basePrice || 0);
            const guestName = baseGuestName || (rs.idVerification?.nameOnId) || '—';

            const checkInValue = reservation && reservation.checkInDate ? new Date(reservation.checkInDate) : (stay.actualCheckIn ? new Date(stay.actualCheckIn) : null);
            const checkOutValue = reservation && reservation.checkOutDate ? new Date(reservation.checkOutDate) : null;

            items.push({
              stayId: String(stay._id),
              roomId: String(room?._id || ''),
              guestName,
              phone,
              email,
              roomType: rt?.name || '—',
              roomNumber: room?.roomNumber || room?.name || '—',
              checkIn: checkInValue,
              checkOutPlan: checkOutValue,
              pricePerNight,
              nightsSoFar,
              deposit,
            });
          }
        } else if (Array.isArray(d.rooms) && d.rooms.length > 0) {
          // Fallback legacy path: use rooms list when roomStays not present
          for (const room of d.rooms) {
            // Only list rooms that are still occupied
            if (room?.status && room.status !== 'Occupied') continue;
            const pricePerNight = room?.pricePerNight != null ? Number(room.pricePerNight) : Number(rt?.basePrice || 0);

            const checkInValue = reservation && reservation.checkInDate ? new Date(reservation.checkInDate) : (stay.actualCheckIn ? new Date(stay.actualCheckIn) : null);
            const checkOutValue = reservation && reservation.checkOutDate ? new Date(reservation.checkOutDate) : null;

            items.push({
              stayId: String(stay._id),
              roomId: String(room?._id || ''),
              guestName: baseGuestName,
              phone,
              email,
              roomType: rt?.name || '—',
              roomNumber: room?.roomNumber || room?.name || '—',
              checkIn: checkInValue,
              checkOutPlan: checkOutValue,
              pricePerNight,
              nightsSoFar,
              deposit,
            });
          }
        }
      }
    }

    let filtered = items;
    if (query && String(query).trim()) {
      const q = String(query).trim().toLowerCase();
      filtered = items.filter(it =>
        String(it.stayId).toLowerCase().includes(q) ||
        String(it.roomNumber).toLowerCase().includes(q) ||
        String(it.guestName).toLowerCase().includes(q) ||
        String(it.phone || '').toLowerCase().includes(q)
      );
    }

    // sort by roomNumber then guestName
    filtered.sort((a,b)=> String(a.roomNumber).localeCompare(String(b.roomNumber)) || String(a.guestName).localeCompare(String(b.guestName)));
    return res.json({ inHouse: filtered });
  } catch (error) {
    console.error('Error listing active stays for checkout:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

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
      .populate('reservation', 'checkInDate checkOutDate')
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

    // Nights price for this specific room only
    const roomDoc = await Room.findById(room._id).select('_id pricePerNight');
    const nightsPrice = (roomDoc?.pricePerNight || 0) * nights;

    // Services cost for this room only
    let servicesCost = 0;
    for (const d of stay.details) {
      if (!Array.isArray(d.roomStays)) continue;
      for (const rs of d.roomStays) {
        if (String(rs.room) !== String(room._id)) continue;
        if (!Array.isArray(rs.services)) continue;
        for (const sv of rs.services) {
          const unit = sv.service?.basePrice || 0;
          servicesCost += unit * (sv.quantity || 1);
        }
      }
    }

    // Amount due: use paidAmount credit for accuracy, no tax
    // remainingCredit = total already paid - prepaidConsumed (credit used in previous checkouts)
    let reservationPayment = null;
    let remainingCredit = 0;
    if (stay.reservation) {
      reservationPayment = await ReservationPayment.findOne({ reservation: stay.reservation._id }).select('paymentStatus depositAmount totalPrice paidAmount');
      const paid = Number(reservationPayment?.paidAmount || 0);
      const consumed = Number(stay.prepaidConsumed || 0);
      remainingCredit = Math.max(0, paid - consumed);
    }
    const totalCharge = nightsPrice + servicesCost;
    const creditApplied = Math.min(remainingCredit, totalCharge);
    const amountDue = Math.max(0, totalCharge - creditApplied);
    const nightsDue = Math.max(0, nightsPrice - Math.min(remainingCredit, nightsPrice));

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
    const { paymentMethod = 'cash', roomId = null } = req.body || {};

    const stay = await Stay.findById(stayId)
      .populate('reservation', 'checkInDate checkOutDate')
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
    if (roomId) {
      // Calculate only for given room (partial checkout)
      const roomDoc = await Room.findById(roomId).select('_id pricePerNight');
      nightsPrice = (roomDoc?.pricePerNight || 0) * nights2;
      for (const d of stay.details) {
        if (!Array.isArray(d.roomStays)) continue;
        for (const rs of d.roomStays) {
          if (String(rs.room) !== String(roomId)) continue;
          if (!Array.isArray(rs.services)) continue;
          for (const sv of rs.services) {
            const unit = await ServicePrice(sv.service);
            servicesCost += unit * (sv.quantity || 1);
          }
        }
      }
    } else {
      // Original behavior: whole stay
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
    }
    // Compute amount due using paidAmount credit (no tax)
    let reservationPayment2 = null;
    let remainingCredit = 0;
    if (stay.reservation) {
      reservationPayment2 = await ReservationPayment.findOne({ reservation: stay.reservation._id }).select('paymentStatus depositAmount totalPrice paidAmount');
      remainingCredit = Math.max(0, Number(reservationPayment2?.paidAmount || 0) - Number(stay.prepaidConsumed || 0));
    }
    const totalCharge = nightsPrice + servicesCost;
    const creditApplied = Math.min(remainingCredit, totalCharge);
    const amountDue = Math.max(0, totalCharge - creditApplied);

  // Return a checkout payload; we don't create a separate ledger model here.
  const description = `checkedout - ${stay._id} - ${amountDue} - ${stay.hotel?.name || 'HOTEL'}`;
  // Only generate QR if payment is required
  let vietQRLink = null;
  if (amountDue > 0 && payStatus2 !== 'fully_paid') {
    const transferContent = String(stay.reservation?._id || stay._id).slice(-6);
    vietQRLink = await generateVietQR(
      process.env.MY_BANK_CODE,
      process.env.MY_ACCOUNT_NUMBER,
      amountDue,
      transferContent
    );
  }

    return res.status(200).json({
      message: 'Checkout payment info prepared',
      checkout: {
        stayId: stay._id,
        amountDue,
        nights: nights2,
        nightsPrice,
        nightsDue: Math.max(0, nightsPrice - Math.min(remainingCredit, nightsPrice)),
        servicesCost,
        creditApplied,
        remainingCreditBefore: remainingCredit,
        remainingCreditAfter: Math.max(0, remainingCredit - creditApplied),
        description,
        suggestedPaymentMethod: paymentMethod,
        vietQRLink,
        requiresPayment: amountDue > 0
      }
    });
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
    const { paymentId, status = 'Success', roomId = null } = req.body || {};

    const stay = await Stay.findById(stayId);
    if (!stay) { return res.status(404).json({ message: 'Stay not found' }); }
    if (stay.status !== 'Checked in') { return res.status(400).json({ message: 'Stay is not in a check-in state' }); }

    // We accept an amountPaid in the body and a paymentMethod.
    // Update the reservation-scoped Payment record accordingly.
    const { amountPaid = null, paymentMethod = 'cash' } = req.body || {};

    if (amountPaid != null && isNaN(Number(amountPaid))) {
      return res.status(400).json({ message: 'amountPaid must be numeric' });
    }

    // Recompute current due with credit application (same logic as createCheckoutPayment)
    const msPerDay2 = 1000 * 60 * 60 * 24;
    const checkInAt2 = stay.actualCheckIn ? new Date(stay.actualCheckIn) : new Date(stay.reservation.checkInDate);
    const now2 = new Date();
    const nights2 = Math.max(1, Math.ceil((now2 - checkInAt2) / msPerDay2));
    let nightsPrice2 = 0;
    let servicesCost2 = 0;
    if (roomId) {
      const roomDoc = await Room.findById(roomId).select('_id pricePerNight');
      nightsPrice2 = (roomDoc?.pricePerNight || 0) * nights2;
      for (const d of stay.details) {
        if (!Array.isArray(d.roomStays)) continue;
        for (const rs of d.roomStays) {
          if (String(rs.room) !== String(roomId)) continue;
          if (!Array.isArray(rs.services)) continue;
          for (const sv of rs.services) {
            const unit = await ServicePrice(sv.service);
            servicesCost2 += unit * (sv.quantity || 1);
          }
        }
      }
    } else {
      const allRooms2 = [];
      for (const d of stay.details) {
        if (Array.isArray(d.roomStays) && d.roomStays.length > 0) {
          allRooms2.push(...d.roomStays.map(rs => rs.room));
          for (const rs of d.roomStays) {
            if (!Array.isArray(rs.services)) continue;
            for (const sv of rs.services) {
              const unit = await ServicePrice(sv.service);
              servicesCost2 += unit * (sv.quantity || 1);
            }
          }
        } else if (Array.isArray(d.rooms)) {
          allRooms2.push(...d.rooms);
        }
      }
      const uniq2 = [...new Set(allRooms2.map(r => String(r)))];
      const roomDocs2 = await Room.find({ _id: { $in: uniq2 } }).select('_id pricePerNight');
      const priceMap2 = new Map(roomDocs2.map(rd => [String(rd._id), Number(rd.pricePerNight || 0)]));
      for (const rid of uniq2) nightsPrice2 += (priceMap2.get(String(rid)) || 0) * nights2;
    }
    const resPay2 = await ReservationPayment.findOne({ reservation: stay.reservation }).select('paidAmount');
    const remainingCredit2 = Math.max(0, Number(resPay2?.paidAmount || 0) - Number(stay.prepaidConsumed || 0));
    const totalCharge2 = nightsPrice2 + servicesCost2;
    const creditApplied2 = Math.min(remainingCredit2, totalCharge2);
    const amountDue2 = Math.max(0, totalCharge2 - creditApplied2);

    // Set room(s) to Cleaning and mark per-room checkout when roomId is provided
    if (roomId) {
      // Update only the specified room
      await Room.updateOne({ _id: roomId }, { $set: { status: 'Cleaning' } });
      // Mark this roomStay as checked out. If not present (legacy), create it.
      let touched = false;
      for (const d of stay.details) {
        if (!Array.isArray(d.roomStays)) d.roomStays = [];
        const rs = d.roomStays.find(x => String(x.room) === String(roomId));
        if (rs) {
          if (rs.status !== 'Checked out') {
            rs.status = 'Checked out';
            rs.checkedOutAt = new Date();
            touched = true;
          }
        } else if (Array.isArray(d.rooms) && d.rooms.some(r => String(r) === String(roomId))) {
          d.roomStays.push({ room: roomId, guests: [], services: [], status: 'Checked out', checkedOutAt: new Date() });
          touched = true;
        }
      }
      if (touched) stay.markModified('details');
    } else {
      // Fallback: mark all rooms
      const allRooms = [];
      for (const d of stay.details) {
        if (Array.isArray(d.roomStays) && d.roomStays.length > 0) {
          allRooms.push(...d.roomStays.map(rs => rs.room));
          // mark roomStays
          for (const rs of d.roomStays) {
            rs.status = 'Checked out';
            rs.checkedOutAt = new Date();
          }
        } else if (Array.isArray(d.rooms)) {
          allRooms.push(...d.rooms);
        }
      }
      if (allRooms.length > 0) {
        await Room.updateMany({ _id: { $in: allRooms } }, { $set: { status: 'Cleaning' } });
      }
      stay.markModified('details');
    }

    // Consume prepaid credit used for this checkout
    if (creditApplied2 > 0) {
      stay.prepaidConsumed = Math.max(0, Number(stay.prepaidConsumed || 0) + creditApplied2);
    }

    // If payment succeeded (or assumed succeeded), update reservation payment summary
    // Only update payment summary when amountPaid is provided
    if (status === 'Success' && stay.reservation && amountPaid != null) {
      const resPay = await ReservationPayment.findOne({ reservation: stay.reservation });
      if (resPay) {
        const amt = Number(amountPaid);
        resPay.paidAmount = Math.min(Number(resPay.paidAmount || 0) + amt, Number(resPay.totalPrice || 0));
        if (resPay.paidAmount >= resPay.totalPrice) resPay.paymentStatus = 'fully_paid';
        else if (resPay.paidAmount >= resPay.depositAmount) resPay.paymentStatus = 'deposit_paid';
        else resPay.paymentStatus = 'partially_paid';
        await resPay.save();
      }
    }

    // If all roomStays checked out then close stay, else keep active
    const allRoomStays = stay.details.flatMap(d => Array.isArray(d.roomStays) ? d.roomStays : []);
    const allChecked = allRoomStays.length > 0 && allRoomStays.every(rs => rs.status === 'Checked out');
    if (allChecked) {
      stay.actualCheckOut = new Date();
      stay.status = 'Checked out';
      await stay.save();
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
    } else {
      await stay.save();
    }

    // === [OPTIONAL] XÓA CONVERSATION VÀ MESSAGES SAU CHECKOUT ===
    // Chỉ xóa khi checkout hoàn toàn (tất cả phòng đã checkout)
    if (allChecked && stay.reservation) {
      try {
        // Tìm conversation liên quan đến reservation này
        const conversation = await Conversation.findOne({ reservation: stay.reservation._id });

        if (conversation) {
          // Đếm số messages trước khi xóa để audit
          const messageCount = await Message.countDocuments({ conversation: conversation._id });

          // Xóa tất cả messages trong conversation
          await Message.deleteMany({ conversation: conversation._id });

          // Xóa conversation
          await Conversation.findByIdAndDelete(conversation._id);

          // Audit logging
          console.log(`[CHECKOUT] Chat deleted for reservation ${stay.reservation._id}:`, {
            conversationId: conversation._id,
            threadId: conversation.threadId,
            messagesDeleted: messageCount,
            deletedBy: req.user?._id || 'system',
            deletedAt: new Date()
          });
        }
      } catch (chatDeleteError) {
        // Log lỗi nhưng không fail checkout
        console.error(`[CHECKOUT] Failed to delete chat for reservation ${stay.reservation._id}:`, chatDeleteError);
        // Có thể gửi notification cho admin về lỗi này trong tương lai
      }
    }

    return res.status(200).json({ message: 'Checkout completed', stayId: stay._id, fullyCheckedOut: allChecked });
  } catch (error) {
    console.error('Error confirming checkout:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

// @desc    Verify checkout payment via AppScript (mirror of reservation payment check)
// @route   POST /api/dashboard/checkout/:stayId/verify-payment
// @access  Private (Staff/Manager/Admin)
async function verifyCheckoutPayment(req, res) {
  try {
    const { stayId } = req.params;
    const { roomId = null } = req.body || {};
    const stay = await Stay.findById(stayId)
      .populate('reservation', '_id checkInDate checkOutDate')
      .populate('hotel', 'name');
    if (!stay) return res.status(404).json({ message: 'Stay not found' });
    if (stay.status !== 'Checked in') return res.status(400).json({ message: 'Stay is not in a check-in state' });

    // Compute current amount due similar to createCheckoutPayment
    const msPerDay = 1000 * 60 * 60 * 24;
    const checkInAt = stay.actualCheckIn ? new Date(stay.actualCheckIn) : new Date(stay.reservation.checkInDate);
    const nights = Math.max(1, Math.ceil((new Date() - checkInAt) / msPerDay));
    let servicesCost = 0;
    let nightsPrice = 0;
    if (roomId) {
      const roomDoc = await Room.findById(roomId).select('_id pricePerNight');
      nightsPrice = (roomDoc?.pricePerNight || 0) * nights;
      for (const d of stay.details) {
        if (!Array.isArray(d.roomStays)) continue;
        for (const rs of d.roomStays) {
          if (String(rs.room) !== String(roomId)) continue;
          if (!Array.isArray(rs.services)) continue;
          for (const sv of rs.services) {
            const unit = await ServicePrice(sv.service);
            servicesCost += unit * (sv.quantity || 1);
          }
        }
      }
    } else {
      const allRooms = [];
      for (const d of stay.details) {
        if (Array.isArray(d.roomStays) && d.roomStays.length > 0) {
          allRooms.push(...d.roomStays.map(rs => rs.room));
          for (const rs of d.roomStays) {
            if (!Array.isArray(rs.services)) continue;
            for (const sv of rs.services) {
              const unit = await ServicePrice(sv.service);
              servicesCost += unit * (sv.quantity || 1);
            }
          }
        } else if (Array.isArray(d.rooms)) {
          allRooms.push(...d.rooms);
        }
      }
      const uniq = [...new Set(allRooms.map(r => String(r)))];
      const roomDocs = await Room.find({ _id: { $in: uniq } }).select('_id pricePerNight');
      const priceMap = new Map(roomDocs.map(rd => [String(rd._id), Number(rd.pricePerNight || 0)]));
      for (const rid of uniq) nightsPrice += (priceMap.get(String(rid)) || 0) * nights;
    }

    const resPay = await ReservationPayment.findOne({ reservation: stay.reservation._id });
    if (!resPay) return res.status(404).json({ message: 'Payment summary not found for reservation' });

  // Use credit from paidAmount instead of deposit status; no tax
  const remainingCredit = Math.max(0, Number(resPay.paidAmount || 0) - Number(stay.prepaidConsumed || 0));
  const totalCharge = nightsPrice + servicesCost;
  const amountDue = Math.max(0, totalCharge - Math.min(remainingCredit, totalCharge));
    if (amountDue <= 0) {
      return res.status(200).json({ message: 'No amount due. Nothing to verify.', payment: resPay, amountDue: 0 });
    }

    // Fetch transactions from AppScript
    const scriptUrl = process.env.APPSCRIPT_URL;
    if (!scriptUrl) return res.status(500).json({ message: 'APPSCRIPT_URL is not configured' });

  const response = await fetch(scriptUrl, { method: 'GET', redirect: 'follow', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      const txt = await response.text();
      return res.status(502).json({ message: 'Failed to fetch AppScript', status: response.status, preview: txt.substring(0, 200) });
    }
    const contentType = response.headers.get('content-type') || '';
    let transactions;
    if (contentType.includes('application/json')) {
      const result = await response.json();
      transactions = result.data;
    } else {
      const text = await response.text();
      try { transactions = JSON.parse(text).data; } catch { return res.status(502).json({ message: 'AppScript did not return JSON' }); }
    }

    const reservationId = String(stay.reservation._id).toUpperCase();
    const code6 = reservationId.slice(-6);

    // Try to find a transaction that mentions the reservation id/code
    let matchedTx = transactions.find(tx => {
      const desc = (tx['Mô tả'] || '').toUpperCase();
      const amt = Number(tx['Giá trị'] || 0);
      return amt > 0 && (desc.includes(reservationId) || desc.includes(code6));
    });

    if (!matchedTx) {
      return res.status(404).json({
        message: 'No matching transaction found for checkout',
        reservationId,
        code: code6,
        hint: 'Ensure the transfer description contains the reservation ID or last 6 characters.'
      });
    }

    const paid = Number(matchedTx['Giá trị'] || 0);
  resPay.paidAmount = Math.min((resPay.paidAmount || 0) + paid, resPay.totalPrice || 0);
    if (resPay.paidAmount >= resPay.totalPrice) resPay.paymentStatus = 'fully_paid';
    else if (resPay.paidAmount >= resPay.depositAmount) resPay.paymentStatus = 'deposit_paid';
    else resPay.paymentStatus = 'partially_paid';
    await resPay.save();

    return res.status(200).json({
      message: 'Checkout payment verified via AppScript',
      matchedTransaction: matchedTx,
      payment: resPay
    });
  } catch (error) {
    console.error('Error verifying checkout payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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

    // Load payment summary document for this reservation
    const paymentDoc = await ReservationPayment.findOne({ reservation: reservation._id }).select('paymentStatus depositAmount totalPrice paidAmount');

    // Check payment summary on reservation - must be approved and deposit/full paid
    if (reservation.status !== 'approved' || !['deposit_paid', 'fully_paid'].includes(paymentDoc?.paymentStatus)) {
      return res.status(400).json({ message: 'Reservation is not ready for check-in' });
    }

    const details = await ReservationDetail.find({ reservation: id })
      .populate('roomType', 'name')
      .populate({ path: 'reservedRooms', select: '_id roomNumber name status' });

    // For each roomType, suggest current Available rooms (always provide a pool for reassignment)
    const suggestions = await Promise.all(details.map(async d => {
      const rooms = await Room.find({
        hotel: reservation.hotel,
        roomType: d.roomType._id,
        status: { $in: ['Available', 'available', 'Active'] }
      }).select('_id roomNumber name status');

      return {
        roomType: d.roomType,
        requiredQuantity: d.quantity,
        suggestedRooms: rooms, // full pool for reassignment UI
        source: 'available'
      };
    }));

    return res.json({
      reservation,
      payment: paymentDoc ? {
        paymentStatus: paymentDoc.paymentStatus,
        depositAmount: Number(paymentDoc.depositAmount || 0),
        totalPrice: Number(paymentDoc.totalPrice || 0),
        paidAmount: Number(paymentDoc.paidAmount || 0)
      } : null,
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
// @body    { selections: [{ roomTypeId, roomIds: [..] }], idVerifications?: [{ roomId: string, idDocument: { type?: 'citizen_id'|'passport'|'other', number: string, nameOnId: string, address?: string, images?: Array<{ publicId: string, url: string }>, method?: 'manual'|'face', faceScore?: number } }] }
async function confirmCheckIn(req, res) {
  try {
    const { id } = req.params;
  // Be defensive: req.body may be undefined if Content-Type is missing
  let selections = (req.body && req.body.selections) ? req.body.selections : undefined;

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    // Ensure reservation is approved and payment document shows deposit or full paid
    const resPayment = await ReservationPayment.findOne({ reservation: reservation._id }).select('paymentStatus depositAmount totalPrice paidAmount');
    if (reservation.status !== 'approved' || !['deposit_paid', 'fully_paid'].includes(resPayment?.paymentStatus)) {
      return res.status(400).json({ message: 'Reservation is not ready for check-in' });
    }

  const details = await ReservationDetail.find({ reservation: id });

    // If no selections provided, auto-pick: use reserved rooms first, fill remaining with currently available rooms
    if (!Array.isArray(selections) || selections.length === 0) {
      const autoSelections = [];
      for (const d of details) {
        const reservedIds = Array.isArray(d.reservedRooms) ? d.reservedRooms.map(r => String(r)) : [];
        const need = Math.max(0, Number(d.quantity || 0) - reservedIds.length);

        let picked = [];
        if (need > 0) {
          const candidates = await Room.find({
            hotel: reservation.hotel,
            roomType: d.roomType,
            status: { $in: ['Available', 'available', 'Active'] },
            _id: { $nin: reservedIds }
          }).select('_id').limit(need);

          if (candidates.length < need) {
            return res.status(400).json({
              message: 'Not enough available rooms to auto-complete check-in for a room type',
              detailId: d._id,
              roomTypeId: d.roomType,
              required: d.quantity,
              reservedCount: reservedIds.length,
              stillNeeded: need,
            });
          }
          picked = candidates.map(c => String(c._id));
        }

        autoSelections.push({ roomTypeId: String(d.roomType), roomIds: [...reservedIds, ...picked] });
      }
      selections = autoSelections;
    }
    // Validate counts per roomType; allow reassignment from reserved rooms (we'll reconcile reservedRooms below)
    for (const d of details) {
      const sel = selections.find(s => String(s.roomTypeId) === String(d.roomType));
      if (!sel || !Array.isArray(sel.roomIds) || sel.roomIds.length !== d.quantity) {
        return res.status(400).json({ message: 'Selected rooms must match required quantity for each room type' });
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

    // Reconcile reservedRooms: if selection differs from reserved, release old and update to chosen ones
    for (const d of details) {
      const sel = selections.find(s => String(s.roomTypeId) === String(d.roomType));
      if (!sel) continue;
      const reservedIds = (Array.isArray(d.reservedRooms) ? d.reservedRooms : []).map(r => String(r));
      const selectedIds = sel.roomIds.map(r => String(r));
      const differs = reservedIds.length > 0 && (reservedIds.length !== selectedIds.length || reservedIds.some(r => !selectedIds.includes(r)));
      if (differs) {
        // Release rooms that were reserved but not selected now
        const toRelease = reservedIds.filter(rid => !selectedIds.includes(rid));
        if (toRelease.length > 0) {
          await Room.updateMany({ _id: { $in: toRelease } }, { $set: { status: 'Available' } });
        }
        // Update reservation detail to reflect new selection
        d.reservedRooms = selectedIds;
        await d.save();
      }
      // If there were no reserved rooms, we can still set reservedRooms to selected for consistency
      if (!Array.isArray(d.reservedRooms) || d.reservedRooms.length === 0) {
        d.reservedRooms = selectedIds;
        await d.save();
      }
    }

    // Compute nights and per-detail totalPrice (simple: roomType.basePrice * nights * quantity)
    const msPerDay = 1000 * 60 * 60 * 24;
    const nights = Math.max(1, Math.round((new Date(reservation.checkOutDate) - new Date(reservation.checkInDate)) / msPerDay));

    const roomTypeDocs = await RoomType.find({ _id: { $in: selections.map(s => s.roomTypeId) } });
    const priceMap = new Map(roomTypeDocs.map(rt => [String(rt._id), Number(rt.basePrice || 0)]));

    // Build Stay.details with roomStays
    // ID document validation helpers
    const verArray = (req.body && Array.isArray(req.body.idVerifications)) ? req.body.idVerifications : [];
    function normalizeType(t, num) {
      const raw = (t || '').toString().toLowerCase();
      if (raw === 'cccd' || raw === 'cmnd' || raw === 'passport' || raw === 'other') return raw;
      if (raw === 'citizen_id') {
        // Accept 9 or 12 as VN IDs; infer passport if alphanumeric 6-9
        if (/^\d{12}$/.test(num)) return 'cccd';
        if (/^\d{9}$/.test(num)) return 'cmnd';
        if (/^[A-Za-z0-9]{6,9}$/.test(num)) return 'passport';
        return 'other';
      }
      // Infer by pattern if missing/unknown
      if (/^\d{12}$/.test(num)) return 'cccd';
      if (/^\d{9}$/.test(num)) return 'cmnd';
      if (/^[A-Za-z0-9]{6,9}$/.test(num)) return 'passport';
      return 'other';
    }
    function validateIdDoc(type, number) {
      const num = String(number || '').trim();
      const t = normalizeType(type, num);
      if (t === 'cccd') return { ok: /^\d{12}$/.test(num), t, num };
      if (t === 'cmnd') return { ok: /^\d{9}$/.test(num), t, num };
      if (t === 'passport') return { ok: /^[A-Z0-9]{6,9}$/.test(num.toUpperCase()), t, num: num.toUpperCase() };
      if (t === 'citizen_id') return { ok: /^(?:\d{9}|\d{12})$/.test(num), t, num };
      // other: allow 6-20 alphanumerics/hyphen
      return { ok: /^[A-Za-z0-9-]{6,20}$/.test(num), t: 'other', num: num.toUpperCase() };
    }
    const verMap = new Map();
    for (const v of verArray) {
      const roomId = String(v.roomId);
      const doc = v.idDocument || {};
      if (!doc || !doc.number || !doc.nameOnId) { verMap.set(roomId, null); continue; }
      const check = validateIdDoc(doc.type, doc.number);
      if (!check.ok) {
        return res.status(400).json({ message: 'Invalid ID document for check-in', roomId, type: doc.type || check.t, number: doc.number });
      }
      const normalized = {
        type: check.t,
        number: check.num,
        nameOnId: String(doc.nameOnId).trim(),
        address: doc.address || null,
        images: Array.isArray(doc.images) ? doc.images.map(img => ({ publicId: img.publicId, url: img.url })) : [],
        method: doc.method || 'manual',
        faceScore: typeof doc.faceScore === 'number' ? doc.faceScore : null,
        verifiedAt: new Date(),
        verifiedBy: req.user?._id || null
      };
      verMap.set(roomId, normalized);
    }

    const stayDetails = selections.map(s => {
      const total = (priceMap.get(String(s.roomTypeId)) || 0) * nights * s.roomIds.length;
      return {
        roomType: s.roomTypeId,
        rooms: s.roomIds,
        roomStays: s.roomIds.map(rid => {
          const doc = verMap.get(String(rid));
          return { room: rid, guests: [], services: [], idVerification: doc || null };
        }),
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

// @desc    Add an existing room into an active stay (create a roomStay entry)
// @route   POST /api/dashboard/stays/:stayId/rooms
// @access  Private (Staff/Manager/Admin)
async function addRoomToStay(req, res) {
  try {
    const { stayId } = req.params;
    const { roomId, guests = [], services = [] } = req.body || {};

    if (!roomId) return res.status(400).json({ message: 'roomId is required' });

    const stay = await Stay.findById(stayId).populate('reservation', 'checkInDate checkOutDate').populate('hotel', 'name');
    if (!stay) return res.status(404).json({ message: 'Stay not found' });
    if (stay.status !== 'Checked in') return res.status(400).json({ message: 'Stay is not active for adding rooms' });

    const room = await Room.findById(roomId).select('_id hotel roomType pricePerNight status roomNumber');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (String(room.hotel) !== String(stay.hotel)) return res.status(400).json({ message: 'Room does not belong to this hotel' });

    // Prevent adding a room that's already occupied or already part of this stay
    if (room.status === 'Occupied') return res.status(400).json({ message: 'Room is already occupied' });
    const alreadyInStay = stay.details.some(d => (Array.isArray(d.rooms) && d.rooms.some(r => String(r) === String(roomId))) || (Array.isArray(d.roomStays) && d.roomStays.some(rs => String(rs.room) === String(roomId))));
    if (alreadyInStay) return res.status(400).json({ message: 'Room already belongs to this stay' });

    // Normalize guests and services payload
    const guestList = Array.isArray(guests) ? guests.map(g => ({ fullname: g.fullname || g.name || 'Guest', gender: g.gender || 'other', dateOfBirth: g.dateOfBirth || null, phone: g.phone || null })) : [];
    const svcList = Array.isArray(services) ? services.map(s => {
      if (!s) return null;
      if (typeof s === 'string') return { service: s, quantity: 1 };
      return { service: s.service || s.serviceId || null, quantity: Math.max(1, Number(s.quantity || 1)) };
    }).filter(Boolean) : [];

    // Compute nights for pricing using reservation window when available
    const msPerDay = 1000 * 60 * 60 * 24;
    let nights = 1;
    if (stay.reservation && stay.reservation.checkInDate && stay.reservation.checkOutDate) {
      try {
        nights = Math.max(1, Math.round((new Date(stay.reservation.checkOutDate) - new Date(stay.reservation.checkInDate)) / msPerDay));
      } catch (e) { nights = 1; }
    }

    const totalPrice = (Number(room.pricePerNight || 0) * nights) || 0;

    // Find a matching detail by roomType, or create a new one
    let detail = stay.details.find(d => String(d.roomType) === String(room.roomType));
    if (detail) {
      if (!Array.isArray(detail.rooms)) detail.rooms = [];
      detail.rooms.push(room._id);
      if (!Array.isArray(detail.roomStays)) detail.roomStays = [];
      detail.roomStays.push({ room: room._id, guests: guestList, services: svcList, idVerification: null, notes: null, status: 'Checked in' });
      detail.totalPrice = (Number(detail.totalPrice || 0) + totalPrice);
    } else {
      const newDetail = {
        roomType: room.roomType,
        rooms: [room._id],
        services: [],
        totalPrice: totalPrice,
        notes: null,
        roomStays: [{ room: room._id, guests: guestList, services: svcList, idVerification: null, notes: null, status: 'Checked in' }]
      };
      stay.details.push(newDetail);
    }

    stay.markModified('details');

    // Mark room as Occupied
    await Room.findByIdAndUpdate(room._id, { $set: { status: 'Occupied' } });

    await stay.save();

    // Create a RoomActivity record and emit
    const activity = await RoomActivity.create({
      room: room._id,
      user: req.user?._id || null,
      type: 'assignment',
      message: `Room ${room.roomNumber} assigned to stay ${stay._id}`,
      meta: { stay: stay._id },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    try { chatController.emit('room_activity', { room: room._id, activity }); } catch (e) { console.warn('emit failed', e && e.message); }

    return res.status(200).json({ message: 'Room added to stay', stay, activity });
  } catch (error) {
    console.error('Error adding room to stay:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
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
