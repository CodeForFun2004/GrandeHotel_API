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

exports.searchHotelByLocation = async (req, res) => {
    const { location } = req.query;
    try {
        const hotels = await Hotel.find({ address: { $regex: location, $options: 'i' } });
        res.status(200).json(hotels);
    } catch (error) {
        res.status(400).json({ message: error.message });
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
