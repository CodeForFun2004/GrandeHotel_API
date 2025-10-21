const express = require('express');
const router = express.Router();

const reservationController = require('../controllers/reservationController');

// Minimal reservation creation: selects room types and quantities only
router.post('/', reservationController.createReservation);
router.get('/', reservationController.getAllReservations);
router.get('/:id', reservationController.getReservationById);
router.put('/:id/status', reservationController.updateReservationStatus);
router.delete('/:id', reservationController.deleteReservation);
//git

module.exports = router;
