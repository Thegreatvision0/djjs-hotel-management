import { Router } from "express";
import Reservation from "../models/Reservation.js";
import { allow, FRONT } from "../middleware/auth.js";
import { ah } from "../utils/http.js";

const r = Router();
r.use(allow(...FRONT));

// Folio worklists:
//   open     — in-house guests (live folios)
//   pending  — checked out / cancelled / no-show with money still owed
//   credit   — guest is owed a refund (negative balance)
//   upcoming — confirmed bookings (advance collection)
r.get("/folios", ah(async (req, res) => {
  const view = req.query.view || "open";
  const queries = {
    open: { status: "Checked In" },
    pending: { status: { $in: ["Checked Out", "Cancelled", "No Show"] }, "totals.balance": { $gt: 0 } },
    credit: { "totals.balance": { $lt: 0 } },
    upcoming: { status: { $in: ["Confirmed", "On Hold"] } },
  };
  const items = await Reservation.find(queries[view] || queries.open)
    .sort(view === "pending" ? "checkOut" : "checkIn")
    .select("guestName guestMobile confirmationNo checkIn checkOut status totals room property isVIP billTo billToName roomType")
    .populate("room", "number").populate("property", "code name")
    .lean();
  const counts = Object.fromEntries(await Promise.all(Object.entries(queries).map(async ([k, q]) => [k, await Reservation.countDocuments(q)])));
  const pendingTotal = (await Reservation.aggregate([{ $match: queries.pending }, { $group: { _id: null, sum: { $sum: "$totals.balance" } } }]))[0]?.sum || 0;
  res.json({ items, counts, pendingTotal });
}));

export default r;
