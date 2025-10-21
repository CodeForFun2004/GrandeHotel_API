const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// Room Type routes
router.get('/', roomController.getAllRoomTypes);
router.get('/:id', roomController.getRoomTypeById);
router.post('/', roomController.createRoomType);
router.put('/:id', roomController.updateRoomType);
router.delete('/:id', roomController.deleteRoomType);


module.exports = router;

