import { z } from "zod";
import Reservation from "../models/Reservation.js";
import Room from "../models/Room.js";
import Guest from "../models/Guest.js";
import Property from "../models/Property.js";
import { HousekeepingTask } from "../models/Operations.js";
import { nextConfirmationNo, nextReceiptNo } from "../models/Counter.js";
import {
  COUNTRY_CODES, ID_TYPES, ACTIVE_RES_STATUSES, BOOKING_SOURCES, PURPOSES, BILL_TO,
  ROOM_TYPES, PAYMENT_METHODS, CHARGE_CATALOG, CHECKOUT_OVERRIDE_REASONS,
} from "../config/constants.js";
import { todayStr, nowHHMM, nightsBetween, rangesOverlap, isDateStr, addDays } from "../utils/dates.js";
import { badRequest, conflict, notFound, forbidden, parse, round2, inr } from "../utils/http.js";

// ── Population helper ─────────────────────────────────────────────────────────
export const RES_POPULATE = [
  { path: "room", select: "number floor type rate status" },
  { path: "property", select: "code name" },
  { path: "guest" },
];

export async function loadReservation(id) {
  const res = await Reservation.findById(id).populate(RES_POPULATE);
  if (!res) throw notFound("Reservation");
  return res;
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const dateStr = z.string().refine(isDateStr, "must be a date (YYYY-MM-DD)");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "must be HH:MM");
const optStr = z.string().trim().optional().default("");

const guestInput = z.object({
  name: z.string().trim().min(2, "Guest name is required"),
  countryCode: z.string().default("+91"),
  mobile: z.string().trim().min(1, "Mobile number is required"),
  email: z.string().trim().email("Email looks invalid").optional().or(z.literal("")),
  dob: optStr,
  gender: optStr,
  address: optStr,
  nationality: z.string().default("Indian"),
  idType: z.enum(ID_TYPES.map((t) => t.id)),
  idNumber: z.string().trim().min(1, "ID number is required"),
});

const stayFields = {
  propertyId: z.string().min(1, "Property is required"),
  roomId: z.string().optional().nullable(),
  roomType: z.enum(ROOM_TYPES).default("Standard"),
  checkIn: dateStr,
  checkOut: dateStr,
  eta: timeStr.default("14:00"),
  etd: timeStr.default("11:00"),
  holdUntil: z.string().optional().nullable(),
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
  companions: z.array(z.object({ name: z.string().trim(), relation: optStr, age: z.coerce.number().optional() })).default([]),
  source: z.enum(BOOKING_SOURCES).default("Walk-in"),
  reference: optStr,
  purpose: z.enum(["", ...PURPOSES]).optional().default(""),
  billTo: z.enum(BILL_TO).default("Guest"),
  billToName: optStr,
  isVIP: z.boolean().default(false),
  group: z.object({ id: optStr, name: optStr }).default({}),
  earlyCheckIn: z.object({ requested: z.boolean().default(false), time: optStr }).default({}),
  lateCheckOut: z.object({ requested: z.boolean().default(false), time: optStr }).default({}),
  specialRequests: optStr,
  internalNotes: optStr,
  emergencyContact: z.object({ name: optStr, relation: optStr, phone: optStr }).default({}),
  cForm: z.record(z.string()).default({}),
};

export const createSchema = z.object({
  guest: guestInput,
  ...stayFields,
  status: z.enum(["Confirmed", "On Hold", "Checked In"]).default("Confirmed"),
  advance: z
    .object({ amount: z.coerce.number().min(0).default(0), method: z.string().default("Cash"), reference: optStr })
    .optional(),
});

export const updateSchema = z.object({ guest: guestInput.partial().optional(), ...stayFields, status: z.enum(["Confirmed", "On Hold"]).optional() }).partial();

