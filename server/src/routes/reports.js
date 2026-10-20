import { Router } from "express";
import { z } from "zod";
import Reservation from "../models/Reservation.js";
import Room from "../models/Room.js";
import Guest from "../models/Guest.js";
import { AuditLog, NightAudit } from "../models/Operations.js";
import { allow, ADMIN } from "../middleware/auth.js";
import { ah, parse, conflict, round2 } from "../utils/http.js";
import { todayStr, addDays, isDateStr, nightsBetween, enumerateDates } from "../utils/dates.js";

const r = Router();
r.use(allow(ADMIN));

const col = (key, label, type = "text") => ({ key, label, type });
const startOf = (d) => new Date(d + "T00:00:00+05:30");
const endOf = (d) => new Date(addDays(d, 1) + "T00:00:00+05:30");
const resPop = [{ path: "room", select: "number" }, { path: "property", select: "code name" }];

const REPORTS = {
  async occupancy() {
    const rooms = await Room.find().populate("property", "name sortOrder").populate("currentReservation", "guestName checkOut").lean();
    rooms.sort((a, b) => a.property.sortOrder - b.property.sortOrder || a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));
    const occ = rooms.filter((x) => x.status === "Occupied").length;
    return {
      title: "Room Status & Occupancy",
      columns: [col("room", "Room"), col("property", "Property"), col("floor", "Floor"), col("type", "Type"), col("status", "Status"), col("rate", "Rate", "money"), col("guest", "Guest"), col("until", "Until", "date")],
      rows: rooms.map((x) => ({ room: x.number, property: x.property.name, floor: x.floor === 0 ? "Ground" : x.floor, type: x.type, status: x.status, rate: x.rate, guest: x.currentReservation?.guestName || "", until: x.currentReservation?.checkOut || "" })),
      summary: [{ label: "Rooms", value: rooms.length }, { label: "Occupied", value: occ }, { label: "Occupancy", value: `${Math.round((occ / (rooms.length || 1)) * 100)}%` }],
    };
  },

  async arrivals({ from, to }) {
    const rows = await Reservation.find({ checkIn: { $gte: from, $lte: to }, status: { $nin: ["Cancelled"] } }).sort("checkIn").populate(resPop).lean();
    return {
      title: "Arrivals",
      columns: [col("conf", "Confirmation"), col("guest", "Guest"), col("mobile", "Mobile"), col("property", "Property"), col("room", "Room"), col("checkIn", "Arrival", "date"), col("nights", "Nights"), col("status", "Status"), col("balance", "Balance", "money")],
      rows: rows.map((x) => ({ conf: x.confirmationNo, guest: x.guestName, mobile: x.guestMobile, property: x.property.name, room: x.room?.number || "TBA", checkIn: x.checkIn, nights: nightsBetween(x.checkIn, x.checkOut), status: x.status, balance: x.totals.balance })),
      summary: [{ label: "Arrivals", value: rows.length }, { label: "Checked in", value: rows.filter((x) => ["Checked In", "Checked Out"].includes(x.status)).length }, { label: "No shows", value: rows.filter((x) => x.status === "No Show").length }],
    };
  },

  async departures({ from, to }) {
    const rows = await Reservation.find({ checkOut: { $gte: from, $lte: to }, status: { $in: ["Checked In", "Checked Out"] } }).sort("checkOut").populate(resPop).lean();
    return {
      title: "Departures",
      columns: [col("conf", "Confirmation"), col("guest", "Guest"), col("room", "Room"), col("checkOut", "Departure", "date"), col("status", "Status"), col("total", "Total", "money"), col("paid", "Paid", "money"), col("balance", "Balance", "money")],
      rows: rows.map((x) => ({ conf: x.confirmationNo, guest: x.guestName, room: x.room?.number || "—", checkOut: x.checkOut, status: x.status, total: x.totals.total, paid: x.totals.paid, balance: x.totals.balance })),
      summary: [{ label: "Departures", value: rows.length }, { label: "Outstanding", value: round2(rows.reduce((s, x) => s + Math.max(0, x.totals.balance), 0)), type: "money" }],
    };
  },

  async inhouse() {
    const rows = await Reservation.find({ status: "Checked In" }).sort("checkOut").populate(resPop).lean();
    return {
      title: "In-House Guests",
      columns: [col("room", "Room"), col("guest", "Guest"), col("mobile", "Mobile"), col("pax", "Pax"), col("checkIn", "Arrived", "date"), col("checkOut", "Departs", "date"), col("billTo", "Bill to"), col("balance", "Balance", "money")],
      rows: rows.map((x) => ({ room: x.room?.number, guest: x.guestName + (x.isVIP ? " ★" : ""), mobile: x.guestMobile, pax: `${x.adults}A ${x.children}C`, checkIn: x.checkIn, checkOut: x.checkOut, billTo: x.billTo, balance: x.totals.balance })),
      summary: [{ label: "In-house", value: rows.length }, { label: "Guests", value: rows.reduce((s, x) => s + x.adults + x.children, 0) }, { label: "Open balance", value: round2(rows.reduce((s, x) => s + x.totals.balance, 0)), type: "money" }],
    };
  },

  async revenue({ from, to }) {
    const lines = await Reservation.aggregate([
      { $unwind: "$folio" },
      { $match: { "folio.voided": { $ne: true }, "folio.postedAt": { $gte: startOf(from), $lt: endOf(to) } } },
      { $project: { kind: "$folio.kind", amount: "$folio.amount", dept: { $ifNull: ["$folio.department", "Other"] }, day: { $dateToString: { format: "%Y-%m-%d", date: "$folio.postedAt", timezone: "Asia/Kolkata" } } } },
    ]);
    const days = enumerateDates(from, Math.min(nightsBetween(from, to) + 1, 366));
    const rows = days.map((d) => {
      const dl = lines.filter((l) => l.day === d);
      const sum = (pred) => round2(dl.filter(pred).reduce((s, l) => s + l.amount, 0));
      const room = sum((l) => l.kind === "charge" && l.dept === "Room");
      const other = sum((l) => l.kind === "charge" && l.dept !== "Room");
      const disc = sum((l) => l.kind === "discount");
      const coll = round2(sum((l) => l.kind === "payment") - sum((l) => l.kind === "refund"));
      return { date: d, room, other, discounts: disc, net: round2(room + other - disc), collected: coll };
    });
    const tot = (k) => round2(rows.reduce((s, x) => s + x[k], 0));
    return {
      title: "Revenue by Day",
      columns: [col("date", "Date", "date"), col("room", "Room revenue", "money"), col("other", "Other charges", "money"), col("discounts", "Discounts", "money"), col("net", "Net revenue", "money"), col("collected", "Collected", "money")],
      rows,
      summary: [{ label: "Net revenue", value: tot("net"), type: "money" }, { label: "Collected", value: tot("collected"), type: "money" }, { label: "Discounts", value: tot("discounts"), type: "money" }],
      chart: { x: "date", series: ["net", "collected"] },
    };
  },

  async collections({ from, to }) {
    const lines = await Reservation.aggregate([
      { $unwind: "$folio" },
      { $match: { "folio.kind": { $in: ["payment", "refund", "tip"] }, "folio.voided": { $ne: true }, "folio.postedAt": { $gte: startOf(from), $lt: endOf(to) } } },
      { $sort: { "folio.postedAt": 1 } },
      { $project: { guestName: 1, confirmationNo: 1, f: "$folio" } },
    ]);
    const rows = lines.map((l) => ({ at: l.f.postedAt, receipt: l.f.receiptNo, guest: l.guestName, conf: l.confirmationNo, kind: l.f.kind, method: l.f.method, reference: l.f.reference || "", by: l.f.postedBy, amount: l.f.kind === "refund" ? -l.f.amount : l.f.amount }));
    const byMethod = {};
    rows.filter((x) => x.kind !== "tip").forEach((x) => { byMethod[x.method] = round2((byMethod[x.method] || 0) + x.amount); });
    return {
      title: "Cashier / Collections",
      columns: [col("at", "Time", "datetime"), col("receipt", "Receipt"), col("guest", "Guest"), col("kind", "Type"), col("method", "Method"), col("reference", "Reference"), col("by", "Collected by"), col("amount", "Amount", "money")],
      rows,
      summary: [
        { label: "Net collected", value: round2(rows.filter((x) => x.kind !== "tip").reduce((s, x) => s + x.amount, 0)), type: "money" },
        ...Object.entries(byMethod).map(([k, v]) => ({ label: k, value: v, type: "money" })),
        { label: "Tips", value: round2(rows.filter((x) => x.kind === "tip").reduce((s, x) => s + x.amount, 0)), type: "money" },
      ],
    };
  },

  async property({ from, to }) {
    const resv = await Reservation.find({ status: { $in: ["Checked In", "Checked Out"] }, checkIn: { $lte: to }, checkOut: { $gt: from } }).populate("property", "name sortOrder").lean();
    const rooms = await Room.find().populate("property", "name").lean();
    const span = nightsBetween(from, to) + 1;
    const g = {};
    rooms.forEach((rm) => { g[rm.property.name] ||= { property: rm.property.name, rooms: 0, roomNights: 0, bookings: 0, revenue: 0 }; g[rm.property.name].rooms++; });
    resv.forEach((x) => {
      const n = nightsBetween(x.checkIn > from ? x.checkIn : from, x.checkOut < addDays(to, 1) ? x.checkOut : addDays(to, 1));
      const row = g[x.property.name];
      row.bookings++;
      row.roomNights += Math.max(0, n);
      row.revenue = round2(row.revenue + Math.max(0, n) * x.rate);
    });
    const rows = Object.values(g).map((x) => ({ ...x, occupancy: `${Math.round((x.roomNights / (x.rooms * span || 1)) * 100)}%`, adr: x.roomNights ? round2(x.revenue / x.roomNights) : 0 }));
    return {
      title: "Property Performance",
      columns: [col("property", "Property"), col("rooms", "Rooms"), col("bookings", "Stays"), col("roomNights", "Room nights"), col("occupancy", "Occupancy"), col("adr", "ADR", "money"), col("revenue", "Room revenue", "money")],
      rows,
      summary: [{ label: "Room nights", value: rows.reduce((s, x) => s + x.roomNights, 0) }, { label: "Room revenue", value: round2(rows.reduce((s, x) => s + x.revenue, 0)), type: "money" }],
    };
  },

  async sources({ from, to }) {
    const agg = await Reservation.aggregate([
      { $match: { checkIn: { $gte: from, $lte: to } } },
      { $group: { _id: "$source", bookings: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $in: ["$status", ["Cancelled", "No Show"]] }, 1, 0] } }, value: { $sum: "$totals.total" } } },
      { $sort: { bookings: -1 } },
    ]);
    return {
      title: "Booking Sources",
      columns: [col("source", "Source"), col("bookings", "Bookings"), col("cancelled", "Cancelled / No-show"), col("value", "Booking value", "money")],
      rows: agg.map((a) => ({ source: a._id || "—", bookings: a.bookings, cancelled: a.cancelled, value: round2(a.value) })),
      summary: [{ label: "Bookings", value: agg.reduce((s, a) => s + a.bookings, 0) }],
    };
  },

  async cancellations({ from, to }) {
    const rows = await Reservation.find({ status: { $in: ["Cancelled", "No Show"] }, checkIn: { $gte: from, $lte: to } }).sort("checkIn").populate(resPop).lean();
    return {
      title: "Cancellations & No-Shows",
      columns: [col("conf", "Confirmation"), col("guest", "Guest"), col("status", "Status"), col("checkIn", "Arrival", "date"), col("reason", "Reason"), col("fee", "Fee retained", "money"), col("balance", "Balance", "money")],
      rows: rows.map((x) => ({ conf: x.confirmationNo, guest: x.guestName, status: x.status, checkIn: x.checkIn, reason: x.cancelReason || "", fee: x.totals.total, balance: x.totals.balance })),
      summary: [{ label: "Cancelled", value: rows.filter((x) => x.status === "Cancelled").length }, { label: "No shows", value: rows.filter((x) => x.status === "No Show").length }],
    };
  },

  async outstanding() {
    const rows = await Reservation.find({ "totals.balance": { $ne: 0 }, status: { $in: ["Checked Out", "Cancelled", "No Show"] } }).sort("checkOut").populate(resPop).lean();
    return {
      title: "Outstanding Balances & Credits",
      columns: [col("conf", "Confirmation"), col("guest", "Guest"), col("mobile", "Mobile"), col("status", "Status"), col("checkOut", "Departed", "date"), col("billTo", "Bill to"), col("override", "Override reason"), col("balance", "Balance", "money")],
      rows: rows.map((x) => ({ conf: x.confirmationNo, guest: x.guestName, mobile: x.guestMobile, status: x.status, checkOut: x.checkOut, billTo: x.billToName || x.billTo, override: x.checkoutOverride?.reason || "", balance: x.totals.balance })),
      summary: [
        { label: "Receivable", value: round2(rows.filter((x) => x.totals.balance > 0).reduce((s, x) => s + x.totals.balance, 0)), type: "money" },
        { label: "Refunds due", value: round2(-rows.filter((x) => x.totals.balance < 0).reduce((s, x) => s + x.totals.balance, 0)), type: "money" },
      ],
    };
  },

  async guests() {
    const guests = await Guest.find().sort("name").lean();
    const stats = await Reservation.aggregate([{ $match: { status: { $in: ["Checked In", "Checked Out"] } } }, { $group: { _id: "$guest", stays: { $sum: 1 }, spend: { $sum: "$totals.total" }, last: { $max: "$checkIn" } } }]);
    const by = Object.fromEntries(stats.map((s) => [String(s._id), s]));
    return {
      title: "Guest Register",
      columns: [col("name", "Guest"), col("mobile", "Mobile"), col("nationality", "Nationality"), col("id", "ID"), col("stays", "Stays"), col("last", "Last stay", "date"), col("spend", "Lifetime spend", "money")],
      rows: guests.map((g) => ({ name: g.name + (g.isVIP ? " ★" : ""), mobile: `${g.countryCode} ${g.mobile}`, nationality: g.nationality, id: `${g.idType || ""} ${g.idNumber ? "••••" + g.idNumber.slice(-4) : ""}`, stays: by[g._id]?.stays || 0, last: by[g._id]?.last || "", spend: by[g._id]?.spend || 0 })),
      summary: [{ label: "Guests", value: guests.length }],
    };
  },
};

