const Favorite = require('../models/favoriteModel');
const Hotel = require('../models/hotelModel');

// [1] THÊM HOTEL VÀO FAVORITES
exports.addToFavorites = async (req, res) => {
    try {
        const userId = req.user.id; // Get userId from authenticated user
        const { hotelId } = req.body;

        // Check if hotel exists
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({ message: 'Hotel not found.' });
        }

        // Find or create user's favorite list
        let favorite = await Favorite.findOne({ user: userId });
        
        if (!favorite) {
            // Create new favorite list for user
            favorite = await Favorite.create({
                user: userId,
                hotels: [hotelId]
            });
        } else {
            // Check if hotel already in favorites
            if (favorite.hotels.includes(hotelId)) {
                return res.status(400).json({ message: 'Hotel is already in your favorites.' });
            }
            
            // Add hotel to favorites
            favorite.hotels.push(hotelId);
            await favorite.save();
        }

        return res.status(201).json({
            message: 'Hotel added to favorites successfully.',
            favorite
        });

    } catch (error) {
        console.error('Error adding to favorites:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [2] XÓA HOTEL KHỎI FAVORITES
exports.removeFromFavorites = async (req, res) => {
    try {
        const userId = req.user.id;
        const { hotelId } = req.params;

        const favorite = await Favorite.findOne({ user: userId });
        
        if (!favorite) {
            return res.status(404).json({ message: 'No favorites found for this user.' });
        }

        // Check if hotel is in favorites
        const hotelIndex = favorite.hotels.indexOf(hotelId);
        if (hotelIndex === -1) {
            return res.status(404).json({ message: 'Hotel not found in favorites.' });
        }

        // Remove hotel from favorites
        favorite.hotels.splice(hotelIndex, 1);
        await favorite.save();

        return res.status(200).json({
            message: 'Hotel removed from favorites successfully.',
            favorite
        });

    } catch (error) {
        console.error('Error removing from favorites:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [3] LẤY TẤT CẢ FAVORITES CỦA USER
exports.getUserFavorites = async (req, res) => {
    try {
        const userId = req.user.id;

        const favorite = await Favorite.findOne({ user: userId })
            .populate('user', 'name email')
            .populate('hotels', 'name address description images');

        if (!favorite) {
            return res.status(200).json({
                message: 'No favorites found.',
                favorite: null,
                hotels: []
            });
        }

        return res.status(200).json({
            message: 'Favorites retrieved successfully.',
            favorite,
            hotels: favorite.hotels
        });

    } catch (error) {
        console.error('Error retrieving favorites:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

// [4] KIỂM TRA XEM HOTEL CÓ TRONG FAVORITES KHÔNG
exports.checkFavoriteStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { hotelId } = req.params;

        const favorite = await Favorite.findOne({ user: userId });
        
        if (!favorite) {
            return res.status(200).json({
                isFavorited: false,
                favorite: null
            });
        }

        const isFavorited = favorite.hotels.includes(hotelId);

        return res.status(200).json({
            isFavorited: isFavorited,
            favorite: favorite
        });

    } catch (error) {
        console.error('Error checking favorite status:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};
