const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// Room Type routes
router.get('/types', roomController.getAllRoomTypes);
router.get('/types/:id', roomController.getRoomTypeById);
router.post('/types', roomController.createRoomType);
router.put('/types/:id', roomController.updateRoomType);
router.delete('/types/:id', roomController.deleteRoomType);

// Room routes
router.get('/', roomController.getAllRooms);
router.get('/:id', roomController.getRoomById);
router.post('/', roomController.createRoom);
router.put('/:id', roomController.updateRoom);
router.delete('/:id', roomController.deleteRoom);


module.exports = router;

