const express = require('express');
const router = express.Router();


const reservationController = require('../controllers/reservationController');
const { protect } = require('../middlewares/auth.middleware');


// Minimal reservation creation: selects room types and quantities only (requires auth)
router.post('/', protect, reservationController.createReservation);

router.get('/', reservationController.getAllReservations);
// Get all reservations for the current authenticated user (must be before /:id route)
router.get('/me', protect, reservationController.getUserReservations);
// Approve or cancel reservation with reason (PUT /:id/approve with body: { action: 'approve'|'cancel', reason?: 'string' })
router.put('/:id/approve', reservationController.approveReservation);
// Select payment option and generate QR code (POST /:id/payment-options with body: { paymentType: 'full'|'deposit' })
router.post('/:id/payment-options', reservationController.selectPaymentOption);
router.put('/:id/payment', reservationController.handlePayment);
router.put('/:id/status', reservationController.updateReservationStatus);

router.get('/:id', reservationController.getReservationById);
router.delete('/:id', reservationController.deleteReservation);
//git

module.exports = router;
