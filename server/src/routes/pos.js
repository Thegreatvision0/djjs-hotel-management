import { Router } from "express";
import { z } from "zod";
import { MenuItem, PosOrder } from "../models/Operations.js";
import Reservation from "../models/Reservation.js";
import { nextOrderNo } from "../models/Counter.js";
import { allow } from "../middleware/auth.js";
import { ah, parse, badRequest, notFound, round2, inr } from "../utils/http.js";
import { todayStr } from "../utils/dates.js";
import { PAYMENT_METHODS, POS_ORDER_STATUSES } from "../config/constants.js";

const r = Router();
r.use(allow("Admin", "Restaurant"));

// ── Menu ─────────────────────────────────────────────────────────────────────
r.get("/menu", ah(async (_req, res) => res.json({ items: await MenuItem.find().sort("category name").lean() })));

const menuSchema = z.object({ name: z.string().trim().min(2), category: z.string().trim().min(2), price: z.coerce.number().min(0), veg: z.boolean().default(true), available: z.boolean().default(true) });

r.post("/menu", ah(async (req, res) => {
  const item = await MenuItem.create(parse(menuSchema, req.body));
  req.audit(`Menu item added: ${item.name} ${inr(item.price)}`, "pos");
  res.status(201).json(item);
}));
r.patch("/menu/:id", ah(async (req, res) => {
  const item = await MenuItem.findByIdAndUpdate(req.params.id, parse(menuSchema.partial(), req.body), { new: true });
  if (!item) throw notFound("Menu item");
  res.json(item);
}));

// ── In-house guests that can be charged to their room ───────────────────────
r.get("/in-house", ah(async (_req, res) => {
  const items = await Reservation.find({ status: "Checked In" }).select("guestName room confirmationNo").populate("room", "number").sort("guestName").lean();
  res.json({ items });
}));

// ── Orders ───────────────────────────────────────────────────────────────────
r.get("/orders", ah(async (req, res) => {
  const q = req.query.status ? { status: req.query.status } : {};
  const items = await PosOrder.find(q).sort("-createdAt").limit(200).lean();
  res.json({ items });
}));

r.post("/orders", ah(async (req, res) => {
  const input = parse(z.object({
    table: z.string().trim().optional().default(""),
    reservationId: z.string().optional().nullable(),
    items: z.array(z.object({ menuItemId: z.string(), qty: z.coerce.number().int().min(1) })).min(1, "Add at least one item"),
    note: z.string().optional().default(""),
  }), req.body);
  if (!input.table && !input.reservationId) throw badRequest("Choose a table or an in-house guest.");
  const menu = await MenuItem.find({ _id: { $in: input.items.map((i) => i.menuItemId) } }).lean();
  const items = input.items.map((i) => {
    const m = menu.find((x) => String(x._id) === i.menuItemId);
    if (!m || !m.available) throw badRequest("An item in the order is unavailable.");
    return { name: m.name, price: m.price, qty: i.qty };
  });
  const total = round2(items.reduce((s, i) => s + i.price * i.qty, 0));

  let resv = null;
  if (input.reservationId) {
    resv = await Reservation.findById(input.reservationId).populate("room", "number");
    if (!resv || resv.status !== "Checked In") throw badRequest("Room charges can only go to in-house guests.");
  }
  const order = await PosOrder.create({
    orderNo: await nextOrderNo(), table: input.table, reservation: resv?._id || null, roomLabel: resv?.room?.number,
    guestName: resv?.guestName, items, total, note: input.note, createdBy: req.user.name,
  });
  if (resv) {
    resv.folio.push({
      kind: "charge", code: input.table ? "FB001" : "FB002", department: "F&B",
      description: `${input.table ? "Restaurant" : "Room Service"} · ${order.orderNo} (${items.map((i) => `${i.qty}× ${i.name}`).join(", ")})`,
      amount: total, chargeDate: todayStr(), postedBy: req.user.name,
    });
    await resv.save();
  }
  req.audit(`POS ${order.orderNo} ${inr(total)}${resv ? ` → Room ${resv.room?.number} (${resv.guestName})` : ` · Table ${input.table}`}`, "pos");
  res.status(201).json(order);
}));

r.patch("/orders/:id", ah(async (req, res) => {
  const input = parse(z.object({ status: z.enum(POS_ORDER_STATUSES), paymentMethod: z.enum(PAYMENT_METHODS.map((m) => m.id)).optional() }), req.body);
  const order = await PosOrder.findById(req.params.id);
  if (!order) throw notFound("Order");
  if (input.status === "Settled" && !order.reservation && !input.paymentMethod) throw badRequest("Choose how the table paid.");
  if (input.status === "Cancelled" && order.reservation) throw badRequest("Room-charged orders must be voided from the guest folio.");
  Object.assign(order, input);
  await order.save();
  req.audit(`POS ${order.orderNo} → ${order.status}${input.paymentMethod ? ` (${input.paymentMethod})` : ""}`, "pos");
  res.json(order);
}));

export default r;
