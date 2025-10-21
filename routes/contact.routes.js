const express = require('express');
const router = express.Router();
const {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  getContactsStats
} = require('../controllers/contactController');

// Middleware imports (giả sử bạn có)
const { protect, isAdmin } = require('../middlewares/auth.middleware');


// Public routes
router.post('/', createContact);

// Protected routes (Admin only)
router.get('/', protect, getContacts);
router.get('/stats', protect, getContactsStats);

router.route('/:id')
  .get(isAdmin, getContactById)
  .put(isAdmin, updateContact)
  .delete(isAdmin, deleteContact);

module.exports = router;