// ── Validation helpers ────────────────────────────────────────────────────────
function validateGuest(g) {
  const digits = g.mobile.replace(/\D/g, "");
  const rule = COUNTRY_CODES.find((c) => c.code === g.countryCode);
  if (rule && digits.length !== rule.digits) throw badRequest(`Mobile for ${rule.country} must be exactly ${rule.digits} digits (got ${digits.length}).`);
  const idRule = ID_TYPES.find((t) => t.id === g.idType);
  const idVal = g.idNumber.trim().toUpperCase();
  if (idRule && !new RegExp(idRule.pattern).test(idVal)) throw badRequest(`${g.idType} number format is invalid (expected ${idRule.hint}).`);
  if (g.dob) {
    if (!isDateStr(g.dob) || g.dob >= todayStr()) throw badRequest("Date of birth must be a past date.");
    if (nightsBetween(g.dob, todayStr()) / 365.25 > 120) throw badRequest("Date of birth gives an age over 120 — please verify.");
  }
  return { ...g, mobile: digits, idNumber: idVal };
}

function validateStay({ checkIn, checkOut, etd }, { allowPastCheckIn = false } = {}) {
  if (checkOut <= checkIn) throw badRequest("Check-out must be after check-in.");
  if (!allowPastCheckIn && checkIn < todayStr()) throw badRequest("Check-in date cannot be in the past.");
  if (nightsBetween(checkIn, checkOut) > 90) throw badRequest("Stays longer than 90 nights must be split into separate bookings.");
  if (etd && Number(etd.split(":")[0]) < 6) throw badRequest("ETD is before 06:00 — please verify the departure time.");
}

export async function upsertGuest(input) {
  const g = validateGuest(input);
  const existing = await Guest.findOne({ countryCode: g.countryCode, mobile: g.mobile });
  if (existing) {
    Object.assign(existing, Object.fromEntries(Object.entries(g).filter(([, v]) => v !== "" && v != null)));
    return existing.save();
  }
  return Guest.create(g);
}

