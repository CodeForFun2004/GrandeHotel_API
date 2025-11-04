# Check-in / Check-out Flow Guide

This guide documents the end-to-end operational flow from reservation to deposit/full payment, check-in, in-stay services, and check-out.

Conventions
- Base URL: http://localhost:1000/api
- Roles: public (no auth), customer (authenticated), staff (reception), hotel-manager, admin
- Unless stated otherwise, dates are ISO strings (YYYY-MM-DD) or ISO datetimes.

---

## 1) Create Reservation (Customer)
- url – POST `/reservations`
- purpose – Create a reservation with one or more room types and optional services; returns initial VietQR link and the required amount (deposit or full) depending on `isFullPayment`.
- role – public (currently unprotected for testing) or customer
- input
  - body
    ```json
    {
      "hotelId": "<hotelId>",
      "customerId": "<userId or null for guest>",
      "checkInDate": "2025-11-10",
      "checkOutDate": "2025-11-12",
      "numberOfGuests": 2,
      "rooms": [
        {
          "roomTypeId": "<roomTypeId>",
          "quantity": 2,
          "services": [ { "serviceId": "<serviceId>", "quantity": 1 } ]
        }
      ],
      "isFullPayment": false
    }
    ```

Notes
- The system creates one Payment document linked to the reservation with `totalPrice`, `depositAmount` (50%), and `paymentStatus` initially `unpaid`.
- The response includes a VietQR link for the required amount.

---

## 2) Approve/Cancel Reservation (Manager/Admin)
- url – PUT `/reservations/:id/approve`
- purpose – Approve a pending reservation (generates a check-in QR token) or cancel with a reason.
- role – hotel-manager | admin
- input
  - params – `id` (reservation id)
  - body
    ```json
    { "action": "approve" }
    // or
    { "action": "cancel", "reason": "Overbooked" }
    ```

---

## 3) Select Payment Option (Customer)
- url – POST `/reservations/:id/payment-options`
- purpose – Generate a VietQR link for either deposit (50%) or full payment depending on the current payment status.
- role – customer (reservation must be approved)
- input
  - params – `id`
  - body
    ```json
    { "paymentType": "deposit" }
    // or { "paymentType": "full" }
    ```

---

## 4) Verify Reservation Payment (Staff/System)
- url – PUT `/reservations/:id/payment`
- purpose – Verify the bank transaction via AppScript (Google Sheet) and update the Payment document (`deposit_paid`, `fully_paid`, etc.).
- role – staff | system job
- input
  - params – `id`
  - body – none

Notes
- The verifier looks for the reservation code (last 6 chars or full ID) in the transfer description and updates the payment summary accordingly. On deposit/full, rooms are auto-allocated (Reserved) where possible.

---

## 5) Search Reservations for Check-in (Reception)
- url – GET `/dashboard/checkin/search?query=...`
- purpose – Search approved reservations by customer name/phone, also returns payment status and high-level details.
- role – staff | hotel-manager | admin
- input
  - query – `query` (string; name or phone)

---

## 6) Get Reservation for Check-in (Reception)
- url – GET `/dashboard/checkin/:id`
- purpose – View reservation detail with room-type suggestions based on reserved or currently available rooms.
- role – staff | hotel-manager | admin
- input
  - params – `id` (reservation id)

Notes
- Check-in readiness requires: reservation.status = `approved` and payment.paymentStatus in (`deposit_paid`, `fully_paid`).

---

## 7) Confirm Check-in (Reception)
- url – POST `/dashboard/checkin/:id/confirm`
- purpose – Create a Stay, set rooms to `Occupied`, and mark reservation stayStatus to `checked_in`.
- role – staff | hotel-manager | admin
- input
  - params – `id` (reservation id)
  - body (optional; if omitted, the system auto-picks reserved rooms first and fills missing with available rooms)
    ```json
    {
      "selections": [
        { "roomTypeId": "<roomTypeId>", "roomIds": ["<roomId>", "<roomId>"] }
      ]
    }
    ```

Responses
- 200 on success with the created `stay` document
- 400 if not enough rooms are available to auto-complete a detail when selections are omitted

---

## 8) List Hotel Services for Stay (Reception)
- url – GET `/dashboard/hotels/:hotelId/services`
- purpose – List available services (and base prices) that can be added to rooms during a stay.
- role – staff | hotel-manager | admin
- input
  - params – `hotelId`

---

## 9) Add Service to a Room in Stay (Reception)
- url – POST `/dashboard/stays/:stayId/rooms/:roomId/services`
- purpose – Add/increment a service for a specific room in an active stay.
- role – staff | hotel-manager | admin
- input
  - params – `stayId`, `roomId`
  - body
    ```json
    { "serviceId": "<serviceId>", "quantity": 1 }
    ```

---

## 10) Find Stay by Room (Reception)
- url – GET `/dashboard/checkout/find-room?roomNumber=...`
- purpose – Given an occupied room, fetch the active stay and compute billing (nights, services, amount due).
- role – staff | hotel-manager | admin
- input
  - query – `roomNumber`

---

## 11) Prepare Checkout Payment (Reception)
- url – POST `/dashboard/checkout/:stayId/create-payment`
- purpose – Compute `amountDue` (nights minus deposit, plus services) and generate a VietQR link if payment is required.
- role – staff | hotel-manager | admin
- input
  - params – `stayId`
  - body (optional)
    ```json
    { "paymentMethod": "cash" }
    ```

---

## 12) Verify Checkout Payment (Reception)
- url – POST `/dashboard/checkout/:stayId/verify-payment`
- purpose – Check AppScript for a matching transaction referencing the reservation code/ID and update the Payment summary accordingly.
- role – staff | hotel-manager | admin
- input
  - params – `stayId`

---

## 13) Confirm Checkout (Reception)
- url – POST `/dashboard/checkout/:stayId/confirm`
- purpose – Mark rooms to `Cleaning`, close the stay (`Checked out`), and update the reservation stayStatus to `checked_out`. Optionally record a payment amount.
- role – staff | hotel-manager | admin
- input
  - params – `stayId`
  - body (optional)
    ```json
    { "amountPaid": 1000000, "paymentMethod": "cash" }
    ```

Notes
- If `amountPaid` is specified and the checkout is successful, we increase `paidAmount` on the Payment document and adjust `paymentStatus` (`partially_paid` → `deposit_paid` → `fully_paid`).

---

## Status Model Summary
- Reservation.status: `pending` → `approved` → (`canceled`|`rejected`) – independent from payment
- Reservation.stayStatus: `not_checked_in` → `checked_in` → `checked_out`
- Payment.paymentStatus: `unpaid` → `deposit_paid` → `fully_paid` (may be `partially_paid` during verification)
- Room.status: `Available`/`Active` → `Reserved` (after deposit/full) → `Occupied` (after check-in) → `Cleaning` (after checkout)

---

## Tips
- For payment verification, ensure the bank transfer description contains the reservation ID (full) or the last 6 characters.
- When selections are omitted at check-in, the system auto-chooses: reserved rooms first, then currently available rooms of the same room type. If not enough supply, it responds with a 400 including what’s missing.
