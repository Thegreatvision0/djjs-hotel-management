import { Router } from "express";
import { z } from "zod";
import Room from "../models/Room.js";
import Reservation from "../models/Reservation.js";
import { HousekeepingTask } from "../models/Operations.js";
import { allow, ADMIN, FRONT } from "../middleware/auth.js";
import { ah, parse, badRequest, conflict, notFound } from "../utils/http.js";
import { isDateStr, todayStr } from "../utils/dates.js";
import { ROOM_STATUSES, ROOM_TYPES, PRIORITIES, AMENITIES, ACTIVE_RES_STATUSES } from "../config/constants.js";

const r = Router();
const STAFF = [...FRONT, "Housekeeping"];

async function loadRoom(id) {
  const room = await Room.findById(id).populate("property", "code name").populate("currentReservation", "guestName confirmationNo checkIn checkOut adults children isVIP totals");
  if (!room) throw notFound("Room");
  return room;
}

r.get("/", allow(...STAFF), ah(async (req, res) => {
  const q = {};
  if (req.query.propertyId) q.property = req.query.propertyId;
  if (req.query.status) q.status = req.query.status;
  const rooms = await Room.find(q)
    .select("-statusLog")
    .populate("property", "code name sortOrder")
    .populate("currentReservation", "guestName confirmationNo checkIn checkOut isVIP")
    .lean();
  // Attach the next upcoming booking for each room (for "arriving today" indicators).
  const today = todayStr();
  const upcoming = await Reservation.find({ room: { $ne: null }, status: { $in: ["Confirmed", "On Hold"] }, checkOut: { $gt: today } })
    .sort("checkIn").select("room guestName checkIn checkOut confirmationNo").lean();
  const nextByRoom = {};
  upcoming.forEach((b) => { nextByRoom[b.room] ||= b; });
  rooms.forEach((rm) => {
    rm.nextBooking = nextByRoom[rm._id] || null;
    rm.openIssues = (rm.maintenance || []).filter((m) => m.status === "Open").length;
    delete rm.maintenance;
  });
  rooms.sort((a, b) => a.property.sortOrder - b.property.sortOrder || a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
  res.json({ items: rooms });
}));

r.get("/:id", allow(...STAFF), ah(async (req, res) => {
  const room = await loadRoom(req.params.id);
  const history = await Reservation.find({ room: room._id, status: { $in: ["Checked Out", "Checked In", "Confirmed", "On Hold"] } })
    .sort("-checkIn").limit(30).select("guestName guestMobile confirmationNo checkIn checkOut status totals adults children source roomMoves").lean();
  const tasks = await HousekeepingTask.find({ room: room._id, status: { $ne: "Done" } }).sort("-createdAt").lean();
  res.json({ room, history, tasks });
}));

// Edit room master data (Admin)
r.patch("/:id", allow(ADMIN), ah(async (req, res) => {
  const input = parse(z.object({
    type: z.enum(ROOM_TYPES).optional(),
    rate: z.coerce.number().min(0).optional(),
    maxOccupancy: z.coerce.number().int().min(1).max(10).optional(),
    amenities: z.array(z.enum(AMENITIES.map((a) => a.id))).optional(),
    notes: z.string().optional(),
  }), req.body);
  const room = await Room.findById(req.params.id);
  if (!room) throw notFound("Room");
  Object.assign(room, input);
  await room.save();
  req.audit(`Room ${room.number} details updated${input.rate != null ? ` · rate ₹${input.rate}` : ""}`, "room");
  res.json(await loadRoom(room._id));
}));

r.post("/:id/status", allow(...STAFF), ah(async (req, res) => {
  const { status, note } = parse(z.object({ status: z.enum(ROOM_STATUSES), note: z.string().optional().default("") }), req.body);
  const room = await Room.findById(req.params.id);
  if (!room) throw notFound("Room");
  if (room.status === "Occupied" || status === "Occupied") throw badRequest("Occupied status is controlled by check-in / check-out.");
  if (status === "Blocked") throw badRequest("Use Block Rooms to block a room with dates and a reason.");
  room.setStatus(status, req.user.name, note);
  await room.save();
  if (status === "Available") await HousekeepingTask.updateMany({ room: room._id, status: { $ne: "Done" }, task: { $in: ["Checkout Clean", "Full Clean", "Deep Clean"] } }, { status: "Done", completedAt: new Date() });
  req.audit(`Room ${room.number} → ${status}${note ? ` — ${note}` : ""}`, "room");
  res.json(await loadRoom(room._id));
}));

r.post("/:id/dnd", allow(...STAFF), ah(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw notFound("Room");
  if (room.status !== "Occupied") throw badRequest("DND only applies to occupied rooms.");
  room.dnd = !room.dnd;
  await room.save();
  req.audit(`Room ${room.number} DND ${room.dnd ? "on" : "off"}`, "room");
  res.json(await loadRoom(room._id));
}));

