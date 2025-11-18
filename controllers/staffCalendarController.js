const Reservation = require('../models/reservationModel');
const ReservationDetail = require('../models/reservationDetailModel');
const Stay = require('../models/stayModel');
const Room = require('../models/roomModel');
const User = require('../models/user.model');

/**
 * GET /api/staff/calendar/events
 * Lấy danh sách các sự kiện trong khoảng thời gian cho staff calendar
 */
exports.getCalendarEvents = async (req, res) => {
  try {
    const { startDate, endDate, type, roomId, roomNumber, keyword } = req.query;

    // Validation: startDate and endDate are required
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
        error: 'ValidationError'
      });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate date range
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use ISO date string (YYYY-MM-DD)',
        error: 'ValidationError'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be <= endDate',
        error: 'ValidationError'
      });
    }

    // Check date range (max 1 year)
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return res.status(400).json({
        success: false,
        message: 'Date range cannot exceed 365 days',
        error: 'ValidationError'
      });
    }

    // Get hotelId from staff user
    const hotelId = req.user.hotelId;
    if (!hotelId) {
      return res.status(403).json({
        success: false,
        message: 'Staff must be assigned to a hotel'
      });
    }

    // Set end date to end of day for proper overlap checking
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    const events = [];
    const eventType = type || 'ALL';

    // Helper function to check if event matches keyword search
    const matchesKeyword = (event, searchKeyword) => {
      if (!searchKeyword) return true;
      const keyword = searchKeyword.toLowerCase();
      return (
        event.title?.toLowerCase().includes(keyword) ||
        event.roomNumber?.toLowerCase().includes(keyword) ||
        event.reservationId?.toLowerCase().includes(keyword) ||
        event.stayId?.toLowerCase().includes(keyword) ||
        event.customerName?.toLowerCase().includes(keyword)
      );
    };

    // Helper function to check room filter
    const matchesRoomFilter = (eventRoomId, eventRoomNumber) => {
      if (roomId && eventRoomId?.toString() !== roomId.toString()) {
        return false;
      }
      if (roomNumber && eventRoomNumber !== roomNumber) {
        return false;
      }
      return true;
    };

    // 1. GET RESERVATION EVENTS
    if (eventType === 'ALL' || eventType === 'reservation') {
      const reservationQuery = {
        hotel: hotelId,
        status: { $in: ['pending', 'approved'] },
        checkInDate: { $lte: endOfDay },
        checkOutDate: { $gte: start }
      };

      const reservations = await Reservation.find(reservationQuery)
        .populate('customer', 'fullname username phone email')
        .populate({
          path: 'details',
          populate: [
            { path: 'roomType', select: 'name' },
            { path: 'reservedRooms', select: 'roomNumber code' }
          ]
        })
        .lean();

      for (const rsv of reservations) {
        // Handle multiple rooms in reservation details
        if (rsv.details && rsv.details.length > 0) {
          for (const detail of rsv.details) {
            // If reservation has reservedRooms, create event for each room
            if (detail.reservedRooms && detail.reservedRooms.length > 0) {
              for (const room of detail.reservedRooms) {
                const event = {
                  id: `rsv_${rsv._id}_${room._id}`,
                  type: 'reservation',
                  title: `Reservation ${rsv._id.toString().slice(-6).toUpperCase()} • ${rsv.customer?.fullname || rsv.customer?.username || 'Guest'}`,
                  roomNumber: room.roomNumber,
                  roomId: room._id.toString(),
                  reservationId: rsv._id.toString(),
                  startsAt: new Date(rsv.checkInDate).toISOString(),
                  endsAt: new Date(rsv.checkOutDate).toISOString(),
                  status: rsv.status === 'pending' ? 'pending' : 'confirmed',
                  customerName: rsv.customer?.fullname || rsv.customer?.username,
                  customerPhone: rsv.customer?.phone,
                  customerEmail: rsv.customer?.email
                };

                if (matchesRoomFilter(event.roomId, event.roomNumber) && matchesKeyword(event, keyword)) {
                  events.push(event);
                }
              }
            } else {
              // If no reserved rooms yet, create event based on roomType (without specific room)
              const event = {
                id: `rsv_${rsv._id}_${detail._id}`,
                type: 'reservation',
                title: `Reservation ${rsv._id.toString().slice(-6).toUpperCase()} • ${rsv.customer?.fullname || rsv.customer?.username || 'Guest'}`,
                roomNumber: null, // No specific room assigned yet
                roomId: null,
                reservationId: rsv._id.toString(),
                startsAt: new Date(rsv.checkInDate).toISOString(),
                endsAt: new Date(rsv.checkOutDate).toISOString(),
                status: rsv.status === 'pending' ? 'pending' : 'confirmed',
                customerName: rsv.customer?.fullname || rsv.customer?.username,
                customerPhone: rsv.customer?.phone,
                customerEmail: rsv.customer?.email
              };

              if (matchesKeyword(event, keyword)) {
                events.push(event);
              }
            }
          }
        } else {
          // Fallback: reservation without details
          const event = {
            id: `rsv_${rsv._id}`,
            type: 'reservation',
            title: `Reservation ${rsv._id.toString().slice(-6).toUpperCase()} • ${rsv.customer?.fullname || rsv.customer?.username || 'Guest'}`,
            roomNumber: null,
            roomId: null,
            reservationId: rsv._id.toString(),
            startsAt: new Date(rsv.checkInDate).toISOString(),
            endsAt: new Date(rsv.checkOutDate).toISOString(),
            status: rsv.status === 'pending' ? 'pending' : 'confirmed',
            customerName: rsv.customer?.fullname || rsv.customer?.username,
            customerPhone: rsv.customer?.phone,
            customerEmail: rsv.customer?.email
          };

          if (matchesKeyword(event, keyword)) {
            events.push(event);
          }
        }
      }
    }

    // 2. GET STAY EVENTS
    if (eventType === 'ALL' || eventType === 'stay') {
      const stayQuery = {
        hotel: hotelId,
        status: { $in: ['Checked in'] }
      };

      const stays = await Stay.find(stayQuery)
        .populate('customer', 'fullname username phone email')
        .populate('reservation', 'checkInDate checkOutDate')
        .lean();

      for (const stay of stays) {
        if (!stay.reservation) continue;

        const reservation = stay.reservation;
        const checkInDate = stay.actualCheckIn ? new Date(stay.actualCheckIn) : new Date(reservation.checkInDate);
        const checkOutDate = stay.actualCheckOut ? new Date(stay.actualCheckOut) : new Date(reservation.checkOutDate);

        // Check if stay overlaps with date range
        if (checkInDate > endOfDay || checkOutDate < start) {
          continue;
        }

        // Process each detail in stay
        if (stay.details && stay.details.length > 0) {
          for (const detail of stay.details) {
            // Process each roomStay in detail
            if (detail.roomStays && detail.roomStays.length > 0) {
              for (const roomStay of detail.roomStays) {
                // Populate room if needed
                const room = await Room.findById(roomStay.room).lean();
                if (!room) continue;

                const event = {
                  id: `stay_${stay._id}_${room._id}`,
                  type: 'stay',
                  title: `Stay ${stay._id.toString().slice(-6).toUpperCase()} • ${stay.customer?.fullname || stay.customer?.username || 'Guest'}`,
                  roomNumber: room.roomNumber,
                  roomId: room._id.toString(),
                  stayId: stay._id.toString(),
                  startsAt: checkInDate.toISOString(),
                  endsAt: checkOutDate.toISOString(),
                  status: 'checked-in',
                  customerName: stay.customer?.fullname || stay.customer?.username,
                  customerPhone: stay.customer?.phone,
                  customerEmail: stay.customer?.email
                };

                if (matchesRoomFilter(event.roomId, event.roomNumber) && matchesKeyword(event, keyword)) {
                  events.push(event);
                }
              }
            } else if (detail.rooms && detail.rooms.length > 0) {
              // Fallback: use rooms array if roomStays not available
              for (const roomId of detail.rooms) {
                const room = await Room.findById(roomId).lean();
                if (!room) continue;

                const event = {
                  id: `stay_${stay._id}_${room._id}`,
                  type: 'stay',
                  title: `Stay ${stay._id.toString().slice(-6).toUpperCase()} • ${stay.customer?.fullname || stay.customer?.username || 'Guest'}`,
                  roomNumber: room.roomNumber,
                  roomId: room._id.toString(),
                  stayId: stay._id.toString(),
                  startsAt: checkInDate.toISOString(),
                  endsAt: checkOutDate.toISOString(),
                  status: 'checked-in',
                  customerName: stay.customer?.fullname || stay.customer?.username,
                  customerPhone: stay.customer?.phone,
                  customerEmail: stay.customer?.email
                };

                if (matchesRoomFilter(event.roomId, event.roomNumber) && matchesKeyword(event, keyword)) {
                  events.push(event);
                }
              }
            }
          }
        }
      }
    }

    // 3. GET MAINTENANCE EVENTS
    // Note: Maintenance model chưa có, sẽ trả về empty array
    // Có thể implement sau khi có model Maintenance
    if (eventType === 'ALL' || eventType === 'maintenance') {
      // TODO: Implement when Maintenance model is available
      // For now, check rooms with status 'Maintenance'
      const maintenanceRooms = await Room.find({
        hotel: hotelId,
        status: 'Maintenance'
      }).lean();

      for (const room of maintenanceRooms) {
        // Create a maintenance event (no specific start/end date from room model)
        // Use created date as start, or skip if no date info
        const event = {
          id: `maint_${room._id}`,
          type: 'maintenance',
          title: `Bảo trì phòng ${room.roomNumber}`,
          roomNumber: room.roomNumber,
          roomId: room._id.toString(),
          startsAt: room.createdAt ? new Date(room.createdAt).toISOString() : new Date().toISOString(),
          endsAt: room.updatedAt ? new Date(room.updatedAt).toISOString() : new Date().toISOString(),
          status: 'in-progress'
        };

        // Check date overlap
        const eventStart = new Date(event.startsAt);
        const eventEnd = new Date(event.endsAt);
        if (eventStart <= endOfDay && eventEnd >= start) {
          if (matchesRoomFilter(event.roomId, event.roomNumber) && matchesKeyword(event, keyword)) {
            events.push(event);
          }
        }
      }
    }

    // 4. GET TASK EVENTS
    // Note: Task model chưa có, sẽ trả về empty array
    // Có thể implement sau khi có model Task
    if (eventType === 'ALL' || eventType === 'task') {
      // TODO: Implement when Task model is available
      // For now, return empty array
    }

    // Sort events by startsAt (ascending)
    events.sort((a, b) => {
      const dateA = new Date(a.startsAt);
      const dateB = new Date(b.startsAt);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
      // If same start time, sort by type priority: reservation → stay → maintenance → task
      const typeOrder = { reservation: 1, stay: 2, maintenance: 3, task: 4 };
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });

    return res.status(200).json({
      success: true,
      data: {
        events,
        total: events.length,
        startDate: startDate,
        endDate: endDate
      }
    });

  } catch (error) {
    console.error('[STAFF_CALENDAR] Error fetching calendar events:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

