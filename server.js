const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const passport = require('passport');
//git

const connectDB = require('./config/database');  // 🔧 Đường dẫn DB

dotenv.config();
connectDB();
require('./config/passport');  // import sau dotenv.config()


const userRoutes = require('./routes/user.routes')
const passwordRoutes = require('./routes/password.routes');
const reservationRoutes = require('./routes/reservationRoutes');
const roomRoutes = require('./routes/roomRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const roomTypesRoutes = require('./routes/roomTypesRoutes');


const app = express();
// Configure CORS explicitly
app.use(cors({
  origin: ['http://localhost:5173', 'http://10.0.2.2:8080', 'http://10.0.2.2'], // Allow emulator and local origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow Authorization header
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());




// users routes
// ✅ Cách đúng: Test API trả về chuỗi "Hello World"
app.get('/', (req, res) => {
  res.send('✅ Grand Hotel from Render!');
});

const authRoutes = require('./routes/auth.routes');   // authRoutes phải gọi sau .env
app.use('/api/auth', authRoutes);
app.use('/api/users',userRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/room-types', roomTypesRoutes);


const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () =>{
   console.log(`🚀 HHHHHHH Server running on http://localhost:${PORT}`)
});

