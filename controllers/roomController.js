const RoomType = require('../models/roomTypeModel');
const Hotel = require('../models/hotelModel');
const Room = require('../models/roomModel');
const ReservationDetail = require('../models/reservationDetailModel');
const Reservation = require('../models/reservationModel');
const mongoose = require('mongoose');
//git
//This includes CRUD operations for RoomType and Room
// ---- CRUD for RoomType ----
exports.createRoomType = async (req, res) => {
    try {
        const { name, capacity, basePrice, numberOfBeds, description, amenities, isActive } = req.body;
        
        // Get manager's hotel ID
        const hotelId = req.user?.hotelId || req.user?.storeId;
        if (!hotelId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Manager hotel ID not found' 
            });
        }

        // Validation
        if (!name || !basePrice || !capacity) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, basePrice, and capacity are required' 
            });
        }

        if (basePrice <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Base price must be greater than 0' 
            });
        }

        // Check if name already exists in this hotel
        const existingRoomType = await RoomType.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') }, 
            hotel: hotelId 
        });

        if (existingRoomType) {
            return res.status(409).json({ 
                success: false, 
                message: 'Room type name already exists in this hotel' 
            });
        }

        const roomType = new RoomType({
            name,
            capacity,
            basePrice,
            numberOfBeds: numberOfBeds || Math.ceil(capacity / 2),
            description,
            amenities: amenities || [],
            isActive: isActive !== undefined ? isActive : true,
            hotel: hotelId,
            maxCapacity: capacity
        });
        
        await roomType.save();
        await roomType.populate('hotel', 'name address');
        
        res.status(201).json({
            success: true,
            data: roomType,
            message: 'Room type created successfully'
        });
    } catch (error) {
        console.error('Error creating room type:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }   
};

exports.getAllRoomTypes = async (req, res) => {
    try {
        // Get manager's hotel ID
        const hotelId = req.user?.hotelId || req.user?.storeId;
        if (!hotelId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Manager hotel ID not found' 
            });
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Search and filter
        const search = req.query.search || '';
        const isActive = req.query.isActive;
        
        // Build query
        let query = { hotel: hotelId };
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        // Get total count
        const total = await RoomType.countDocuments(query);
        
        // Get room types with pagination
        const roomTypes = await RoomType.find(query)
            .populate('hotel', 'name address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Transform data to match frontend format
        const transformedData = roomTypes.map(rt => ({
            id: rt._id,
            name: rt.name,
            description: rt.description,
            basePrice: rt.basePrice,
            maxCapacity: rt.maxCapacity,
            amenities: rt.amenities || [],
            isActive: rt.isActive,
            hotel: rt.hotel
        }));

        res.status(200).json({
            success: true,
            data: transformedData,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            message: 'Room types retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting room types:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }   
};

exports.getRoomTypeById = async (req, res) => {
    try {
        const roomTypeId = req.params.id;
        const hotelId = req.user?.hotelId || req.user?.storeId;

        const roomType = await RoomType.findOne({ 
            _id: roomTypeId, 
            hotel: hotelId 
        }).populate('hotel', 'name address');

        if (!roomType) {
            return res.status(404).json({ 
                success: false, 
                message: 'Room type not found' 
            });
        }

        // Transform data to match frontend format
        const transformedData = {
            id: roomType._id,
            name: roomType.name,
            description: roomType.description,
            basePrice: roomType.basePrice,
            maxCapacity: roomType.maxCapacity,
            amenities: roomType.amenities || [],
            isActive: roomType.isActive,
            hotel: roomType.hotel
        };

        res.status(200).json({
            success: true,
            data: transformedData,
            message: 'Room type retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting room type:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

exports.updateRoomType = async (req, res) => {
    try {
        const roomTypeId = req.params.id;
        const hotelId = req.user?.hotelId || req.user?.storeId;
        const { name, description, basePrice, maxCapacity, amenities, isActive } = req.body;

        // Find existing room type
        const existingRoomType = await RoomType.findOne({ 
            _id: roomTypeId, 
            hotel: hotelId 
        });

        if (!existingRoomType) {
            return res.status(404).json({ 
                success: false, 
                message: 'Room type not found' 
            });
        }

        // Check if new name conflicts with existing room types
        if (name && name !== existingRoomType.name) {
            const nameConflict = await RoomType.findOne({ 
                name: { $regex: new RegExp(`^${name}$`, 'i') }, 
                hotel: hotelId,
                _id: { $ne: roomTypeId }
            });

            if (nameConflict) {
                return res.status(409).json({ 
                    success: false, 
                    message: 'Room type name already exists in this hotel' 
                });
            }
        }

        // Validation
        if (basePrice !== undefined && basePrice <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Base price must be greater than 0' 
            });
        }

        if (maxCapacity !== undefined && maxCapacity <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Max capacity must be greater than 0' 
            });
        }

        // Update room type
        const updatedRoomType = await RoomType.findByIdAndUpdate(
            roomTypeId,
            {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(basePrice !== undefined && { basePrice }),
                ...(maxCapacity !== undefined && { maxCapacity, capacity: maxCapacity }),
                ...(amenities !== undefined && { amenities }),
                ...(isActive !== undefined && { isActive })
            },
            { new: true, runValidators: true }
        ).populate('hotel', 'name address');

        res.status(200).json({
            success: true,
            data: updatedRoomType,
            message: 'Room type updated successfully'
        });
    } catch (error) {
        console.error('Error updating room type:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

exports.deleteRoomType = async (req, res) => {
    try {
        const roomTypeId = req.params.id;
        const hotelId = req.user?.hotelId || req.user?.storeId;

        // Check if room type exists and belongs to manager's hotel
        const roomType = await RoomType.findOne({ 
            _id: roomTypeId, 
            hotel: hotelId 
        });

        if (!roomType) {
            return res.status(404).json({ 
                success: false, 
                message: 'Room type not found' 
            });
        }

        // Check if room type is being used by any rooms
        const roomsUsingType = await Room.countDocuments({ 
            roomType: roomTypeId, 
            hotel: hotelId 
        });

        if (roomsUsingType > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete room type. It is being used by ${roomsUsingType} room(s). Please delete or reassign those rooms first.` 
            });
        }

        await RoomType.findByIdAndDelete(roomTypeId);

        res.status(200).json({
            success: true,
            message: 'Room type deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting room type:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};

// ---- CRUD for Room ----
exports.createRoom = async (req, res) => {
    try {
        const { 
            code, 
            name, 
            roomType, 
            roomNumber, 
            status, 
            description, 
            pricePerNight, 
            capacity, 
            images 
        } = req.body;

        // Get manager's hotel ID
        const hotelId = req.user?.hotelId || req.user?.storeId;
        if (!hotelId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Manager hotel ID not found' 
            });
        }

        // Validation
        if (!code || !name || !roomType || !roomNumber || !pricePerNight || !capacity) {
            return res.status(400).json({ 
                success: false, 
                message: 'Code, name, roomType, roomNumber, pricePerNight, and capacity are required' 
            });
        }

        if (pricePerNight <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Price per night must be greater than 0' 
            });
        }

        if (capacity <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Capacity must be greater than 0' 
            });
        }

        // Check if room type exists and belongs to manager's hotel
        const roomTypeExists = await RoomType.findOne({ 
            _id: roomType, 
            hotel: hotelId 
        });

        if (!roomTypeExists) {
            return res.status(400).json({ 
                success: false, 
                message: 'Room type not found or does not belong to your hotel' 
            });
        }

        // Check if code already exists in this hotel
        const existingCode = await Room.findOne({ 
            code: { $regex: new RegExp(`^${code}$`, 'i') }, 
            hotel: hotelId 
        });

        if (existingCode) {
            return res.status(409).json({ 
                success: false, 
                message: 'Room code already exists in this hotel' 
            });
        }

        // Check if room number already exists in this hotel
        const existingRoomNumber = await Room.findOne({ 
            roomNumber: { $regex: new RegExp(`^${roomNumber}$`, 'i') }, 
            hotel: hotelId 
        });

        if (existingRoomNumber) {
            return res.status(409).json({ 
                success: false, 
                message: 'Room number already exists in this hotel' 
            });
        }

        // Create room
        const room = new Room({
            code,
            name,
            roomType,
            hotel: hotelId,
            roomNumber,
            status: status || 'Active',
            description,
            pricePerNight,
            capacity,
            images: images || []
        });

        await room.save();
        await room.populate('roomType', 'name basePrice maxCapacity amenities');
        await room.populate('hotel', 'name address');

        res.status(201).json({
            success: true,
            data: room,
            message: 'Room created successfully'
        });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};  
exports.getAllRooms = async (req, res) => {
    try {
        // Get manager's hotel ID
        const hotelId = req.user?.hotelId || req.user?.storeId;
        if (!hotelId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Manager hotel ID not found' 
            });
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Search and filter
        const search = req.query.search || '';
        const status = req.query.status;
        const type = req.query.type;
        
        // Build query
        let query = { hotel: hotelId };
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { roomNumber: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status) {
            query.status = status;
        }
        
        if (type) {
            query.roomType = type;
        }

        // Get total count
        const total = await Room.countDocuments(query);
        
        // Get rooms with pagination
        const rooms = await Room.find(query)
            .populate('roomType', 'name basePrice maxCapacity amenities')
            .populate('hotel', 'name address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Transform data to match frontend format
        const transformedData = rooms.map(room => ({
            id: room._id,
            code: room.code,
            name: room.name,
            type: room.roomType?._id || room.roomType,
            capacity: room.capacity,
            pricePerNight: room.pricePerNight,
            status: room.status,
            description: room.description,
            images: room.images || [],
            roomType: room.roomType,
            hotel: room.hotel
        }));

        res.status(200).json({
            success: true,
            data: transformedData,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            message: 'Rooms retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting rooms:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
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
