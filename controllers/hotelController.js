const Hotel = require('../models/hotelModel');
const RoomType = require('../models/roomTypeModel');
const Service = require('../models/serviceModel');
const Room = require('../models/roomModel');


//This includes CRUD operations for Hotel and Service
// ---- CRUD for Hotel ----
exports.createHotel = async (req, res) => {
    const { name, address, description, email, phone, manager, status, images } = req.body;
    try {
        const hotel = new Hotel({
            name,
            address,
            description,
            email,
            phone,
            manager,
            status,
            images
        });
        await hotel.save();
        res.status(201).json(hotel);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getAllHotels = async (req, res) => {
    try {
        // support pagination via ?page=1&limit=20 (both optional)
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 20, 1);

        // compute total count
        const total = await Hotel.countDocuments();

        // fetch paged hotels
        const hotels = await Hotel.find()
            .skip((page - 1) * limit)
            .limit(limit);

        // compute min price per hotel from Room collection (for the hotels on this page)
        const hotelIds = hotels.map(h => h._id);
        const mins = await Room.aggregate([
            { $match: { hotel: { $in: hotelIds } } },
            { $group: { _id: '$hotel', minPrice: { $min: { $toDouble: '$pricePerNight' } } } }
        ]);
        const minMap = mins.reduce((acc, cur) => { acc[cur._id.toString()] = cur.minPrice; return acc; }, {});

        const results = hotels.map(h => ({
            ...h.toObject(),
            minPricePerNight: minMap[h._id.toString()] ?? undefined,
        }));

        res.status(200).json({ results, total, page, limit });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
//git

exports.getHotelById = async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id);
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }
        res.status(200).json(hotel);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }   
};

exports.updateHotel = async (req, res) => {
    try {
        const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }
        res.status(200).json(hotel);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }   
};

exports.deleteHotel = async (req, res) => {
    try {
        const hotel = await Hotel.findByIdAndDelete(req.params.id);
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found' });
        }
        res.status(200).json({ message: 'Hotel deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.searchHotelsByLocation = async (req, res) => {
  try {
        const { city, checkInDate, checkOutDate } = req.query;

        if (!city) {
            return res.status(400).json({ message: 'City is required.' });
        }

        // pagination for search results
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 20, 1);

        // find matching hotels
        const filter = { address: new RegExp(city, 'i') };
        const total = await Hotel.countDocuments(filter);

        const hotels = await Hotel.find(filter)
            .skip((page - 1) * limit)
            .limit(limit);

        // get min price for these hotels in one aggregation
        const hotelIds = hotels.map(h => h._id);
        const mins = await Room.aggregate([
            { $match: { hotel: { $in: hotelIds } } },
            { $group: { _id: '$hotel', minPrice: { $min: { $toDouble: '$pricePerNight' } } } }
        ]);
        const minMap = mins.reduce((acc, cur) => { acc[cur._id.toString()] = cur.minPrice; return acc; }, {});

        // For each hotel, count available rooms (status = 'available')
        const results = await Promise.all(hotels.map(async (hotel) => {
            const availableRooms = await Room.find({ hotel: hotel._id, status: 'available' }).countDocuments();

            return {
                hotelId: hotel._id,
                name: hotel.name,
                address: hotel.address,
                city: hotel.city,
                rating: hotel.rating,
                totalAvailableRooms: availableRooms,
                minPricePerNight: minMap[hotel._id.toString()] ?? undefined,
                images: hotel.images || [],
            };
        }));

        res.status(200).json({ results, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---- CRUD for Service ----
exports.createService = async (req, res) => {
    const { hotel, name, description, basePrice, images } = req.body;
    try {
        const service = new Service({
            hotel,
            name,
            description,
            basePrice,
            images
        });
        await service.save();
        res.status(201).json(service);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getAllServices = async (req, res) => {
    const hotelId = req.params.hotelId;
    try {
        const services = await Service.find({ hotel: hotelId });
        res.status(200).json(services);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getServiceById = async (req, res) => {
    const serviceId = req.params.id;
    try {
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }   
        res.status(200).json(service);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.updateService = async (req, res) => {
    const serviceId = req.params.id;
    try {
        const service = await Service.findByIdAndUpdate(serviceId, req.body, { new: true });
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }
        res.status(200).json(service);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.deleteService = async (req, res) => {
    const serviceId = req.params.id;
    try {
        const service = await Service.findByIdAndDelete(serviceId);
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }
        res.status(200).json({ message: 'Service deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
