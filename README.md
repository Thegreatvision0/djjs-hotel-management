# DJJS Hotel — Management System (MERN)

A full rebuild of the single-file `Anand Bhawan – Hotel Management.html` prototype as a MongoDB + Express + React + Node application. It covers 3 properties (Anand Bhawan, DSB and Guest House) and 69 rooms.

## Quick start

```bash
npm run setup     # installs root, server and client dependencies
npm run dev       # API on :5050, web app on :5173
```

Open http://localhost:5173 and sign in with a demo account:

| Role         | Email                        | Password     | Access |
|--------------|------------------------------|--------------|--------|
| Admin        | admin@djjshotel.com          | admin123     | Everything |
| Front Desk   | frontdesk@djjshotel.com      | frontdesk    | Dashboard, reservations, availability, guests, rooms, billing |
| Housekeeping | housekeeping@djjshotel.com   | housekeep    | Rooms, housekeeping board |
| Restaurant   | restaurant@djjshotel.com     | restaurant   | POS |

**Database:** if `MONGO_URI` is not set, the API starts an **in-memory MongoDB** and seeds demo data. Changes are lost when the server restarts. For persistent data, copy `server/.env.example` to `server/.env` and set `MONGO_URI` (local MongoDB or Atlas). Run `npm run seed` to reset that database to the demo data.

**Production:** `npm run build` then `NODE_ENV=production npm start`. Express serves the built client and the API from one port. In production, `MONGO_URI` and `JWT_SECRET` are required.

## Project structure

```
server/src
  config/        env, db connection, business constants (served to the client via /api/meta)
  models/        User, Property, Room, Guest, Reservation (+ embedded folio), Counter,
                 Operations (HousekeepingTask, MenuItem, PosOrder, AuditLog, NightAudit)
  services/      reservationService.js — every booking rule: validation, overlap checks,
                 check-in/out, extend, room move, cancel/no-show, charges, payments, refunds
  routes/        auth, meta, dashboard, reservations, rooms, guests, billing,
                 housekeeping, pos, users, reports (+ night audit, audit trail)
  middleware/    JWT auth + role guards, error handler
  seed/          demo data (dates relative to today, so the demo always looks current)
client/src
  api/           axios client + React Query hooks
  components/    ui.jsx design-system primitives (buttons, inputs, modal, drawer, badges…)
  features/      reservations (form, drawer, lifecycle dialogs), billing (folio panel)
  pages/         Dashboard, Reservations, Availability, Guests, Rooms, Billing,
                 Housekeeping, POS, Users, Reports, Print (invoice / confirmation)
```

## Features

- **Dashboard:** occupancy, arrivals and departures, collections, pending balances, a 7-day trend chart, room status by property, and live activity.
- **Reservations:** 13 quick filters with counts, search, and sortable columns.
  - The booking form auto-fills returning guests, shows only rooms that are free for the chosen dates, previews the rate, and supports on-hold and check-in-now bookings.
  - Optional sections hold the C-Form, companions, emergency contact, and notes.
- **Booking lifecycle:**
  - Check-in handles room assignment, early-arrival date shifts, and a dirty-room confirmation.
  - Check-out covers early-departure billing (full stay, nights used, or waive) and blocks departure while a balance is outstanding unless an override reason is given.
  - Also supports extending a stay, moving rooms (upgrade, downgrade or lateral, with a rate adjustment), cancelling with a fee, and marking no-shows with a retention fee.
- **Availability:** a room-by-day timeline. Click any empty night to book it.
- **Guests:** one profile per phone number, with stay history, lifetime spend, VIP flag, and notes.
- **Rooms:** floor-by-floor grid with status changes, do-not-disturb, cleaning priority, maintenance log, stay history, a status audit log, bulk block/unblock, and admin editing of rates and amenities.
- **Billing:** in-house, pending-collection, refunds-due and advance-due worklists.
  - Folios support a charge catalogue, split payments (UPI, cash, card, bank transfer, cheque, complimentary, sponsor), discounts, tips, voids with a reason, and refunds.
  - Printable invoices include the total in words.
- **Housekeeping:** a Kanban board. Checkouts create cleaning tasks automatically, and finishing a cleaning task makes the room available again.
- **POS:** menu management and table orders. An order can be charged to an in-house guest's folio.
- **Reports:** revenue, cashier/collections, room status, in-house, arrivals, departures, property performance (occupancy and ADR), booking sources, cancellations, outstanding balances, and the guest register. Every report exports to CSV.
- **Night audit:** posts no-shows, releases expired holds, and flags overstays. It runs once per business date.
- **Activity trail:** every action is logged with the user, their role, and the time.

## What changed from the prototype

- **Persistence and security:** data was in browser memory and vanished on refresh. Now it's stored in MongoDB, protected by JWT authentication, and role checks run on the server, not only in the UI.
- **Folio integrity:** the old app stored `total` and `paid` separately from the folio lines, so they could drift apart. Now every folio line has a type (charge, discount, payment, refund or tip), and totals are always recomputed from the lines. Voids keep the original line and record who voided it and why.
- **No double charging:** the old night audit added a nightly room charge on top of the full-stay charge posted at booking. The stay is now charged once.
- **Rooms vs bookings:** a future booking no longer flips a room to "Blocked". Room status is the room's physical state, and date availability is calculated from reservations.
- **Guests:** the old app rebuilt the guest list from bookings on every keystroke. Guests are now stored records, so returning guests are matched by phone number.
- **Numbering:** confirmation, receipt, invoice and kitchen-order numbers come from database counters instead of random numbers.
- **Housekeeping and POS:** these were disabled ("SOON") in the prototype. Both are now fully working.
