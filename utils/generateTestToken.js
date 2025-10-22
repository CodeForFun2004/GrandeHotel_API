const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const mongoose = require('mongoose');

/**
 * Generate test JWT token for manager
 * @param {string} managerEmail - Manager email
 * @returns {Promise<string>} JWT token
 */
async function generateTestToken(managerEmail = 'manager@test.com') {
  try {
    // Connect to database if not already connected
    if (mongoose.connection.readyState !== 1) {
      const connectDB = require('../config/database');
      await connectDB();
    }
    
    // Find manager user
    const manager = await User.findOne({ email: managerEmail, role: 'hotel-manager' });
    
    if (!manager) {
      throw new Error('Manager not found. Please run seed script first.');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: manager._id,
        role: manager.role,
        hotelId: manager.hotelId,
        email: manager.email
      },
      process.env.ACCESS_TOKEN_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    return token;
    
  } catch (error) {
    console.error('Error generating test token:', error.message);
    throw error;
  }
}

/**
 * Generate test token and print it
 */
async function printTestToken() {
  try {
    const token = await generateTestToken();
    console.log('\n🔑 Test Manager JWT Token:');
    console.log('='.repeat(50));
    console.log(token);
    console.log('='.repeat(50));
    console.log('\n📝 Use this token in your API requests:');
    console.log('Authorization: Bearer ' + token);
    console.log('\n⚠️  Note: This token expires in 24 hours');
    
  } catch (error) {
    console.error('❌ Failed to generate test token:', error.message);
    console.log('\n💡 Make sure to:');
    console.log('1. Run the seed script first: node seeds/seed-manager-data.js');
    console.log('2. Set ACCESS_TOKEN_SECRET in your .env file');
  }
}

// Run if this file is executed directly
if (require.main === module) {
  printTestToken();
}

module.exports = { generateTestToken, printTestToken };