export async function findRoomConflict(roomId, checkIn, checkOut, excludeId) {
  const candidates = await Reservation.find({
    room: roomId,
    status: { $in: ACTIVE_RES_STATUSES },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).limit(1);
  return candidates[0] || null;
}

async function resolveRoomAndRate({ propertyId, roomId, roomType }) {
  const property = await Property.findById(propertyId);
  if (!property) throw badRequest("Unknown property");
  let room = null;
  if (roomId) {
    room = await Room.findById(roomId);
    if (!room || !room.property.equals(property._id)) throw badRequest("Room does not belong to the selected property");
  }
  const type = room ? room.type : roomType;
  const rate = room ? room.rate : property.defaultRates.get(type) ?? property.defaultRates.get("Standard") ?? 0;
  return { property, room, type, rate };
}

function roomChargeLine(nights, rate, roomLabel, by) {
  return {
    kind: "charge",
    code: "ROOM",
    department: "Room",
    description: `Room charge — ${roomLabel} (${nights} night${nights === 1 ? "" : "s"} @ ${inr(rate)})`,
    quantity: nights,
    unitPrice: rate,
    amount: round2(nights * rate),
    postedBy: by,
  };
}

function rebuildRoomCharge(res, roomLabel, by) {
  res.roomChargeLines().forEach((l) => {
    l.voided = true;
    l.voidReason = "Re-rated after booking change";
    l.voidedBy = by;
    l.voidedAt = new Date();
  });
  res.folio.push(roomChargeLine(res.nights, res.rate, roomLabel, by));
}

// ── Create / update ───────────────────────────────────────────────────────────
export async function createReservation(body, user) {
  const input = parse(createSchema, body);
  validateStay(input);
  if (input.status === "On Hold" && !input.holdUntil) throw badRequest("Hold-until date/time is required for On Hold bookings.");
  if (input.status === "Checked In" && input.checkIn !== todayStr()) throw badRequest("Immediate check-in is only possible for today's arrivals. Use Confirmed for future dates.");
  if (input.status === "Checked In" && !input.roomId) throw badRequest("A room is required for immediate check-in.");

  const { property, room, type, rate } = await resolveRoomAndRate(input);
  if (room && input.status === "Checked In" && room.status !== "Available") throw conflict(`Room ${room.number} is ${room.status} — choose an Available room for immediate check-in.`);
  if (room) {
    const clash = await findRoomConflict(room._id, input.checkIn, input.checkOut);
    if (clash) throw conflict(`Room ${room.number} is already booked for ${clash.guestName} (${clash.checkIn} → ${clash.checkOut}).`);
  }

  const guest = await upsertGuest(input.guest);
  const dup = await Reservation.findOne({
    guest: guest._id,
    status: { $in: ACTIVE_RES_STATUSES },
    checkIn: { $lt: input.checkOut },
    checkOut: { $gt: input.checkIn },
  });
  if (dup) throw conflict(`Duplicate booking — ${guest.name} already has ${dup.confirmationNo} for overlapping dates (${dup.checkIn} → ${dup.checkOut}).`);

  const nights = nightsBetween(input.checkIn, input.checkOut);
  const res = new Reservation({
    ...input,
    status: input.status === "Checked In" ? "Confirmed" : input.status,
    confirmationNo: await nextConfirmationNo(),
    guest: guest._id,
    guestName: guest.name,
    guestMobile: `${guest.countryCode} ${guest.mobile}`,
    isVIP: input.isVIP || guest.isVIP,
    property: property._id,
    room: room?._id || null,
    roomType: type,
    rate,
    holdUntil: input.holdUntil ? new Date(input.holdUntil) : undefined,
    createdBy: user.name,
    folio: [roomChargeLine(nights, rate, room ? `Room ${room.number}` : `${type}, room TBA`, user.name)],
  });

  const adv = input.advance;
  if (adv && adv.amount > 0) {
    if (adv.amount > res.recalc().total) throw badRequest(`Advance ${inr(adv.amount)} cannot exceed the booking total ${inr(res.totals.total)}.`);
    res.folio.push({
      kind: "payment", code: "ADV", description: `Advance payment — ${adv.method}`, amount: round2(adv.amount),
      method: adv.method, reference: adv.reference, receiptNo: await nextReceiptNo(), postedBy: user.name,
    });
  }
  await res.save();

  if (input.status === "Checked In") return checkIn(res._id, { roomId: room._id.toString(), allowDirty: false }, user);
  return loadReservation(res._id);
}

export async function updateReservation(id, body, user) {
  const res = await Reservation.findById(id);
  if (!res) throw notFound("Reservation");
  if (["Checked Out", "Cancelled", "No Show"].includes(res.status)) throw badRequest(`A ${res.status} booking cannot be edited.`);
  const input = parse(updateSchema, body);

  if (input.guest) {
    const current = await Guest.findById(res.guest);
    const merged = { ...current.toObject(), ...input.guest };
    const guest = await upsertGuest({
      name: merged.name, countryCode: merged.countryCode, mobile: merged.mobile, email: merged.email || "",
      dob: merged.dob || "", gender: merged.gender || "", address: merged.address || "",
      nationality: merged.nationality || "Indian", idType: merged.idType, idNumber: merged.idNumber,
    });
    res.guest = guest._id;
    res.guestName = guest.name;
    res.guestMobile = `${guest.countryCode} ${guest.mobile}`;
  }

  const isInHouse = res.status === "Checked In";
  const stayChanged =
    (input.checkIn && input.checkIn !== res.checkIn) || (input.checkOut && input.checkOut !== res.checkOut) ||
    (input.roomId !== undefined && String(input.roomId || "") !== String(res.room || "")) ||
    (input.propertyId && input.propertyId !== String(res.property)) || (input.roomType && input.roomType !== res.roomType && !res.room);

  if (stayChanged) {
    if (isInHouse) throw badRequest("For in-house guests use Extend Stay or Room Move to change dates or room.");
    const next = {
      propertyId: input.propertyId || String(res.property),
      roomId: input.roomId !== undefined ? input.roomId : res.room ? String(res.room) : null,
      roomType: input.roomType || res.roomType,
      checkIn: input.checkIn || res.checkIn,
      checkOut: input.checkOut || res.checkOut,
      etd: input.etd || res.etd,
    };
    validateStay(next);
    const { property, room, type, rate } = await resolveRoomAndRate(next);
    if (room) {
      const clash = await findRoomConflict(room._id, next.checkIn, next.checkOut, res._id);
      if (clash) throw conflict(`Room ${room.number} is already booked for ${clash.guestName} (${clash.checkIn} → ${clash.checkOut}).`);
    }
    Object.assign(res, { property: property._id, room: room?._id || null, roomType: type, rate, checkIn: next.checkIn, checkOut: next.checkOut });
    rebuildRoomCharge(res, room ? `Room ${room.number}` : `${type}, room TBA`, user.name);
  }

  const simple = ["eta", "etd", "adults", "children", "companions", "source", "reference", "purpose", "billTo", "billToName", "isVIP", "group",
    "earlyCheckIn", "lateCheckOut", "specialRequests", "internalNotes", "emergencyContact", "cForm"];
  simple.forEach((k) => { if (input[k] !== undefined) res[k] = input[k]; });
  if (!isInHouse && input.status) {
    if (input.status === "On Hold" && !(input.holdUntil || res.holdUntil)) throw badRequest("Hold-until is required for On Hold bookings.");
    res.status = input.status;
  }
  if (input.holdUntil !== undefined) res.holdUntil = input.holdUntil ? new Date(input.holdUntil) : undefined;

  await res.save();
  await user.audit(`Reservation ${res.confirmationNo} updated for ${res.guestName}`, "booking", res.confirmationNo);
  return loadReservation(res._id);
}

// ── Lifecycle actions ─────────────────────────────────────────────────────────
const checkInSchema = z.object({
  roomId: z.string().optional(),
  shiftToToday: z.boolean().optional(), // early arrival before booked date
  chargeExtraNights: z.boolean().default(true),
  allowDirty: z.boolean().default(false),
});

export async function checkIn(id, body, user) {
  const input = parse(checkInSchema, body || {});
  const res = await Reservation.findById(id);
  if (!res) throw notFound("Reservation");
  if (!["Confirmed", "On Hold"].includes(res.status)) throw badRequest(`Cannot check in a ${res.status} booking.`);
  const today = todayStr();
  if (res.checkOut <= today) throw badRequest("This booking's departure date has passed — mark it No Show or amend the dates.");

  let extraNights = 0;
  if (res.checkIn > today) {
    if (!input.shiftToToday) throw badRequest(`Guest is arriving before the booked date (${res.checkIn}). Confirm the early arrival date shift to proceed.`, { code: "EARLY_DATE" });
    extraNights = nightsBetween(today, res.checkIn);
    res.originalCheckIn = res.checkIn;
    res.checkIn = today;
  }

  const roomId = input.roomId || (res.room && String(res.room));
  if (!roomId) throw badRequest("Assign a room to check in.", { code: "NEED_ROOM" });
  const room = await Room.findById(roomId);
  if (!room || !room.property.equals(res.property)) throw badRequest("Room does not belong to this booking's property.");
  if (room.status === "Occupied" && String(room.currentReservation) !== String(res._id)) throw conflict(`Room ${room.number} is occupied.`);
  if (["Maintenance", "Blocked"].includes(room.status)) throw conflict(`Room ${room.number} is ${room.status.toLowerCase()} and cannot be used.`);
  if (room.status === "Dirty" && !input.allowDirty) throw badRequest(`Room ${room.number} is not yet cleaned.`, { code: "ROOM_DIRTY" });
  const clash = await findRoomConflict(room._id, res.checkIn, res.checkOut, res._id);
  if (clash) throw conflict(`Room ${room.number} is booked for ${clash.guestName} (${clash.checkIn} → ${clash.checkOut}).`);

  const wasTba = !res.room;
  if (wasTba || String(res.room) !== String(room._id)) {
    res.room = room._id;
    res.roomType = room.type;
    if (wasTba && room.rate !== res.rate) {
      res.rate = room.rate;
      if (extraNights) res.checkIn = res.originalCheckIn; // re-rate only the booked span first
      rebuildRoomCharge(res, `Room ${room.number}`, user.name);
      if (extraNights) res.checkIn = today;
    }
  }
  if (extraNights > 0 && input.chargeExtraNights) {
    res.folio.push({
      kind: "charge", code: "ROOM", department: "Room",
      description: `Early arrival — ${extraNights} extra night${extraNights === 1 ? "" : "s"} (${today} → ${addDays(today, extraNights)})`,
      quantity: extraNights, unitPrice: res.rate, amount: round2(extraNights * res.rate), postedBy: user.name,
    });
  }

  res.status = "Checked In";
  res.checkInAt = new Date();
  await res.save();

  room.setStatus("Occupied", user.name, `Check-in ${res.confirmationNo}`);
  room.currentReservation = res._id;
  room.dnd = false;
  await room.save();

  const early = nowHHMM() < (res.eta && res.eta < "14:00" ? res.eta : "14:00");
  await user.audit(`Checked in ${res.guestName} to Room ${room.number}${early ? " (early arrival)" : ""}${extraNights ? ` · date shifted +${extraNights}N` : ""}`, "checkin", res.confirmationNo);
  return loadReservation(res._id);
}

const checkOutSchema = z.object({
  earlyPolicy: z.enum(["full", "actual", "waive"]).default("full"),
  overrideReason: z.enum(["", ...CHECKOUT_OVERRIDE_REASONS]).default(""),
  overrideNote: optStr,
});

export async function checkOut(id, body, user) {
  const input = parse(checkOutSchema, body || {});
  const res = await Reservation.findById(id).populate("room");
  if (!res) throw notFound("Reservation");
  if (res.status !== "Checked In") throw badRequest("Only in-house guests can be checked out.");
  const today = todayStr();

  if (today < res.checkOut) {
    const nightsUsed = Math.max(1, nightsBetween(res.checkIn, today));
    const unused = res.nights - nightsUsed;
    if (unused > 0 && input.earlyPolicy !== "full") {
      const amount = round2(unused * res.rate);
      res.folio.push({
        kind: "discount", code: "EARLY", department: "Room",
        description: input.earlyPolicy === "actual"
          ? `Early departure — ${unused} unused night${unused === 1 ? "" : "s"} not charged (${nightsUsed}/${res.nights} used)`
          : `Early departure — ${unused} night${unused === 1 ? "" : "s"} waived by management`,
        amount, postedBy: user.name,
      });
    }
    res.originalCheckOut = res.checkOut;
    res.checkOut = nightsUsed === nightsBetween(res.checkIn, today) ? today : addDays(res.checkIn, 1);
  }

  const { balance, paid } = res.recalc();
  if (balance > 0) {
    if (!input.overrideReason) throw badRequest(`Outstanding balance of ${inr(balance)}. Collect payment or choose an override reason.`, { code: "BALANCE_DUE", balance });
    if (paid <= 0 && user.role !== "Admin") throw forbidden("Nothing has been paid on this folio — only an Admin can authorise checkout with the full amount outstanding.");
    res.checkoutOverride = { reason: input.overrideReason, note: input.overrideNote, by: user.name, balance };
  }

  res.status = "Checked Out";
  res.checkOutAt = new Date();
  await res.save();

  if (res.room) {
    const room = await Room.findById(res.room._id);
    room.setStatus("Dirty", user.name, `Checkout ${res.confirmationNo}`);
    room.currentReservation = null;
    room.dnd = false;
    await room.save();
    await HousekeepingTask.create({ room: room._id, task: "Checkout Clean", priority: "High", createdBy: "System", note: `After checkout of ${res.guestName}` });
  }
  await user.audit(
    `Checked out ${res.guestName} from Room ${res.room?.number || "—"}${res.originalCheckOut ? ` (early, booked till ${res.originalCheckOut})` : ""}${balance > 0 ? ` · override: ${input.overrideReason} — ${inr(balance)} pending` : ""}`,
    "checkout", res.confirmationNo
  );
  return loadReservation(res._id);
}

export async function extendStay(id, body, user) {
  const input = parse(z.object({ newCheckOut: dateStr, reason: optStr, charge: z.boolean().default(true) }), body);
  const res = await Reservation.findById(id).populate("room");
  if (!res) throw notFound("Reservation");
  if (!ACTIVE_RES_STATUSES.includes(res.status)) throw badRequest(`Cannot extend a ${res.status} booking.`);
  if (input.newCheckOut <= res.checkOut) throw badRequest("New check-out must be after the current check-out.");
  if (res.room) {
    const clash = await Reservation.findOne({
      room: res.room._id, _id: { $ne: res._id }, status: { $in: ACTIVE_RES_STATUSES },
      checkIn: { $lt: input.newCheckOut }, checkOut: { $gt: res.checkOut },
    });
    if (clash) throw conflict(`Room ${res.room.number} is booked from ${clash.checkIn} by ${clash.guestName}. Move the guest to another room first.`);
  }
  const extra = nightsBetween(res.checkOut, input.newCheckOut);
  if (input.charge) {
    res.folio.push({
      kind: "charge", code: "ROOM", department: "Room",
      description: `Extension — ${extra} night${extra === 1 ? "" : "s"} (${res.checkOut} → ${input.newCheckOut})${input.reason ? ` · ${input.reason}` : ""}`,
      quantity: extra, unitPrice: res.rate, amount: round2(extra * res.rate), postedBy: user.name,
    });
  }
  res.originalCheckOut ||= res.checkOut;
  res.checkOut = input.newCheckOut;
  await res.save();
  await user.audit(`Stay extended for ${res.guestName} to ${input.newCheckOut} (+${extra}N)${input.charge ? ` · ${inr(extra * res.rate)} charged` : " · no charge"}`, "booking", res.confirmationNo);
  return loadReservation(res._id);
}

export async function moveRoom(id, body, user) {
  const input = parse(z.object({ roomId: z.string(), rateAdjust: z.coerce.number().default(0), newRate: z.coerce.number().optional(), reason: optStr, authorizedBy: optStr }), body);
  const res = await Reservation.findById(id).populate("room");
  if (!res) throw notFound("Reservation");
  if (!ACTIVE_RES_STATUSES.includes(res.status)) throw badRequest(`Cannot move a ${res.status} booking.`);
  const target = await Room.findById(input.roomId);
  if (!target || !target.property.equals(res.property)) throw badRequest("Target room must be in the same property.");
  if (res.room && target._id.equals(res.room._id)) throw badRequest("Guest is already in this room.");
  const from = res.status === "Checked In" ? todayStr() : res.checkIn;
  const clash = await findRoomConflict(target._id, from, res.checkOut, res._id);
  if (clash) throw conflict(`Room ${target.number} is booked for ${clash.guestName} (${clash.checkIn} → ${clash.checkOut}).`);
  if (res.status === "Checked In" && target.status !== "Available") throw conflict(`Room ${target.number} is ${target.status} — it must be Available.`);

  const moveType = input.rateAdjust > 0 ? "Upgrade" : input.rateAdjust < 0 ? "Downgrade" : "Lateral Move";
  if (input.rateAdjust !== 0) {
    res.folio.push({
      kind: input.rateAdjust > 0 ? "charge" : "discount", code: "MOVE", department: "Room",
      description: `${moveType} — Room ${res.room?.number || "TBA"} → ${target.number}${input.reason ? ` · ${input.reason}` : ""}`,
      amount: round2(Math.abs(input.rateAdjust)), postedBy: user.name,
    });
  }
  res.roomMoves.push({ fromRoom: res.room?.number || "TBA", toRoom: target.number, moveType, rateAdjust: input.rateAdjust, reason: input.reason, authorizedBy: input.authorizedBy || user.name });
  const oldRoom = res.room;
  res.room = target._id;
  res.roomType = target.type;
  if (res.status !== "Checked In") {
    // Pre-arrival: the booking simply takes the new room's rate.
    if (target.rate !== res.rate) {
      res.rate = target.rate;
      rebuildRoomCharge(res, `Room ${target.number}`, user.name);
    }
  } else if (input.newRate) {
    res.rate = input.newRate;
  }
  await res.save();

  if (res.status === "Checked In") {
    if (oldRoom) {
      const old = await Room.findById(oldRoom._id);
      old.setStatus("Dirty", user.name, `Room move ${res.confirmationNo}`);
      old.currentReservation = null;
      await old.save();
      await HousekeepingTask.create({ room: old._id, task: "Checkout Clean", priority: "High", createdBy: "System", note: `Guest moved to ${target.number}` });
    }
    target.setStatus("Occupied", user.name, `Room move ${res.confirmationNo}`);
    target.currentReservation = res._id;
    await target.save();
  }
  await user.audit(`${moveType}: ${res.guestName} — Room ${oldRoom?.number || "TBA"} → ${target.number}${input.rateAdjust ? ` · adj ${inr(input.rateAdjust)}` : ""}`, "booking", res.confirmationNo);
  return loadReservation(res._id);
}

// Cancel and No Show both void the room charge and optionally post a retention fee.
async function closeUnstayed(id, body, user, status) {
  const input = parse(z.object({ fee: z.coerce.number().min(0).default(0), reason: optStr }), body || {});
  const res = await Reservation.findById(id);
  if (!res) throw notFound("Reservation");
  if (!["Confirmed", "On Hold"].includes(res.status)) throw badRequest(`Only Confirmed or On Hold bookings can be marked ${status}.`);
  if (status === "No Show" && res.checkIn > todayStr()) throw badRequest("A booking can only be a No Show on or after its arrival date.");
  res.folio.forEach((l) => {
    if (l.kind === "charge" && !l.voided) Object.assign(l, { voided: true, voidReason: `Booking ${status.toLowerCase()}`, voidedBy: user.name, voidedAt: new Date() });
  });
  if (input.fee > 0) {
    res.folio.push({ kind: "charge", code: status === "Cancelled" ? "CXL" : "NOSHOW", department: "Room", description: status === "Cancelled" ? `Cancellation fee${input.reason ? ` · ${input.reason}` : ""}` : "No-show retention", amount: round2(input.fee), postedBy: user.name });
  }
  res.status = status;
  res.cancelledAt = new Date();
  res.cancelReason = input.reason;
  await res.save();
  const { balance } = res.totals;
  await user.audit(`${status}: ${res.guestName} (${res.confirmationNo})${input.fee ? ` · fee ${inr(input.fee)}` : ""}${balance < 0 ? ` · ${inr(-balance)} refundable` : ""}`, status === "Cancelled" ? "booking" : "checkout", res.confirmationNo);
  return loadReservation(res._id);
}
export const cancelReservation = (id, body, user) => closeUnstayed(id, body, user, "Cancelled");
export const markNoShow = (id, body, user) => closeUnstayed(id, body, user, "No Show");

// ── Folio operations ──────────────────────────────────────────────────────────
export async function addCharge(id, body, user) {
  const input = parse(z.object({
    code: z.enum(CHARGE_CATALOG.map((c) => c.code)),
    description: optStr,
    quantity: z.coerce.number().positive().default(1),
    unitPrice: z.coerce.number().positive(),
    chargeDate: dateStr.optional(),
  }), body);
  const res = await Reservation.findById(id);
  if (!res) throw notFound("Reservation");
  if (["Cancelled", "No Show"].includes(res.status)) throw badRequest(`Cannot post charges to a ${res.status} booking.`);
  const item = CHARGE_CATALOG.find((c) => c.code === input.code);
  if (input.code === "MS001" && !input.description) throw badRequest("Describe the miscellaneous charge.");
  const label = input.code === "MS001" ? input.description : item.label;
  res.folio.push({
    kind: "charge", code: item.code, department: item.group,
    description: `${label}${input.quantity !== 1 ? ` × ${input.quantity}` : ""}${input.code !== "MS001" && input.description ? ` · ${input.description}` : ""}`,
    quantity: input.quantity, unitPrice: input.unitPrice, amount: round2(input.quantity * input.unitPrice),
    chargeDate: input.chargeDate || todayStr(), postedBy: user.name,
  });
  await res.save();
  await user.audit(`Charge ${item.code} ${inr(input.quantity * input.unitPrice)} posted to ${res.guestName}`, "payment", res.confirmationNo);
  return loadReservation(res._id);
}

export async function voidLine(id, lineId, body, user) {
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, "Give a reason for voiding") }), body);
  const res = await Reservation.findById(id);
  if (!res) throw notFound("Reservation");
  const line = res.folio.id(lineId);
  if (!line) throw notFound("Folio line");
  if (line.voided) throw badRequest("Line is already void.");
  if (["payment", "refund"].includes(line.kind) && user.role !== "Admin") throw forbidden("Only an Admin can void payments.");
  Object.assign(line, { voided: true, voidReason: reason, voidedBy: user.name, voidedAt: new Date() });
  await res.save();
  await user.audit(`Voided ${line.kind} "${line.description}" ${inr(line.amount)} on ${res.guestName} — ${reason}`, "payment", res.confirmationNo);
  return loadReservation(res._id);
}

