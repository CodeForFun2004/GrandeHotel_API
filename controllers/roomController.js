const RoomType = require('../models/roomTypeModel');
const Hotel = require('../models/hotelModel');
const Room = require('../models/roomModel');
const ReservationDetail = require('../models/reservationDetailModel');
const Reservation = require('../models/reservationModel');
const mongoose = require('mongoose');

//This includes CRUD operations for RoomType and Room
// ---- CRUD for RoomType ----
exports.createRoomType = async (req, res) => {
    const { name, capacity, basePrice, numberOfBeds, description } = req.body;
    try {
        const roomType = new RoomType({
            name,
            capacity,
            basePrice,
            numberOfBeds,
            description
        });
        await roomType.save();
        res.status(201).json(roomType);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }   
};

exports.getAllRoomTypes = async (req, res) => {
    try {
        const roomTypes = await RoomType.find();
        res.status(200).json(roomTypes);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }   
};

exports.getRoomTypeById = async (req, res) => {
    const roomTypeId = req.params.id;
    try {
        const roomType = await RoomType.findById(roomTypeId);
        if (!roomType) {
            return res.status(404).json({ message: 'Room type not found' });
        }
        res.status(200).json(roomType);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateRoomType = async (req, res) => {
    const roomTypeId = req.params.id;
    try {
        const roomType = await RoomType.findByIdAndUpdate(roomTypeId, req.body, { new: true });
        if (!roomType) {
            return res.status(404).json({ message: 'Room type not found' });
        }
        res.status(200).json(roomType);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteRoomType = async (req, res) => {
    const roomTypeId = req.params.id;
    try {
        const roomType = await RoomType.findByIdAndDelete(roomTypeId);
        if (!roomType) {
            return res.status(404).json({ message: 'Room type not found' });
        }
        res.status(200).json({ message: 'Room type deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// ---- CRUD for Room ----
exports.createRoom = async (req, res) => {
    const { roomType, hotel, roomNumber, status, description, pricePerNight, images } = req.body;
    try {
        const room = new Room({
            roomType,
            hotel,
            roomNumber,
            status,
            description,
            pricePerNight,
            images
        });
        await room.save();
        res.status(201).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find().populate('roomType').populate('hotel');
        res.status(200).json(rooms);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getRoomById = async (req, res) => {
    const roomId = req.params.id;
    try {
        const room = await Room.findById(roomId).populate('roomType').populate('hotel');
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.status(200).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.updateRoom = async (req, res) => {
    const roomId = req.params.id;
    try {
        const room = await Room.findByIdAndUpdate(roomId, req.body, { new: true });
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.status(200).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteRoom = async (req, res) => {
    const roomId = req.params.id;
    try {
        const room = await Room.findByIdAndDelete(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.status(200).json({ message: 'Room deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.searchRooms = async (req, res) => {
  try {
        const { hotelId } = req.params;
    const { checkInDate, checkOutDate, numberOfRooms } = req.query;
    // pagination for room type groups
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);

        // Step 1: Get all rooms of this hotel (not under maintenance)
        const allRooms = await Room.find({
            hotel: hotelId,
            status: { $ne: 'maintenance' }
        }).populate('roomType');

        // If no dates provided, return grouped rooms without reservation checks
        if (!checkInDate || !checkOutDate) {
            const grouped = {};
            allRooms.forEach(room => {
                const typeId = room.roomType._id.toString();
                if (!grouped[typeId]) grouped[typeId] = { roomType: room.roomType, rooms: [] };
                grouped[typeId].rooms.push({
                    _id: room._id,
                    roomNumber: room.roomNumber,
                    pricePerNight: room.pricePerNight,
                    status: room.status,
                    description: room.description,
                    images: room.images
                });
            });

            const results = Object.values(grouped).map(group => {
                const total = group.rooms.length;
                const availableCount = total; // without reservations, all are available
                return {
                    roomType: group.roomType,
                    available: availableCount,
                    availableRooms: group.rooms.slice(0, availableCount)
                };
            });

            // Optional filter by numberOfRooms
            const num = parseInt(numberOfRooms, 10);
            const filtered = (!isNaN(num) && num > 0)
                ? results.filter(r => r.available >= num)
                : results;

            // paginate filtered results
            const totalCount = filtered.length;
            const start = (page - 1) * limit;
            const paged = filtered.slice(start, start + limit);

            return res.status(200).json({ results: paged, total: totalCount, page, limit });
        }

        // dates provided -> run existing reservation overlap logic
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        if (isNaN(checkIn) || isNaN(checkOut) || checkIn >= checkOut) {
            return res.status(400).json({ message: 'Invalid date range' });
        }

        // Step 2: Find reserved room IDs that overlap with selected dates
        const overlappingReservations = await Reservation.find({
            hotel: hotelId,
            status: { $in: ['pending', 'approved', 'paid'] },
            $or: [{ checkInDate: { $lt: checkOut }, checkOutDate: { $gt: checkIn } }]
        }).select('_id');

        const reservedRoomDetails = await ReservationDetail.find({
            reservation: { $in: overlappingReservations.map(r => r._id) }
        }).populate('roomType');

        // Count reserved quantities per roomType
        const reservedCount = {};
        reservedRoomDetails.forEach(rd => {
            const key = rd.roomType._id.toString();
            reservedCount[key] = (reservedCount[key] || 0) + rd.quantity;
        });

        // Step 3: Group available rooms by roomType
        const grouped = {};
        allRooms.forEach(room => {
            const typeId = room.roomType._id.toString();
            if (!grouped[typeId]) grouped[typeId] = { roomType: room.roomType, rooms: [] };
            grouped[typeId].rooms.push({
                _id: room._id,
                roomNumber: room.roomNumber,
                pricePerNight: room.pricePerNight,
                status: room.status,
                description: room.description,
                images: room.images
            });
        });

        // Step 4: Subtract reserved counts from each type
        const results = Object.values(grouped).map(group => {
            const total = group.rooms.length;
            const reserved = reservedCount[group.roomType._id.toString()] || 0;
            const availableCount = Math.max(total - reserved, 0);
            return {
                roomType: group.roomType,
                available: availableCount,
                availableRooms: group.rooms.slice(0, availableCount) // just pick that many
            };
        }).filter(item => item.available > 0);

        // Step 5: Optional filter by numberOfRooms
        const num = parseInt(numberOfRooms, 10);
        const filtered = (!isNaN(num) && num > 0)
            ? results.filter(r => r.available >= num)
            : results;

        // paginate filtered results
        const totalCount = filtered.length;
        const start = (page - 1) * limit;
        const paged = filtered.slice(start, start + limit);

        res.status(200).json({ results: paged, total: totalCount, page, limit });

  } catch (error) {
    console.error('Error searching rooms:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
