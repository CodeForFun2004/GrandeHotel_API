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



const roomController = require('./controllers/roomController');
const hotelRoutes = require('./routes/hotelRoutes');
const hotelAdminRoutes = require('./routes/hotelAdminRoutes');
const managerUserRoutes = require('./routes/managerUserRoutes');
const contactRoutes = require('./routes/contact.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const chatbotRoutes = require('./routes/chatbot.routes');
const chatRoutes = require('./routes/chat.routes');
const { authenticateSocket } = require('./middlewares/socketAuth.middleware');
const { handleSocketConnection } = require('./controllers/socketController');



const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Heartbeat configuration - Server-side
  pingTimeout: 600000,     // 60 giây: thời gian chờ pong từ client
  pingInterval: 25000,    // 25 giây: khoảng cách giữa các ping
  maxHttpBufferSize: 1e8, // Tăng buffer size cho messages lớn
  cors: {
    origin: ['http://localhost:5173', 'http://10.0.2.2:8080', 'http://10.0.2.2'],
    methods: ['GET', 'POST']
  }
});
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

app.use('/api/admin/managers', managerUserRoutes);
app.use('/api/admin/hotels', hotelAdminRoutes);

app.use('/api/contacts', contactRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api', chatRoutes);

// Socket.IO authentication middleware
io.use(authenticateSocket);

// Initialize socket event handlers
handleSocketConnection(io);

// Pass io instance to chat controller for REST API real-time events
const chatController = require('./controllers/chatController');
chatController.setSocketIO(io);

const PORT = process.env.PORT || 1000;

server.listen(PORT, '0.0.0.0', () =>{
   console.log(`🚀 HHHHHHH Server running on http://localhost:${PORT}`)
});
