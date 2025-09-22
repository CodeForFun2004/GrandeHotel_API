// utils/generateBookingNumber.js
const generateBookingNumber = () => {
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `ORD-${randomStr}`;
  };
  
  module.exports = generateBookingNumber;
  