const mongoose = require('mongoose');
const Reservation = require('../models/reservationModel');
const Payment = require('../models/paymentModel');
const ReservationDetail = require('../models/reservationDetailModel');
const Service = require('../models/serviceModel');
const Room = require('../models/roomModel');
const Hotel = require('../models/hotelModel');

// GET /api/manager/dashboard/kpis
// Get KPIs: Total Bookings, Revenue, Occupancy, ADR
exports.getKPIs = async (req, res) => {
  try {
    const userId = req.user._id;
    let hotelId = req.user.hotelId || req.user.storeId;

    if (!hotelId) {
      return res.status(404).json({
        success: false,
        message: 'Manager chưa được gán vào khách sạn nào'
      });
    }

    // Convert to ObjectId if it's a string
    if (typeof hotelId === 'string') {
      hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    // Total Bookings
    const totalBookings = await Reservation.countDocuments({
      hotel: hotelId,
      createdAt: { $gte: fromDate, $lte: toDate }
    });

    // Revenue (from payments)
    const revenueResult = await Payment.aggregate([
      {
        $lookup: {
          from: 'reservations',
          localField: 'reservation',
          foreignField: '_id',
          as: 'reservation'
        }
      },
      { $unwind: '$reservation' },
      {
        $match: {
          'reservation.hotel': hotelId,
          'reservation.createdAt': { $gte: fromDate, $lte: toDate },
          paymentStatus: { $in: ['deposit_paid', 'fully_paid', 'partially_paid'] }
        }
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$paidAmount' }
        }
      }
    ]);
    const revenue = revenueResult.length > 0 ? revenueResult[0].revenue : 0;

    // Occupancy: Calculate based on rooms and reservations
    const totalRooms = await Room.countDocuments({ hotel: hotelId });
    const occupiedRooms = await Reservation.aggregate([
      {
        $match: {
          hotel: hotelId,
          status: { $in: ['approved', 'completed'] },
          stayStatus: { $in: ['checked_in', 'checked_out'] },
          checkInDate: { $lte: toDate },
          checkOutDate: { $gte: fromDate }
        }
      },
      {
        $lookup: {
          from: 'reservationdetails',
          localField: '_id',
          foreignField: 'reservation',
          as: 'details'
        }
      },
      {
        $project: {
          totalRooms: { $sum: '$details.quantity' }
        }
      },
      {
        $group: {
          _id: null,
          occupied: { $sum: '$totalRooms' }
        }
      }
    ]);
    const occupied = occupiedRooms.length > 0 ? occupiedRooms[0].occupied : 0;
    const occupancy = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

    // ADR (Average Daily Rate) = Revenue / Total Bookings
    const adr = totalBookings > 0 ? Math.round(revenue / totalBookings) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        revenue,
        occupancy,
        adr
      }
    });

  } catch (error) {
    console.error('Error getting KPIs:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// GET /api/manager/dashboard/revenue-series
// Get revenue series (7 days or 12 months)
exports.getRevenueSeries = async (req, res) => {
  try {
    const userId = req.user._id;
    let hotelId = req.user.hotelId || req.user.storeId;

    if (!hotelId) {
      return res.status(404).json({
        success: false,
        message: 'Manager chưa được gán vào khách sạn nào'
      });
    }

    // Convert to ObjectId if it's a string
    if (typeof hotelId === 'string') {
      hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    const { groupBy, from, to } = req.query;
    const isMonth = groupBy === 'month';

    let revenueData = [];

    if (isMonth) {
      // 12 months
      const currentDate = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);

        const monthRevenue = await Payment.aggregate([
          {
            $lookup: {
              from: 'reservations',
              localField: 'reservation',
              foreignField: '_id',
              as: 'reservation'
            }
          },
          { $unwind: '$reservation' },
          {
            $match: {
              'reservation.hotel': hotelId,
              'reservation.createdAt': { $gte: date, $lt: nextMonth },
              paymentStatus: { $in: ['deposit_paid', 'fully_paid', 'partially_paid'] }
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$paidAmount' }
            }
          }
        ]);

        revenueData.push({
          label: `T${date.getMonth() + 1}`,
          value: monthRevenue.length > 0 ? monthRevenue[0].revenue : 0
        });
      }
    } else {
      // 7 days
      const fromDate = from ? new Date(from) : new Date();
      fromDate.setDate(fromDate.getDate() - 29); // Last 7 days
      fromDate.setHours(0, 0, 0, 0);

      for (let i = 0; i < 30; i++) {
        const date = new Date(fromDate);
        date.setDate(date.getDate() + i);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const dayRevenue = await Payment.aggregate([
          {
            $lookup: {
              from: 'reservations',
              localField: 'reservation',
              foreignField: '_id',
              as: 'reservation'
            }
          },
          { $unwind: '$reservation' },
          {
            $match: {
              'reservation.hotel': hotelId,
              'reservation.createdAt': { $gte: date, $lt: nextDay },
              paymentStatus: { $in: ['deposit_paid', 'fully_paid', 'partially_paid'] }
            }
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$paidAmount' }
            }
          }
        ]);

        revenueData.push({
          label: `D${i + 1}`,
          value: dayRevenue.length > 0 ? dayRevenue[0].revenue : 0
        });
      }
    }

    res.status(200).json({
      success: true,
      data: revenueData
    });

  } catch (error) {
    console.error('Error getting revenue series:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// GET /api/manager/dashboard/booking-status
// Get booking counts by status
exports.getBookingStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    let hotelId = req.user.hotelId || req.user.storeId;

    if (!hotelId) {
      return res.status(404).json({
        success: false,
        message: 'Manager chưa được gán vào khách sạn nào'
      });
    }

    // Convert to ObjectId if it's a string
    if (typeof hotelId === 'string') {
      hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const matchFilter = {
      hotel: hotelId,
      createdAt: { $gte: fromDate, $lte: toDate }
    };

    // Get counts by status
    const statusCounts = await Reservation.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get stay status counts
    const stayStatusCounts = await Reservation.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$stayStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Map to expected format
    const statusMap = {
      approved: 'Approved',
      pending: 'Pending',
      rejected: 'Rejected',
      canceled: 'Canceled',
      completed: 'Completed'
    };

    const stayStatusMap = {
      checked_in: 'Checked-in',
      checked_out: 'Checked-out',
      not_checked_in: 'Not Checked-in'
    };

    const result = [];

    // Add status counts
    statusCounts.forEach(item => {
      if (statusMap[item._id]) {
        result.push({
          status: statusMap[item._id],
          value: item.count
        });
      }
    });

    // Add stay status counts (only checked-in and checked-out)
    stayStatusCounts.forEach(item => {
      if (item._id === 'checked_in' || item._id === 'checked_out') {
        result.push({
          status: stayStatusMap[item._id],
          value: item.count
        });
      }
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error getting booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// GET /api/manager/dashboard/top-services
// Get top services by revenue
exports.getTopServices = async (req, res) => {
  try {
    const userId = req.user._id;
    let hotelId = req.user.hotelId || req.user.storeId;

    if (!hotelId) {
      return res.status(404).json({
        success: false,
        message: 'Manager chưa được gán vào khách sạn nào'
      });
    }

    // Convert to ObjectId if it's a string
    if (typeof hotelId === 'string') {
      hotelId = new mongoose.Types.ObjectId(hotelId);
    }

    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    // Get service revenue from ReservationDetail
    const serviceRevenue = await ReservationDetail.aggregate([
      {
        $lookup: {
          from: 'reservations',
          localField: 'reservation',
          foreignField: '_id',
          as: 'reservation'
        }
      },
      { $unwind: '$reservation' },
      {
        $match: {
          'reservation.hotel': hotelId,
          'reservation.createdAt': { $gte: fromDate, $lte: toDate },
          'reservation.status': { $in: ['approved', 'completed'] }
        }
      },
      { $unwind: { path: '$services', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'services',
          localField: 'services.service',
          foreignField: '_id',
          as: 'service'
        }
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$service._id',
          name: { $first: '$service.name' },
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$service.basePrice', 0] },
                { $ifNull: ['$services.quantity', 0] }
              ]
            }
          }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);

    const result = serviceRevenue.map(item => ({
      name: item.name || 'Unknown',
      revenue: item.revenue || 0
    }));

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error getting top services:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

