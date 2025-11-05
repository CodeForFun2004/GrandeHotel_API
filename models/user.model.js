const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  fullname: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String },
  phone: { type: String },
  avatar: { type: String },
  photoFace: { type: String },
  address: { type: String },

  cccd: { type: String },
  cmnd: { type: String },

  // ✅ Thêm các trường mới
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  birthday: {
    type: Date,
    default: null
  },
  country: {
    type: String,
    default: null
  }, 

  role: {
    type: String,
    enum: ['customer', 'admin', 'staff', 'hotel-manager'],
    default: 'customer'
  },

  isBanned: {
    type: Boolean,
    default: false
  },

  // Lý do khóa
  banReason: {
    type: String,
    default: null
  },

  // Thời gian hết hạn khóa tạm
  banExpires: {
    type: Date,
    default: null
  },

  googleId: { type: String },
  refreshToken: { type: String },

  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null
  },

  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    default: null
  }

}, { timestamps: true });

// ✅ Hash password before saving
userSchema.pre('save', async function (next) {
  try {
    if (this.isModified('password') && this.password) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
