import mongoose from "mongoose";
import { HK_STATUSES, HK_TASK_TYPES, PRIORITIES, POS_ORDER_STATUSES } from "../config/constants.js";

const { ObjectId } = mongoose.Schema.Types;

// ── Housekeeping ───────────────────────────────────────────────────────────────
const hkTaskSchema = new mongoose.Schema(
  {
    room: { type: ObjectId, ref: "Room", required: true },
    task: { type: String, enum: HK_TASK_TYPES, required: true },
    assignedTo: String,
    status: { type: String, enum: HK_STATUSES, default: "Pending" },
    priority: { type: String, enum: PRIORITIES, default: "Normal" },
    note: String,
    createdBy: String,
    completedAt: Date,
  },
  { timestamps: true }
);
export const HousekeepingTask = mongoose.model("HousekeepingTask", hkTaskSchema);

// ── Restaurant POS ─────────────────────────────────────────────────────────────
const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, default: "Food" },
    price: { type: Number, required: true, min: 0 },
    veg: { type: Boolean, default: true },
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const MenuItem = mongoose.model("MenuItem", menuItemSchema);

const posOrderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, unique: true },
    table: String,
    reservation: { type: ObjectId, ref: "Reservation", default: null }, // charged to room folio
    roomLabel: String,
    guestName: String,
    items: [{ name: String, price: Number, qty: Number, _id: false }],
    total: { type: Number, required: true },
    status: { type: String, enum: POS_ORDER_STATUSES, default: "In Kitchen" },
    paymentMethod: String,
    note: String,
    createdBy: String,
  },
  { timestamps: true }
);
export const PosOrder = mongoose.model("PosOrder", posOrderSchema);

// ── Audit trail ────────────────────────────────────────────────────────────────
const auditLogSchema = new mongoose.Schema(
  {
    user: String,
    role: String,
    type: { type: String, default: "edit" }, // booking, checkin, checkout, payment, room, audit, pos, housekeeping, user, auth
    action: { type: String, required: true },
    ref: String,
  },
  { timestamps: { createdAt: "at", updatedAt: false } }
);
auditLogSchema.index({ at: -1 });
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);

// ── Night audit runs (one per business date) ──────────────────────────────────
const nightAuditSchema = new mongoose.Schema(
  {
    businessDate: { type: String, unique: true },
    runBy: String,
    summary: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);
export const NightAudit = mongoose.model("NightAudit", nightAuditSchema);
