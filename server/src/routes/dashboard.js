import { Router } from "express";
import Room from "../models/Room.js";
import Reservation from "../models/Reservation.js";
import { AuditLog, HousekeepingTask } from "../models/Operations.js";
import { allow, FRONT } from "../middleware/auth.js";
import { ah } from "../utils/http.js";
import { todayStr, addDays, enumerateDates } from "../utils/dates.js";

const r = Router();
r.use(allow(...FRONT));

r.get("/", ah(async (_req, res) => {
  const today = todayStr();
  const weekStart = addDays(today, -6);

  const [rooms, inHouse, arrivals, departures, pendingAgg, recent, openTasks, overstays] = await Promise.all([
    Room.find().select("status property").populate("property", "code name sortOrder").lean(),
    Reservation.countDocuments({ status: "Checked In" }),
    Reservation.find({ checkIn: today, status: { $in: ["Confirmed", "On Hold", "Checked In"] } })
      .select("guestName status room roomType eta isVIP confirmationNo totals.balance").populate("room", "number").sort("eta").lean(),
    Reservation.find({ checkOut: today, status: { $in: ["Checked In", "Checked Out"] } })
      .select("guestName status room etd isVIP confirmationNo totals.balance").populate("room", "number").sort("etd").lean(),
    Reservation.aggregate([{ $match: { status: { $in: ["Checked Out", "Cancelled", "No Show"] }, "totals.balance": { $gt: 0 } } }, { $group: { _id: null, sum: { $sum: "$totals.balance" }, count: { $sum: 1 } } }]),
    AuditLog.find().sort("-at").limit(12).lean(),
    HousekeepingTask.countDocuments({ status: { $ne: "Done" } }),
    Reservation.countDocuments({ status: "Checked In", checkOut: { $lt: today } }),
  ]);

  // Collections per day (payments − refunds) over the last 7 days.
  const pay = await Reservation.aggregate([
    { $unwind: "$folio" },
    { $match: { "folio.kind": { $in: ["payment", "refund"] }, "folio.voided": { $ne: true }, "folio.postedAt": { $gte: new Date(weekStart + "T00:00:00+05:30") } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$folio.postedAt", timezone: "Asia/Kolkata" } },
        amount: { $sum: { $cond: [{ $eq: ["$folio.kind", "refund"] }, { $multiply: ["$folio.amount", -1] }, "$folio.amount"] } },
      },
    },
  ]);
  const payByDay = Object.fromEntries(pay.map((p) => [p._id, p.amount]));

  // Occupied rooms per night over the last 7 days.
  const stays = await Reservation.find({ status: { $in: ["Checked In", "Checked Out"] }, checkIn: { $lte: today }, checkOut: { $gt: weekStart } }).select("checkIn checkOut").lean();
  const totalRooms = rooms.length || 1;
  const trend = enumerateDates(weekStart, 7).map((d) => {
    const occ = stays.filter((s) => s.checkIn <= d && s.checkOut > d).length;
    return { date: d, collected: Math.round(payByDay[d] || 0), occupancy: Math.round((occ / totalRooms) * 100) };
  });

  const statusCounts = {};
  const byProperty = {};
  rooms.forEach((rm) => {
    statusCounts[rm.status] = (statusCounts[rm.status] || 0) + 1;
    const key = rm.property.code;
    byProperty[key] ||= { code: key, name: rm.property.name, sortOrder: rm.property.sortOrder, total: 0, occupied: 0, available: 0 };
    byProperty[key].total++;
    if (rm.status === "Occupied") byProperty[key].occupied++;
    if (rm.status === "Available") byProperty[key].available++;
  });

  res.json({
    today,
    totalRooms: rooms.length,
    statusCounts,
    occupancyPct: Math.round(((statusCounts.Occupied || 0) / totalRooms) * 100),
    inHouse,
    overstays,
    arrivals,
    departures,
    collectedToday: Math.round(payByDay[today] || 0),
    pendingCollection: { amount: Math.round(pendingAgg[0]?.sum || 0), count: pendingAgg[0]?.count || 0 },
    openTasks,
    trend,
    properties: Object.values(byProperty).sort((a, b) => a.sortOrder - b.sortOrder),
    recent,
  });
}));

export default r;
