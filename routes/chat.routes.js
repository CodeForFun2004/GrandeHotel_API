const express = require('express');
const router = express.Router();
const { protect, isStaff, isCustomer } = require('../middlewares/auth.middleware');
const {
  getConversations,
  getConversationById,
  sendMessage,
  markAsRead,
  togglePin,
  sendMessageFromCustomer,
  getCustomerConversation
} = require('../controllers/chatController');

// Staff routes
const staffRouter = express.Router();
staffRouter.use(protect);
staffRouter.use(isStaff);

// GET /api/staff/conversations - Lấy danh sách conversations
staffRouter.get('/conversations', getConversations);

// GET /api/staff/conversations/:threadId - Chi tiết conversation
staffRouter.get('/conversations/:threadId', getConversationById);

// POST /api/staff/conversations/:threadId/messages - Gửi tin nhắn
staffRouter.post('/conversations/:threadId/messages', sendMessage);

// PUT /api/staff/conversations/:threadId/read - Đánh dấu đã đọc
staffRouter.put('/conversations/:threadId/read', markAsRead);

// PUT /api/staff/conversations/:threadId/pin - Ghim/bỏ ghim
staffRouter.put('/conversations/:threadId/pin', togglePin);

// Customer routes
const customerRouter = express.Router();
customerRouter.use(protect);
customerRouter.use(isCustomer);

// GET /api/customer/conversations/:threadId - Xem conversation
customerRouter.get('/conversations/:threadId', getCustomerConversation);

// POST /api/customer/conversations/:threadId/messages - Gửi tin nhắn
customerRouter.post('/conversations/:threadId/messages', sendMessageFromCustomer);

// Mount sub-routers
router.use('/staff', staffRouter);
router.use('/customer', customerRouter);

module.exports = router;
