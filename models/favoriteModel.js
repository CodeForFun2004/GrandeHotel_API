const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
    // User ID
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // Mỗi user chỉ có 1 favorite list
        index: true
    },
    
    // Array of hotel IDs that user has favorited
    hotels: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel'
    }]
    
}, { 
    timestamps: true 
});

// Virtual to populate hotels
favoriteSchema.virtual('hotelDetails', {
    ref: 'Hotel',
    localField: 'hotels',
    foreignField: '_id'
});

// Ensure virtual fields are included when converting to JSON
favoriteSchema.set('toJSON', { virtuals: true });
favoriteSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
