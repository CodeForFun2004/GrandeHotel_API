const User = require('../models/user.model');
const Hotel = require('../models/hotelModel');
const Room = require('../models/roomModel');
const Reservation = require('../models/reservationModel');

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
  getRecentActivities
};