r.get("/reports/:type", ah(async (req, res) => {
  const fn = REPORTS[req.params.type];
  if (!fn) return res.status(404).json({ message: "Unknown report" });
  const to = isDateStr(req.query.to) ? req.query.to : todayStr();
  const from = isDateStr(req.query.from) ? req.query.from : addDays(to, -29);
  res.json({ type: req.params.type, from, to, ...(await fn({ from, to })) });
}));

// ── Night audit ──────────────────────────────────────────────────────────────
async function auditPreview() {
  const today = todayStr();
  const [missedArrivals, expiredHolds, overstays, dueOut, inHouse, lastRun] = await Promise.all([
    Reservation.find({ status: { $in: ["Confirmed", "On Hold"] }, checkIn: { $lt: today } }).populate(resPop).lean(),
    Reservation.find({ status: "On Hold", holdUntil: { $lt: new Date() } }).populate(resPop).lean(),
    Reservation.find({ status: "Checked In", checkOut: { $lt: today } }).populate(resPop).lean(),
    Reservation.find({ status: "Checked In", checkOut: today }).populate(resPop).lean(),
    Reservation.countDocuments({ status: "Checked In" }),
    NightAudit.findOne().sort("-businessDate").lean(),
  ]);
  const holdsOnly = expiredHolds.filter((h) => !missedArrivals.some((m) => String(m._id) === String(h._id)));
  const pick = (x) => ({ _id: x._id, confirmationNo: x.confirmationNo, guestName: x.guestName, room: x.room?.number, property: x.property?.name, checkIn: x.checkIn, checkOut: x.checkOut, status: x.status, holdUntil: x.holdUntil, balance: x.totals.balance });
  return {
    businessDate: today,
    alreadyRun: lastRun?.businessDate === today,
    lastRun,
    inHouse,
    missedArrivals: missedArrivals.map(pick),
    expiredHolds: holdsOnly.map(pick),
    overstays: overstays.map(pick),
    dueOut: dueOut.map(pick),
  };
}

