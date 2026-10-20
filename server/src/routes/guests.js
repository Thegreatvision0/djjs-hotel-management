import { Router } from "express";
import { z } from "zod";
import Guest from "../models/Guest.js";
import Reservation from "../models/Reservation.js";
import { allow, FRONT } from "../middleware/auth.js";
import { ah, parse, notFound } from "../utils/http.js";

const r = Router();
r.use(allow(...FRONT));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Directory with stay statistics. ?q= matches name prefix or phone digits.
r.get("/", ah(async (req, res) => {
  const q = (req.query.q || "").trim();
  const match = {};
  if (q) {
    const digits = q.replace(/\D/g, "");
    match.$or = [{ name: new RegExp("^" + esc(q), "i") }, { name: new RegExp("\\b" + esc(q), "i") }];
    if (digits.length >= 3) match.$or.push({ mobile: new RegExp(esc(digits)) });
  }
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const guests = await Guest.find(match).sort({ updatedAt: -1 }).limit(limit).lean();
  const stats = await Reservation.aggregate([
    { $match: { guest: { $in: guests.map((g) => g._id) } } },
    {
      $group: {
        _id: "$guest",
        stays: { $sum: { $cond: [{ $in: ["$status", ["Checked Out", "Checked In"]] }, 1, 0] } },
        bookings: { $sum: 1 },
        spend: { $sum: { $cond: [{ $in: ["$status", ["Checked Out", "Checked In"]] }, "$totals.total", 0] } },
        outstanding: { $sum: { $cond: [{ $gt: ["$totals.balance", 0] }, "$totals.balance", 0] } },
        lastStay: { $max: "$checkIn" },
        inHouse: { $max: { $cond: [{ $eq: ["$status", "Checked In"] }, 1, 0] } },
        noShows: { $sum: { $cond: [{ $eq: ["$status", "No Show"] }, 1, 0] } },
      },
    },
  ]);
  const byId = Object.fromEntries(stats.map((s) => [String(s._id), s]));
  res.json({ items: guests.map((g) => ({ ...g, stats: byId[String(g._id)] || { stays: 0, bookings: 0, spend: 0, outstanding: 0 } })) });
}));

r.get("/:id", ah(async (req, res) => {
  const guest = await Guest.findById(req.params.id).lean();
  if (!guest) throw notFound("Guest");
  const stays = await Reservation.find({ guest: guest._id }).sort("-checkIn").select("-folio").populate("room", "number").populate("property", "code name").lean();
  res.json({ guest, stays });
}));

r.patch("/:id", ah(async (req, res) => {
  const input = parse(z.object({ isVIP: z.boolean().optional(), notes: z.string().optional(), email: z.string().email().or(z.literal("")).optional(), address: z.string().optional() }), req.body);
  const guest = await Guest.findByIdAndUpdate(req.params.id, input, { new: true });
  if (!guest) throw notFound("Guest");
  req.audit(`Guest profile updated: ${guest.name}`, "booking");
  res.json(guest);
}));

export default r;
