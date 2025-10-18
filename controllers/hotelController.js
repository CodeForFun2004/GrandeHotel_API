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
        const hotels = await Hotel.find();  
        res.status(200).json(hotels);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

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

    if (!city || !checkInDate || !checkOutDate) {
      return res.status(400).json({ message: 'City, checkInDate, and checkOutDate are required.' });
    }

    const hotels = await Hotel.find({ city: new RegExp(city, 'i') });

    // For each hotel, you can use your room + reservation logic to count available rooms
    const results = await Promise.all(hotels.map(async (hotel) => {
      const availableRooms = await Room.find({
        hotel: hotel._id,
        status: 'available'
      }).countDocuments();

      const minPriceRoom = await Room.findOne({ hotel: hotel._id }).sort({ pricePerNight: 1 });
      return {
        hotelId: hotel._id,
        name: hotel.name,
        address: hotel.address,
        city: hotel.city,
        rating: hotel.rating,
        totalAvailableRooms: availableRooms,
        minPricePerNight: minPriceRoom ? minPriceRoom.pricePerNight : hotel.basePrice,
      };
    }));

    res.status(200).json(results);
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