export async function addPayment(id, body, user) {
  const input = parse(z.object({
    splits: z.array(z.object({ method: z.enum(PAYMENT_METHODS.map((m) => m.id)), amount: z.coerce.number().positive(), reference: optStr })).min(1, "Add at least one payment"),
    discount: z.coerce.number().min(0).default(0),
    discountReason: optStr,
    tip: z.coerce.number().min(0).default(0),
    note: optStr,
  }), body);
  const res = await Reservation.findById(id);
  if (!res) throw notFound("Reservation");
  for (const s of input.splits) {
    const m = PAYMENT_METHODS.find((x) => x.id === s.method);
    if (m.refRequired && !s.reference) throw badRequest(`${m.refLabel} is required for ${m.id} payments.`);
  }
  const { balance } = res.recalc();
  const paying = round2(input.splits.reduce((s, x) => s + x.amount, 0));
  if (round2(paying + input.discount) > round2(balance) + 0.001) throw badRequest(`Payment ${inr(paying)}${input.discount ? ` + discount ${inr(input.discount)}` : ""} exceeds the balance ${inr(balance)}.`);
  if (input.discount > 0 && !input.discountReason) throw badRequest("Give a reason for the discount.");

  const receiptNo = await nextReceiptNo();
  if (input.discount > 0) res.folio.push({ kind: "discount", code: "DISC", description: `Discount · ${input.discountReason}`, amount: round2(input.discount), receiptNo, postedBy: user.name });
  input.splits.forEach((s) =>
    res.folio.push({ kind: "payment", code: "PAY", description: `Payment — ${s.method}${input.note ? ` · ${input.note}` : ""}`, amount: round2(s.amount), method: s.method, reference: s.reference, receiptNo, postedBy: user.name })
  );
  if (input.tip > 0) res.folio.push({ kind: "tip", code: "TIP", description: "Tip / donation", amount: round2(input.tip), method: input.splits.at(-1).method, receiptNo, postedBy: user.name });
  await res.save();
  await user.audit(`Payment ${inr(paying)} (${input.splits.map((s) => s.method).join(" + ")}) from ${res.guestName} · ${receiptNo}${input.discount ? ` · discount ${inr(input.discount)}` : ""}`, "payment", res.confirmationNo);
  const out = await loadReservation(res._id);
  return { reservation: out, receiptNo };
}

export async function addRefund(id, body, user) {
  const input = parse(z.object({ amount: z.coerce.number().positive(), method: z.enum(PAYMENT_METHODS.map((m) => m.id)), reference: optStr, reason: z.string().trim().min(3) }), body);
  const res = await Reservation.findById(id);
  if (!res) throw notFound("Reservation");
  const { balance } = res.recalc();
  if (input.amount > round2(-balance) + 0.001) throw badRequest(`Refund cannot exceed the guest's credit of ${inr(Math.max(0, -balance))}.`);
  const receiptNo = await nextReceiptNo();
  res.folio.push({ kind: "refund", code: "REF", description: `Refund — ${input.method} · ${input.reason}`, amount: round2(input.amount), method: input.method, reference: input.reference, receiptNo, postedBy: user.name });
  await res.save();
  await user.audit(`Refund ${inr(input.amount)} to ${res.guestName} via ${input.method}`, "payment", res.confirmationNo);
  return loadReservation(res._id);
}