r.get("/night-audit", ah(async (_req, res) => res.json(await auditPreview())));

r.post("/night-audit", ah(async (req, res) => {
  const opts = parse(z.object({ markNoShows: z.boolean().default(true), cancelExpiredHolds: z.boolean().default(true) }), req.body || {});
  const p = await auditPreview();
  if (p.alreadyRun) throw conflict(`Night audit for ${p.businessDate} has already been run.`);
  const now = new Date();
  let noShows = 0;
  let holds = 0;
  for (const m of opts.markNoShows ? p.missedArrivals : []) {
    const res2 = await Reservation.findById(m._id);
    res2.folio.forEach((l) => { if (l.kind === "charge" && !l.voided) Object.assign(l, { voided: true, voidReason: "No show (night audit)", voidedBy: "Night Audit", voidedAt: now }); });
    res2.status = "No Show";
    res2.cancelledAt = now;
    await res2.save();
    noShows++;
  }
  for (const h of opts.cancelExpiredHolds ? p.expiredHolds : []) {
    const res2 = await Reservation.findById(h._id);
    res2.folio.forEach((l) => { if (l.kind === "charge" && !l.voided) Object.assign(l, { voided: true, voidReason: "Hold expired", voidedBy: "Night Audit", voidedAt: now }); });
    res2.status = "Cancelled";
    res2.cancelledAt = now;
    res2.cancelReason = "Hold expired (night audit)";
    await res2.save();
    holds++;
  }
  const summary = { inHouse: p.inHouse, noShows, holdsCancelled: holds, overstays: p.overstays.length, dueOut: p.dueOut.length };
  await NightAudit.create({ businessDate: p.businessDate, runBy: req.user.name, summary });
  req.audit(`Night audit ${p.businessDate}: ${noShows} no-show(s), ${holds} expired hold(s) cancelled, ${p.overstays.length} overstay(s) flagged`, "audit");
  res.json({ summary, preview: await auditPreview() });
}));

// ── Audit trail ──────────────────────────────────────────────────────────────
r.get("/audit-logs", ah(async (req, res) => {
  const q = {};
  if (req.query.type) q.type = req.query.type;
  if (req.query.q) {
    const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    q.$or = [{ action: rx }, { user: rx }];
  }
  const items = await AuditLog.find(q).sort("-at").limit(Math.min(Number(req.query.limit) || 200, 1000)).lean();
  res.json({ items });
}));

export default r;
