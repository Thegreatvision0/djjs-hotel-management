import { Router } from "express";
import mongoose from "mongoose";
import Reservation from "../models/Reservation.js";
import Room from "../models/Room.js";
import { allow, FRONT } from "../middleware/auth.js";
import { ah, badRequest } from "../utils/http.js";
import { todayStr, addDays, isDateStr } from "../utils/dates.js";
import { ACTIVE_RES_STATUSES } from "../config/constants.js";
import { nextInvoiceNo } from "../models/Counter.js";
import * as svc from "../services/reservationService.js";

const r = Router();
r.use(allow(...FRONT));

// Quick filters shown as chips in the UI. Each maps to a Mongo query for "today".
export function quickFilters(today = todayStr()) {
  return {
    all: {},
    duein: { checkIn: today, status: { $in: ["Confirmed", "On Hold"] } },
    dueout: { checkOut: today, status: "Checked In" },
    overstay: { checkOut: { $lt: today }, status: "Checked In" },
    arrived: { checkIn: today, status: "Checked In" },
    departed: { checkOut: today, status: "Checked Out" },
    inhouse: { status: "Checked In" },
    upcoming: { status: "Confirmed" },
    onhold: { status: "On Hold" },
    checkedout: { status: "Checked Out" },
    vip: { isVIP: true, status: { $in: ACTIVE_RES_STATUSES } },
    noshow: { status: "No Show" },
    cancelled: { status: "Cancelled" },
  };
}

const SORTS = { checkIn: "checkIn", checkOut: "checkOut", guest: "guestName", created: "createdAt", balance: "totals.balance", total: "totals.total", status: "status" };

r.get("/", ah(async (req, res) => {
  const { filter = "all", q, propertyId, roomType, from, to, sort = "checkIn", dir = "asc", guestId } = req.query;
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const query = { ...(quickFilters()[filter] || {}) };
  if (propertyId) query.property = propertyId;
  if (roomType) query.roomType = roomType;
  if (guestId) query.guest = guestId;
  const range = {};
  if (isDateStr(from)) range.$gte = from;
  if (isDateStr(to)) range.$lte = to;
  if (Object.keys(range).length) query.$and = [{ checkIn: range }];
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const rooms = await Room.find({ number: rx }).select("_id").lean();
    query.$or = [{ guestName: rx }, { guestMobile: rx }, { confirmationNo: rx }, { "group.id": rx }, { "group.name": rx }, { room: { $in: rooms.map((x) => x._id) } }];
  }
  const items = await Reservation.find(query)
    .sort({ [SORTS[sort] || "checkIn"]: dir === "desc" ? -1 : 1, _id: 1 })
    .limit(limit)
    .select("-folio -cForm -companions")
    .populate([{ path: "room", select: "number floor type" }, { path: "property", select: "code name" }])
    .lean();
  res.json({ items });
}));

r.get("/counts", ah(async (_req, res) => {
  const filters = quickFilters();
  const entries = await Promise.all(Object.entries(filters).map(async ([k, q]) => [k, await Reservation.countDocuments(q)]));
  res.json(Object.fromEntries(entries));
}));

// Timeline data: every room + bookings overlapping [from, from+days).
r.get("/availability", ah(async (req, res) => {
  const from = isDateStr(req.query.from) ? req.query.from : todayStr();
  const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 62);
  const to = addDays(from, days);
  const roomQuery = req.query.propertyId ? { property: req.query.propertyId } : {};
  if (req.query.roomType) roomQuery.type = req.query.roomType;
  const rooms = await Room.find(roomQuery).select("number floor type rate status property").populate("property", "code name sortOrder").lean();
  rooms.sort((a, b) => a.property.sortOrder - b.property.sortOrder || a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
  const bookings = await Reservation.find({
    status: { $in: [...ACTIVE_RES_STATUSES, "Checked Out"] },
    checkIn: { $lt: to },
    checkOut: { $gt: from },
    ...(req.query.propertyId ? { property: req.query.propertyId } : {}),
  }).select("guestName checkIn checkOut status room roomType property isVIP confirmationNo totals.balance").lean();
  res.json({ from, days, rooms, bookings });
}));

// Free rooms for a date range (used by booking form, check-in and room move).
r.get("/free-rooms", ah(async (req, res) => {
  const { propertyId, checkIn, checkOut, excludeId, roomType } = req.query;
  if (!propertyId || !isDateStr(checkIn) || !isDateStr(checkOut)) throw badRequest("propertyId, checkIn and checkOut are required");
  const busy = await Reservation.find({
    property: propertyId, room: { $ne: null }, status: { $in: ACTIVE_RES_STATUSES },
    checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn },
    ...(excludeId && mongoose.isValidObjectId(excludeId) ? { _id: { $ne: excludeId } } : {}),
  }).distinct("room");
  const rooms = await Room.find({
    property: propertyId, _id: { $nin: busy },
    status: { $nin: ["Maintenance", "Blocked"] },
    ...(roomType ? { type: roomType } : {}),
  }).select("number floor type rate status maxOccupancy").lean();
  rooms.sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
  res.json({ rooms });
}));

r.get("/:id", ah(async (req, res) => res.json(await svc.loadReservation(req.params.id))));

r.post("/", ah(async (req, res) => {
  const out = await svc.createReservation(req.body, req.actor);
  await req.audit(`New booking ${out.confirmationNo} for ${out.guestName} — ${out.room ? "Room " + out.room.number : out.roomType + " TBA"} · ${out.property.name} (${out.checkIn} → ${out.checkOut})`, "booking", out.confirmationNo);
  res.status(201).json(out);
}));

r.patch("/:id", ah(async (req, res) => res.json(await svc.updateReservation(req.params.id, req.body, req.actor))));

const actions = {
  "check-in": svc.checkIn,
  "check-out": svc.checkOut,
  extend: svc.extendStay,
  move: svc.moveRoom,
  cancel: svc.cancelReservation,
  "no-show": svc.markNoShow,
};
Object.entries(actions).forEach(([path, fn]) => {
  r.post(`/:id/${path}`, ah(async (req, res) => res.json(await fn(req.params.id, req.body, req.actor))));
});

// ── Folio ────────────────────────────────────────────────────────────────────
r.post("/:id/charges", ah(async (req, res) => res.json(await svc.addCharge(req.params.id, req.body, req.actor))));
r.post("/:id/payments", ah(async (req, res) => res.json(await svc.addPayment(req.params.id, req.body, req.actor))));
r.post("/:id/refunds", ah(async (req, res) => res.json(await svc.addRefund(req.params.id, req.body, req.actor))));
r.post("/:id/folio/:lineId/void", ah(async (req, res) => res.json(await svc.voidLine(req.params.id, req.params.lineId, req.body, req.actor))));

// Issues (or returns the existing) invoice number for printing.
r.post("/:id/invoice", ah(async (req, res) => {
  const resv = await Reservation.findById(req.params.id);
  if (!resv) throw badRequest("Reservation not found");
  if (!resv.invoiceNo) {
    resv.invoiceNo = await nextInvoiceNo();
    await resv.save();
    await req.audit(`Invoice ${resv.invoiceNo} issued for ${resv.guestName}`, "payment", resv.confirmationNo);
  }
  res.json(await svc.loadReservation(resv._id));
}));

export default r;
