const express = require('express');
const router = express.Router();
const {
  getAllManagers,
  getManagerById,
  createManager,
  updateManager,
  deleteManager
} = require('../controllers/managerUserController');

const { protect, isAdmin } = require('../middlewares/auth.middleware');

// All routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// GET /api/admin/managers - Get all managers
router.get('/', getAllManagers);

// GET /api/admin/managers/:id - Get manager by ID
router.get('/:id', getManagerById);

// POST /api/admin/managers - Create new manager
router.post('/', createManager);

// PUT /api/admin/managers/:id - Update manager
router.put('/:id', updateManager);

// DELETE /api/admin/managers/:id - Delete manager
router.delete('/:id', deleteManager);

module.exports = router;
