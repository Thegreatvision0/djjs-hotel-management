import mongoose from "mongoose";
import { RES_STATUSES, ROOM_TYPES, BILL_TO } from "../config/constants.js";
import { nightsBetween } from "../utils/dates.js";
import { round2 } from "../utils/http.js";

const { ObjectId } = mongoose.Schema.Types;

// Folio line. Amounts are always positive; `kind` decides the sign:
//   charge, refund      → increase what the guest owes
//   discount, payment   → decrease it
//   tip                 → recorded separately, never affects the balance
const folioSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["charge", "discount", "payment", "refund", "tip"], required: true },
    code: String, // ROOM, EXT, RC001…, PAY
    department: String,
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: Number,
    amount: { type: Number, required: true, min: 0 },
    chargeDate: String,
    method: String, // payment / refund / tip method
    reference: String,
    receiptNo: String,
    postedBy: String,
    voided: { type: Boolean, default: false },
    voidReason: String,
    voidedBy: String,
    voidedAt: Date,
  },
  { timestamps: { createdAt: "postedAt", updatedAt: false } }
);

const roomMoveSchema = new mongoose.Schema(
  {
    fromRoom: String,
    toRoom: String,
    moveType: { type: String, enum: ["Upgrade", "Downgrade", "Lateral Move"] },
    rateAdjust: Number,
    reason: String,
    authorizedBy: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reservationSchema = new mongoose.Schema(
  {
    confirmationNo: { type: String, unique: true },
    guest: { type: ObjectId, ref: "Guest", required: true },
    guestName: { type: String, required: true }, // snapshot for fast lists
    guestMobile: String,

    property: { type: ObjectId, ref: "Property", required: true },
    room: { type: ObjectId, ref: "Room", default: null }, // null = room TBA
    roomType: { type: String, enum: ROOM_TYPES, default: "Standard" },
    rate: { type: Number, required: true }, // nightly rate locked at booking

    checkIn: { type: String, required: true }, // YYYY-MM-DD
    checkOut: { type: String, required: true },
    eta: { type: String, default: "14:00" },
    etd: { type: String, default: "11:00" },
    status: { type: String, enum: RES_STATUSES, default: "Confirmed" },
    holdUntil: Date,

    adults: { type: Number, default: 1, min: 1 },
    children: { type: Number, default: 0, min: 0 },
    companions: [{ name: String, relation: String, age: Number, _id: false }],

    source: { type: String, default: "Walk-in" },
    reference: String,
    purpose: String,
    billTo: { type: String, enum: BILL_TO, default: "Guest" },
    billToName: String,
    isVIP: { type: Boolean, default: false },
    group: { id: String, name: String },
    earlyCheckIn: { requested: Boolean, time: String },
    lateCheckOut: { requested: Boolean, time: String },
    specialRequests: String,
    internalNotes: String,
    emergencyContact: { name: String, relation: String, phone: String },
    cForm: { visaType: String, visaNo: String, visaValidUntil: String, visaIssuePlace: String, arrivalDate: String, nextDestination: String },

    folio: [folioSchema],
    totals: {
      charges: { type: Number, default: 0 },
      discounts: { type: Number, default: 0 },
      payments: { type: Number, default: 0 },
      refunds: { type: Number, default: 0 },
      tips: { type: Number, default: 0 },
      total: { type: Number, default: 0 }, // charges − discounts
      paid: { type: Number, default: 0 }, // payments − refunds
      balance: { type: Number, default: 0 }, // total − paid (negative = credit owed to guest)
    },

    roomMoves: [roomMoveSchema],
    checkInAt: Date,
    checkOutAt: Date,
    originalCheckIn: String, // set when an early arrival shifts the check-in date
    originalCheckOut: String, // set when departure date changes (early checkout / extension)
    cancelledAt: Date,
    cancelReason: String,
    checkoutOverride: { reason: String, note: String, by: String, balance: Number },
    invoiceNo: String,
    createdBy: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

reservationSchema.index({ status: 1, checkIn: 1 });
reservationSchema.index({ room: 1, checkIn: 1, checkOut: 1 });
reservationSchema.index({ guest: 1 });
reservationSchema.index({ guestName: "text", confirmationNo: "text" });

reservationSchema.virtual("nights").get(function () {
  return Math.max(1, nightsBetween(this.checkIn, this.checkOut));
});

reservationSchema.methods.recalc = function () {
  const sum = (kind) => round2(this.folio.filter((f) => f.kind === kind && !f.voided).reduce((s, f) => s + f.amount, 0));
  const t = {
    charges: sum("charge"),
    discounts: sum("discount"),
    payments: sum("payment"),
    refunds: sum("refund"),
    tips: sum("tip"),
  };
  t.total = round2(t.charges - t.discounts);
  t.paid = round2(t.payments - t.refunds);
  t.balance = round2(t.total - t.paid);
  this.totals = t;
  return t;
};

reservationSchema.methods.roomChargeLines = function () {
  return this.folio.filter((f) => f.kind === "charge" && f.code === "ROOM" && !f.voided);
};

reservationSchema.pre("validate", function (next) {
  this.recalc();
  next();
});

export default mongoose.model("Reservation", reservationSchema);