r.post("/:id/cleaning-priority", allow(...STAFF), ah(async (req, res) => {
  const { priority } = parse(z.object({ priority: z.enum(PRIORITIES) }), req.body);
  const room = await Room.findByIdAndUpdate(req.params.id, { cleaningPriority: priority }, { new: true });
  if (!room) throw notFound("Room");
  res.json(await loadRoom(room._id));
}));

// ── Maintenance log ──────────────────────────────────────────────────────────
r.post("/:id/maintenance", allow(...STAFF), ah(async (req, res) => {
  const input = parse(z.object({ issue: z.string().trim().min(3), priority: z.enum(PRIORITIES).default("Normal"), assignedTo: z.string().optional(), notes: z.string().optional(), takeOutOfService: z.boolean().default(true) }), req.body);
  const room = await Room.findById(req.params.id);
  if (!room) throw notFound("Room");
  room.maintenance.unshift({ ...input, reportedBy: req.user.name });
  // An occupied room keeps its status; the issue is queued for after checkout.
  if (input.takeOutOfService && room.status !== "Occupied") room.setStatus("Maintenance", req.user.name, input.issue);
  await room.save();
  req.audit(`Maintenance logged for Room ${room.number}: ${input.issue}`, "room");
  res.json(await loadRoom(room._id));
}));

r.patch("/:id/maintenance/:logId", allow(...STAFF), ah(async (req, res) => {
  const input = parse(z.object({ status: z.enum(["Open", "Closed"]).optional(), notes: z.string().optional(), returnToService: z.boolean().default(false) }), req.body);
  const room = await Room.findById(req.params.id);
  if (!room) throw notFound("Room");
  const log = room.maintenance.id(req.params.logId);
  if (!log) throw notFound("Maintenance entry");
  if (input.notes !== undefined) log.notes = input.notes;
  if (input.status) {
    log.status = input.status;
    log.closedAt = input.status === "Closed" ? new Date() : undefined;
  }
  const stillOpen = room.maintenance.some((m) => m.status === "Open");
  if (input.returnToService && !stillOpen && room.status === "Maintenance") room.setStatus("Dirty", req.user.name, "Maintenance closed — needs cleaning");
  await room.save();
  req.audit(`Maintenance "${log.issue}" on Room ${room.number} ${log.status === "Closed" ? "closed" : "updated"}`, "room");
  res.json(await loadRoom(room._id));
}));

// ── Blocking (out of order / reserved for events) ────────────────────────────
r.post("/block", allow(...FRONT), ah(async (req, res) => {
  const input = parse(z.object({ roomIds: z.array(z.string()).min(1), from: z.string().refine(isDateStr), to: z.string().refine(isDateStr), reason: z.string().trim().min(3, "Give a reason") }), req.body);
  if (input.to < input.from) throw badRequest("Block end date must be on or after the start date.");
  const rooms = await Room.find({ _id: { $in: input.roomIds } });
  const occupied = rooms.filter((x) => x.status === "Occupied");
  if (occupied.length) throw conflict(`Cannot block occupied room(s): ${occupied.map((x) => x.number).join(", ")}`);
  const clashes = await Reservation.find({ room: { $in: input.roomIds }, status: { $in: ACTIVE_RES_STATUSES }, checkIn: { $lte: input.to }, checkOut: { $gt: input.from } }).populate("room", "number").lean();
  if (clashes.length && !req.body.force) throw conflict(`Bookings exist in this period: ${clashes.map((c) => `${c.room.number} (${c.guestName})`).join(", ")}. Move them first.`);
  for (const room of rooms) {
    room.setStatus("Blocked", req.user.name, input.reason);
    room.block = { reason: input.reason, from: input.from, to: input.to, by: req.user.name };
    await room.save();
  }
  req.audit(`Blocked ${rooms.map((x) => x.number).join(", ")} (${input.from} → ${input.to}) — ${input.reason}`, "room");
  res.json({ ok: true, count: rooms.length });
}));

r.post("/unblock", allow(...FRONT), ah(async (req, res) => {
  const { roomIds } = parse(z.object({ roomIds: z.array(z.string()).min(1) }), req.body);
  const rooms = await Room.find({ _id: { $in: roomIds }, status: "Blocked" });
  for (const room of rooms) {
    room.setStatus("Available", req.user.name, "Block released");
    await room.save();
  }
  req.audit(`Released block on ${rooms.map((x) => x.number).join(", ")}`, "room");
  res.json({ ok: true, count: rooms.length });
}));

export default r;
