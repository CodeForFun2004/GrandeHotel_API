const express = require('express');
const router = express.Router();

const favoriteController = require('../controllers/favoriteController');
const { protect } = require('../middlewares/auth.middleware');

// Add hotel to favorites
router.post('/', protect, favoriteController.addToFavorites);

// Get user's favorite hotels
router.get('/',protect   ,favoriteController.getUserFavorites);

// Check if specific hotel is favorited
router.get('/check/:hotelId', favoriteController.checkFavoriteStatus);

// Remove hotel from favorites
router.delete('/:hotelId', protect, favoriteController.removeFromFavorites);

module.exports = router;
