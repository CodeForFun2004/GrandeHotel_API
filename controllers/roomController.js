const RoomType = require('../models/roomTypeModel');
const Hotel = require('../models/hotelModel');
const Room = require('../models/roomModel');
const RoomActivity = require('../models/roomActivity');
const chatController = require('./chatController');
const ReservationDetail = require('../models/reservationDetailModel');
const Reservation = require('../models/reservationModel');
const mongoose = require('mongoose');
//git
//This includes CRUD operations for RoomType and Room
// ---- CRUD for RoomType ----
exports.createRoomType = async (req, res) => {
    try {
        const { name, capacity, basePrice, numberOfBeds, description, amenities, isActive } = req.body;

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

        // Check if name already exists globally (now unique across all hotels)
        const existingRoomType = await RoomType.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });

        if (existingRoomType) {
            return res.status(409).json({
                success: false,
                message: 'Room type name already exists globally'
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
            maxCapacity: capacity
        });

        await roomType.save();

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
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Search and filter
        const search = req.query.search || '';
        const isActive = req.query.isActive;

        // Build query - no hotel scoping, room types are global
        let query = {};

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
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Transform data to match frontend format
        const transformedData = roomTypes.map(rt => ({
            id: rt._id,
            name: rt.name,
            description: rt.description,
            basePrice: rt.basePrice,
            capacity: rt.capacity, // Use capacity field consistently
            numberOfBeds: rt.numberOfBeds || Math.ceil(rt.capacity / 2),
            amenities: rt.amenities || [],
            isActive: rt.isActive
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

        const roomType = await RoomType.findById(roomTypeId);

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
            capacity: roomType.capacity, // Use consistent field name
            numberOfBeds: roomType.numberOfBeds || Math.ceil(roomType.capacity / 2),
            amenities: roomType.amenities || [],
            isActive: roomType.isActive
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
        const { name, description, basePrice, maxCapacity, amenities, isActive } = req.body;

        // Find existing room type
        const existingRoomType = await RoomType.findById(roomTypeId);

        if (!existingRoomType) {
            return res.status(404).json({
                success: false,
                message: 'Room type not found'
            });
        }

        // Check if new name conflicts with existing room types globally
        if (name && name !== existingRoomType.name) {
            const nameConflict = await RoomType.findOne({
                name: { $regex: new RegExp(`^${name}$`, 'i') },
                _id: { $ne: roomTypeId }
            });

            if (nameConflict) {
                return res.status(409).json({
                    success: false,
                    message: 'Room type name already exists globally'
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
        );

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

        // Check if room type exists
        const roomType = await RoomType.findById(roomTypeId);

        if (!roomType) {
            return res.status(404).json({
                success: false,
                message: 'Room type not found'
            });
        }

        // Check if room type is being used by any rooms globally
        const roomsUsingType = await Room.countDocuments({
            roomType: roomTypeId
        });

        if (roomsUsingType > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete room type. It is being used by ${roomsUsingType} room(s) across all hotels. Please delete or reassign those rooms first.`
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

        // Check if room type exists globally (room types are now shared)
        const roomTypeExists = await RoomType.findById(roomType);

        if (!roomTypeExists) {
            return res.status(400).json({
                success: false,
                message: 'Room type not found'
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
// Similar to getAllRooms but accessible to staff role
exports.getRoomsForStaff = async (req, res) => {
    try {
        // Get staff's hotel ID
        const hotelId = req.user?.hotelId || req.user?.storeId;
        if (!hotelId) {
            return res.status(403).json({
                success: false,
                message: 'Staff hotel ID not found'
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
            .populate('roomType', 'name basePrice maxCapacity amenities capacity')
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
            hotel: room.hotel,
            roomNumber: room.roomNumber
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
        console.error('Error getting rooms for staff:', error);
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

        // If request is authenticated (manager/staff), ensure the requested room belongs to their hotel
        try {
            const userHotelId = req.user?.hotelId || req.user?.storeId;
            if (userHotelId && room.hotel) {
                const roomHotelId = (room.hotel._id || room.hotel).toString();
                if (roomHotelId !== userHotelId.toString()) {
                    return res.status(403).json({ message: 'Access denied to this room' });
                }
            }
        } catch (e) {
            // ignore and continue for public access
        }

        // Attach reservations (bookings) that reference this room so frontend can display booked ranges.
        // Find ReservationDetail entries that include this room in reservedRooms
        let bookings = [];
        try {
            const details = await ReservationDetail.find({ reservedRooms: roomId }).select('reservation').lean();
            const reservationIds = details.map(d => d.reservation).filter(Boolean);

            if (reservationIds.length > 0) {
                // Only return reservations belonging to the same hotel as the room and with active booking-like statuses
                const hotelId = room.hotel ? (room.hotel._id || room.hotel) : null;
                const query = { _id: { $in: reservationIds } };
                if (hotelId) query.hotel = hotelId;
                query.status = { $in: ['pending', 'approved', 'paid'] };

                bookings = await Reservation.find(query)
                    .populate('customer', 'fullname username email phone')
                    .populate('payment')
                    .populate({
                        path: 'details',
                        populate: [
                            { path: 'roomType', select: 'name basePrice' },
                            { path: 'reservedRooms', model: 'Room', select: 'roomNumber code status' }
                        ]
                    })
                    .sort({ checkInDate: 1 })
                    .lean();
            }
        } catch (attachErr) {
            console.warn('Failed to attach bookings to room response', attachErr);
        }

        const roomObj = room.toObject();
        roomObj.bookings = bookings; // frontend expects `bookings` or similar

        res.status(200).json(roomObj);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.updateRoom = async (req, res) => {
    const roomId = req.params.id;
    try {
        // Load current room to detect changes
        const current = await Room.findById(roomId);
        if (!current) return res.status(404).json({ message: 'Room not found' });
                // Ensure manager/staff can only update rooms of their hotel
                try {
                    const userHotelId = req.user?.hotelId || req.user?.storeId;
                    if (userHotelId && current.hotel && current.hotel.toString() !== userHotelId.toString()) {
                        return res.status(403).json({ message: 'Access denied to update this room' });
                    }
                } catch (e) {}

        // If the requester is a staff member, restrict fields to status only
        try {
            if (req.user && req.user.role === 'staff') {
                const allowed = ['status'];
                const incoming = Object.keys(req.body || {});
                const forbidden = incoming.filter(k => !allowed.includes(k));
                if (forbidden.length > 0) {
                    return res.status(403).json({ message: 'Staff chỉ được phép cập nhật trạng thái phòng' });
                }
            }
        } catch (e) {}

        const updated = await Room.findByIdAndUpdate(roomId, req.body, { new: true });
        // If status changed, create activity and emit
        if (req.body.status && req.body.status !== current.status) {
            try {
                const activity = await RoomActivity.create({
                    room: roomId,
                    user: req.user?._id,
                    type: 'status_change',
                    message: `Trạng thái: ${current.status} → ${req.body.status}`,
                    meta: { from: current.status, to: req.body.status },
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                });
                // emit event
                chatController.emit && chatController.emit('room_activity', { room: roomId, activity });
            } catch (e) {
                console.error('Failed to create room activity', e);
            }
        }
        const room = updated;
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.status(200).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Upload a single image for a room (Cloudinary via multer storage)
// @route   PUT /api/rooms/:id/images
// @access  Private (hotel manager)
exports.addRoomImage = async (req, res) => {
    const roomId = req.params.id;
    try {
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found' });

        // Ensure manager/staff can only update rooms of their hotel
        try {
            const userHotelId = req.user?.hotelId || req.user?.storeId;
            if (userHotelId && room.hotel && room.hotel.toString() !== userHotelId.toString()) {
                return res.status(403).json({ message: 'Access denied to update this room' });
            }
        } catch (e) {}

        // Expect multer middleware to have populated req.file.path with Cloudinary URL
        if (!req.file || !req.file.path) {
            return res.status(400).json({ message: 'No image file uploaded' });
        }

        // Append new image URL
        const imageUrl = req.file.path;
        room.images = room.images || [];
        room.images.push(imageUrl);
        await room.save();

        // Create activity
        try {
            const activity = await RoomActivity.create({
                room: roomId,
                user: req.user?._id,
                type: 'image_upload',
                message: `Upload ảnh cho phòng: ${imageUrl}`,
                meta: { image: imageUrl },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            chatController.emit && chatController.emit('room_activity', { room: roomId, activity });
        } catch (e) {
            console.error('Failed to create room activity for image upload', e);
        }

        const populated = await Room.findById(roomId).populate('roomType').populate('hotel');
        res.status(200).json({ message: 'Image uploaded', data: populated });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Upload multiple images for a room (Cloudinary via multer storage)
// @route   PUT /api/rooms/:id/images/batch
// @access  Private (hotel manager)
exports.addRoomImages = async (req, res) => {
    const roomId = req.params.id;
    try {
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found' });

        // Ensure manager/staff can only update rooms of their hotel
        try {
            const userHotelId = req.user?.hotelId || req.user?.storeId;
            if (userHotelId && room.hotel && room.hotel.toString() !== userHotelId.toString()) {
                return res.status(403).json({ message: 'Access denied to update this room' });
            }
        } catch (e) {}

        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ message: 'No image files uploaded' });
        }

        const uploadedUrls = req.files.map(f => f.path).filter(Boolean);
        room.images = room.images || [];
        // Append all uploaded urls
        room.images.push(...uploadedUrls);
        // Deduplicate just in case
        room.images = Array.from(new Set(room.images));
        await room.save();

        // Create a single activity summarizing batch upload
        try {
            const activity = await RoomActivity.create({
                room: roomId,
                user: req.user?._id,
                type: 'image_upload',
                message: `Upload ${uploadedUrls.length} ảnh cho phòng`,
                meta: { images: uploadedUrls },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            chatController.emit && chatController.emit('room_activity', { room: roomId, activity });
        } catch (e) {
            console.error('Failed to create room activity for image upload', e);
        }

        const populated = await Room.findById(roomId).populate('roomType').populate('hotel');
        res.status(200).json({ message: 'Images uploaded', data: populated });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a single image for a room (Cloudinary + DB)
// @route   DELETE /api/rooms/:id/images
// @access  Private (hotel manager)
exports.deleteRoomImage = async (req, res) => {
    const roomId = req.params.id;
    try {
        const { image } = req.body || {};
        if (!image) return res.status(400).json({ message: 'Missing image url to delete' });

        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found' });

        // Ensure manager can only operate within their hotel
        try {
            const userHotelId = req.user?.hotelId || req.user?.storeId;
            if (userHotelId && room.hotel && room.hotel.toString() !== userHotelId.toString()) {
                return res.status(403).json({ message: 'Access denied to update this room' });
            }
        } catch (e) {}

        room.images = room.images || [];
        const idx = room.images.findIndex((u) => u === image);
        if (idx === -1) return res.status(404).json({ message: 'Image not found on this room' });

        // Remove from array
        room.images.splice(idx, 1);
        await room.save();

        // Try to delete from Cloudinary if we can infer public_id
        try {
            const cloudinary = require('../config/cloudinary');
            // Extract filename without extension
            const match = image.match(/\/([^\/]+)\.(jpg|jpeg|png|webp)$/i);
            if (match) {
                const filename = match[1];
                // folder name should follow upload middleware: folderPrefix + '/' + sanitized room.code
                const folderName = (room.code || '').toString().trim().replace(/\s+/g, '-').toLowerCase();
                const publicId = `${'grand-hotel/rooms'}/${folderName}/${filename}`;
                try {
                    await cloudinary.uploader.destroy(publicId);
                } catch (err) {
                    console.warn('Failed to delete image from Cloudinary', err.message || err);
                }
            }
        } catch (err) {
            console.warn('Cloudinary delete skipped or failed', err.message || err);
        }

        // Create activity
        try {
            const activity = await RoomActivity.create({
                room: roomId,
                user: req.user?._id,
                type: 'image_delete',
                message: `Xóa ảnh cho phòng: ${image}`,
                meta: { image },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            chatController.emit && chatController.emit('room_activity', { room: roomId, activity });
        } catch (e) {
            console.error('Failed to create room activity for image delete', e);
        }

        const populated = await Room.findById(roomId).populate('roomType').populate('hotel');
        return res.status(200).json({ message: 'Image removed', data: populated });
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
};

exports.deleteRoom = async (req, res) => {
    const roomId = req.params.id;
    try {
                // Ensure manager/staff can only delete rooms of their hotel
                const room = await Room.findById(roomId);
                if (!room) return res.status(404).json({ message: 'Room not found' });
                try {
                    const userHotelId = req.user?.hotelId || req.user?.storeId;
                    if (userHotelId && room.hotel && room.hotel.toString() !== userHotelId.toString()) {
                        return res.status(403).json({ message: 'Access denied to delete this room' });
                    }
                } catch (e) {}
                await Room.findByIdAndDelete(roomId);
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

        // Step 1: Get only rooms that are actually Available for booking
        // We restrict to status 'Available' (case-insensitive variants supported)
        const allRooms = await Room.find({
            hotel: hotelId,
            status: { $in: ['Available', 'available'] }
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

            // New logic: show room types even if each type doesn't individually
            // satisfy numberOfRooms, as long as the total across types does.
            const num = parseInt(numberOfRooms, 10);
            let list = results.filter(r => r.available > 0);
            let totalAvailable = list.reduce((sum, r) => sum + (r.available || 0), 0);
            const meetsRequest = !isNaN(num) && num > 0 ? totalAvailable >= num : true;

            // If total meets requested rooms, keep all available types; otherwise keep the list as-is (still >0)
            // Consumers can use `meetsRequest` to decide UX.

            // paginate
            const totalCount = list.length;
            const start = (page - 1) * limit;
            const paged = list.slice(start, start + limit);

            return res.status(200).json({ results: paged, total: totalCount, page, limit, totalAvailable, meetsRequest });
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

        // Step 5: New logic – compute combined availability vs requested
        const num = parseInt(numberOfRooms, 10);
        const totalAvailable = results.reduce((sum, r) => sum + (r.available || 0), 0);
        const meetsRequest = !isNaN(num) && num > 0 ? totalAvailable >= num : true;

        // We no longer hide room types just because each individually < numberOfRooms
        const list = results; // already filtered to >0 available

        // paginate
        const totalCount = list.length;
        const start = (page - 1) * limit;
        const paged = list.slice(start, start + limit);

        res.status(200).json({ results: paged, total: totalCount, page, limit, totalAvailable, meetsRequest });

  } catch (error) {
    console.error('Error searching rooms:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.getAdminRooms = async (req, res) => {
    try {
        const rooms = await Room.find().populate('roomType').populate('hotel');
        res.status(200).json(rooms);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.createAdminRoom = async (req, res) => {
    const { roomType, hotel, roomNumber, status, description, pricePerNight } = req.body;

    try {
        // Validate roomType exists
        const roomTypeDoc = await RoomType.findById(roomType);
        if (!roomTypeDoc) {
            return res.status(404).json({ message: 'Room type not found' });
        }

        // Validate hotel exists
        const hotelDoc = await Hotel.findById(hotel);
        if (!hotelDoc) {
            return res.status(404).json({ message: 'Hotel not found' });
        }

        const room = new Room({
            roomType: roomType,
            hotel: hotel,
            roomNumber: roomNumber,
            status: status || 'available',
            pricePerNight: pricePerNight,
            description: description
        });

        await room.save();
        const populatedRoom = await Room.findById(room._id).populate('roomType').populate('hotel');

        res.status(201).json(populatedRoom);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateAdminRoom = async (req, res) => {
    const roomId = req.params.id;
    const { roomType, hotel, roomNumber, status, description, pricePerNight } = req.body;

    try {
        // Validate roomType exists if provided
        if (roomType) {
            const roomTypeDoc = await RoomType.findById(roomType);
            if (!roomTypeDoc) {
                return res.status(404).json({ message: 'Room type not found' });
            }
        }

        // Validate hotel exists if provided
        if (hotel) {
            const hotelDoc = await Hotel.findById(hotel);
            if (!hotelDoc) {
                return res.status(404).json({ message: 'Hotel not found' });
            }
        }

                // detect previous status
                const current = await Room.findById(roomId);
                // ensure admin/manager updates are hotel-scoped (if user has hotelId)
                try {
                    const userHotelId = req.user?.hotelId || req.user?.storeId;
                    if (userHotelId && current && current.hotel && current.hotel.toString() !== userHotelId.toString()) {
                        return res.status(403).json({ message: 'Access denied to update this room' });
                    }
                } catch (e) {}
        const room = await Room.findByIdAndUpdate(
            roomId,
            {
                roomType: roomType,
                hotel: hotel,
                roomNumber: roomNumber,
                status: status,
                description: description,
                pricePerNight: pricePerNight
            },
            { new: true }
        ).populate('roomType').populate('hotel');

        if (current && status && status !== current.status) {
            try {
                const activity = await RoomActivity.create({
                    room: roomId,
                    user: req.user?._id,
                    type: 'status_change',
                    message: `Trạng thái: ${current.status} → ${status}`,
                    meta: { from: current.status, to: status },
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                });
                chatController.emit && chatController.emit('room_activity', { room: roomId, activity });
            } catch (e) {
                console.error('Failed to create room activity', e);
            }
        }

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        res.status(200).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteAdminRoom = async (req, res) => {
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
