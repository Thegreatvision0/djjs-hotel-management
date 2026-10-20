import mongoose from "mongoose";
import { ROOM_STATUSES, ROOM_TYPES, PRIORITIES } from "../config/constants.js";

const statusLogSchema = new mongoose.Schema(
  { from: String, to: String, note: String, by: String, at: { type: Date, default: Date.now } },
  { _id: false }
);

const maintenanceSchema = new mongoose.Schema(
  {
    issue: { type: String, required: true },
    priority: { type: String, enum: PRIORITIES, default: "Normal" },
    assignedTo: String,
    notes: String,
    status: { type: String, enum: ["Open", "Closed"], default: "Open" },
    reportedBy: String,
    closedAt: Date,
  },
  { timestamps: true }
);

const roomSchema = new mongoose.Schema(
  {
    number: { type: String, required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    floor: { type: Number, default: 0 },
    type: { type: String, enum: ROOM_TYPES, default: "Standard" },
    rate: { type: Number, required: true, min: 0 },
    maxOccupancy: { type: Number, default: 2 },
    amenities: [String],
    notes: String,

    // Physical / housekeeping status. Future bookings do NOT change this —
    // availability for dates is derived from reservations.
    status: { type: String, enum: ROOM_STATUSES, default: "Available" },
    currentReservation: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null },
    dnd: { type: Boolean, default: false },
    lastCleanedAt: Date,
    cleaningPriority: { type: String, enum: PRIORITIES, default: "Normal" },
    block: {
      reason: String,
      from: String,
      to: String,
      by: String,
    },
    statusLog: [statusLogSchema],
    maintenance: [maintenanceSchema],
  },
  { timestamps: true }
);

roomSchema.index({ property: 1, number: 1 }, { unique: true });

roomSchema.methods.setStatus = function (to, by, note = "") {
  if (this.status === to && !note) return;
  this.statusLog.push({ from: this.status, to, note, by });
  if (this.statusLog.length > 100) this.statusLog = this.statusLog.slice(-100);
  this.status = to;
  if (to === "Available") this.lastCleanedAt = new Date();
  if (to !== "Blocked") this.block = undefined;
};

export default mongoose.model("Room", roomSchema);
