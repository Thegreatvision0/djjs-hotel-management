import mongoose from "mongoose";
import User from "../models/User.js";
import Property from "../models/Property.js";
import Room from "../models/Room.js";
import Guest from "../models/Guest.js";
import Reservation from "../models/Reservation.js";
import Counter, { nextConfirmationNo, nextReceiptNo } from "../models/Counter.js";
import { HousekeepingTask, MenuItem, PosOrder, AuditLog, NightAudit } from "../models/Operations.js";
import { todayStr, addDays, nightsBetween } from "../utils/dates.js";

const T = todayStr();
const d = (n) => addDays(T, n);
const at = (n, hhmm = "10:00") => new Date(`${d(n)}T${hhmm}:00+05:30`);

export const DEMO_USERS = [
  { name: "Admin User", email: "admin@djjshotel.com", password: "admin123", role: "Admin" },
  { name: "Sarah Chen", email: "frontdesk@djjshotel.com", password: "frontdesk", role: "Front Desk" },
  { name: "Mike Torres", email: "housekeeping@djjshotel.com", password: "housekeep", role: "Housekeeping" },
  { name: "Priya Nair", email: "restaurant@djjshotel.com", password: "restaurant", role: "Restaurant" },
];

async function seedProperties() {
  const [ab, dsb, gh] = await Property.create([
    { code: "AB", name: "Anand Bhawan", defaultRates: { Standard: 9999, Deluxe: 14999 }, floors: [0, 1, 2, 3, 4], sortOrder: 1 },
    { code: "DSB", name: "DSB", defaultRates: { Standard: 1400, Deluxe: 1400 }, floors: [2], sortOrder: 2 },
    { code: "GH", name: "Guest House", defaultRates: { Standard: 1200 }, floors: [0, 1], sortOrder: 3 },
  ]);

  const rooms = [];
  const base = ["ac", "tv", "wifi", "hotwater", "attachedBath"];
  // DSB — floor 2, flat ₹1,400
  [["01", "Standard"], ["02", "Standard"], ["03", "Standard"], ["04", "Standard"], ["05", "Deluxe"], ["06", "Deluxe"], ["07", "Standard"]].forEach(([n, type]) =>
    rooms.push({ number: `DSB-${n}`, property: dsb._id, floor: 2, type, rate: 1400, maxOccupancy: type === "Deluxe" ? 3 : 2, amenities: [...base, "geyser"] })
  );
  // Guest House — ground + first floor
  const ghRates = { "03": 1200, "04": 1200, "05": 1200, "06": 1000, "07": 1000, "08": 1200, "09": 1200, "10": 1200 };
  Object.entries(ghRates).forEach(([n, rate]) =>
    rooms.push({ number: `GH-${n}`, property: gh._id, floor: Number(n) <= 5 ? 0 : 1, type: "Standard", rate, maxOccupancy: 2, amenities: base })
  );
  // Anand Bhawan — G: 01-12, 1-3: x01-x13, 4: 401-403. Deluxe suffixes 03,04,09,10 below floor 4.
  const deluxe = new Set([3, 4, 9, 10]);
  const floors = [
    [0, Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))],
    [1, Array.from({ length: 13 }, (_, i) => String(101 + i))],
    [2, Array.from({ length: 13 }, (_, i) => String(201 + i))],
    [3, Array.from({ length: 13 }, (_, i) => String(301 + i))],
    [4, ["401", "402", "403"]],
  ];
  floors.forEach(([floor, nums]) =>
    nums.forEach((num) => {
      const isDeluxe = floor < 4 && deluxe.has(Number(num) % 100);
      rooms.push({
        number: num, property: ab._id, floor, type: isDeluxe ? "Deluxe" : "Standard", rate: isDeluxe ? 14999 : 9999,
        maxOccupancy: isDeluxe ? 3 : 2, amenities: isDeluxe ? [...base, "geyser", "kettle", "sofa"] : base,
      });
    })
  );
  await Room.insertMany(rooms);
  return { ab, dsb, gh };
}

async function seedReservations(props) {
  const roomBy = async (p, number) => Room.findOne({ property: props[p]._id, number });
  const specs = [
    // Checked out — history
    { g: ["Rohit Agarwal", "9810123456", "Aadhaar", "234500001111", "17 Sadar Bazaar, Delhi", "1982-06-14"], p: "ab", room: "102", in: -8, out: -4, status: "Checked Out", source: "Website", adv: [9999, "UPI", -12], pays: [[29997, "UPI", -4, "UPI2026A1"]] },
    { g: ["Kavita Singh", "7005566778", "PAN Card", "BKZCS9876P", "5 Hazratganj, Lucknow, UP", "1990-11-08"], p: "dsb", room: "DSB-01", in: -10, out: -5, status: "Checked Out", source: "Walk-in", adv: [1400, "Cash", -11], pays: [[5600, "Cash", -5]] },
    { g: ["Deepak Rao", "9845012345", "Aadhaar", "556677889900", "22 Jayanagar, Bengaluru, KA", "1986-02-11"], p: "gh", room: "GH-03", in: -6, out: -3, status: "Checked Out", source: "Phone", adv: [2400, "UPI", -6], override: "Guest will pay by bank transfer" },
    // No show (charges voided, retention kept)
    { g: ["Omar Farooq", "7001122334", "Voter ID", "RJA2400123", "5 Gandhi Nagar, Jaipur, RJ", "1988-12-01"], p: "ab", room: "101", in: -2, out: 1, status: "No Show", source: "Phone", adv: [9999, "Bank Transfer", -6, "UTR99812"], retention: 9999 },
    // In-house
    { g: ["Ananya Krishnan", "9811234567", "Aadhaar", "234511119876", "14 Residency Road, Bengaluru, KA", "1990-07-14"], p: "ab", room: "303", in: -2, out: 3, status: "Checked In", source: "Website", vip: true, adv: [29998, "Card", -15, "AUTH8812"], extras: [["FB002", "F&B", "Room Service", 1200, -1], ["LH001", "Laundry", "Laundry — Wash & Fold", 500, 0]], requests: "High floor, extra pillows, no housekeeping before 10am", notes: "Repeat guest — prefers quiet room" },
    { g: ["Hardeep Singh Bhatia", "7002298765", "Driving Licence", "PB-0220110012345", "88 Model Town, Amritsar, PB", "1975-11-03"], p: "ab", room: "309", in: -1, out: 3, status: "Checked In", source: "Travel Agent", adults: 3, children: 1, group: { id: "GRP-031", name: "Bhatia Family Tour" }, adv: [59996, "Bank Transfer", -7, "UTR55120"], requests: "Adjoining rooms if possible, crib for infant" },
    { g: ["Simran Bhatia", "7002211111", "Aadhaar", "987600001234", "88 Model Town, Amritsar, PB", "1979-04-22"], p: "ab", room: "311", in: -1, out: 3, status: "Checked In", source: "Travel Agent", adults: 2, children: 2, group: { id: "GRP-031", name: "Bhatia Family Tour" }, adv: [9999, "UPI", -7, "UPI77120"] },
    { g: ["Priya Joshi", "8890033445", "Passport", "N7654321", "21 Rajouri Garden, Delhi", "1995-09-15"], p: "dsb", room: "DSB-02", in: -1, out: 3, status: "Checked In", source: "WhatsApp", extras: [["RC003", "Room", "Early Check-In Fee", 500, -1]], adv: [6100, "UPI", -2, "UPI66100"] },
    { g: ["Rajendra Prasad Gupta", "9933344556", "Voter ID", "UPA2212378", "9 Civil Lines, Prayagraj, UP", "1965-02-28"], p: "gh", room: "GH-07", in: -4, out: 1, status: "Checked In", source: "Walk-in", adults: 2, children: 2, purpose: "Pilgrimage / Religious", adv: [2000, "Cash", -4], requests: "Vegetarian meals only, ground floor preferred", notes: "Senior citizen — assist with luggage" },
    { g: ["Mohammed Iqbal", "9950012345", "Aadhaar", "567800009999", "12 Masjid Road, Hyderabad, TG", "1978-05-20"], p: "ab", room: "107", in: 0, out: 5, status: "Checked In", source: "Phone", adults: 2, purpose: "NGO / Social Work", billTo: "Sponsor", billToName: "Iqbal Foundation", notes: "Sponsored — billing settled by sponsor at checkout" },
    { g: ["Sunita Verma", "9119988776", "PAN Card", "CVJSV7890K", "33 Alaknanda, New Delhi", "1985-08-30"], p: "ab", room: "104", in: -2, out: 0, status: "Checked In", source: "Walk-in", notes: "Walk-in, no advance — full payment due at checkout" },
    // Arrivals
    { g: ["Vikram Malhotra", "9900112233", "Aadhaar", "987612345678", "11 Park Street, Kolkata, WB", "1980-04-10"], p: "ab", room: "304", in: 0, out: 3, status: "Confirmed", source: "Website", adults: 2, adv: [14999, "UPI", -5, "UPI14999"], requests: "Arriving by train at 2pm" },
    { g: ["Meera Kapoor", "8811255667", "Passport", "Z9876543", "27 Marine Drive, Mumbai, MH", "1992-03-17"], p: "ab", room: null, type: "Standard", in: 2, out: 5, status: "Confirmed", source: "Phone", requests: "Quiet room, non-smoking floor" },
    { g: ["Suresh Patel", "7003311223", "Driving Licence", "GJ-0120050056789", "8 Navrangpura, Ahmedabad, GJ", "1970-01-25"], p: "dsb", room: "DSB-06", in: 3, out: 7, status: "Confirmed", source: "WhatsApp", adults: 2, children: 1, purpose: "Pilgrimage / Religious", adv: [1400, "UPI", -1, "UPI1400"] },
    { g: ["Lakshmi Devi", "9670022334", "Voter ID", "UPA0996543", "3 Ram Nagar, Varanasi, UP", "1958-07-04"], p: "gh", room: "GH-05", in: 5, out: 8, status: "On Hold", holdUntil: at(2, "18:00"), source: "Walk-in", purpose: "Pilgrimage / Religious", notes: "Guest will confirm within 2 days" },
    { g: ["Arun Mehta", "9880011223", "Passport", "K1234567", "45 Bandra West, Mumbai, MH", "1968-09-12"], p: "ab", room: "310", in: 7, out: 10, status: "Confirmed", source: "Corporate", adults: 2, vip: true, group: { id: "GRP-044", name: "Mehta Corporate" }, billTo: "Company", billToName: "Mehta Industries Ltd", adv: [14999, "Bank Transfer", -1, "UTR0044"], requests: "Airport pickup required" },
  ];

  for (const s of specs) {
    const [name, mobile, idType, idNumber, address, dob] = s.g;
    const guest = await Guest.create({ name, mobile, idType, idNumber, address, dob, countryCode: "+91", nationality: "Indian", isVIP: !!s.vip });
    const room = s.room ? await roomBy(s.p, s.room) : null;
    const prop = props[s.p];
    const rate = room ? room.rate : prop.defaultRates.get(s.type || "Standard");
    const checkIn = d(s.in);
    const checkOut = d(s.out);
    const nights = nightsBetween(checkIn, checkOut);
    const folio = [{
      kind: "charge", code: "ROOM", department: "Room", quantity: nights, unitPrice: rate, amount: nights * rate, postedBy: "Front Desk", postedAt: at(Math.min(s.in, 0) - 1),
      description: `Room charge — ${room ? "Room " + room.number : (s.type || "Standard") + ", room TBA"} (${nights} night${nights === 1 ? "" : "s"} @ ₹${rate.toLocaleString("en-IN")})`,
    }];
    (s.extras || []).forEach(([code, department, description, amount, day]) => folio.push({ kind: "charge", code, department, description, amount, postedBy: "Front Desk", postedAt: at(day, "19:30"), chargeDate: d(day) }));
    if (s.adv) {
      const [amount, method, day, reference] = s.adv;
      folio.push({ kind: "payment", code: "ADV", description: `Advance payment — ${method}`, amount, method, reference, receiptNo: await nextReceiptNo(), postedBy: "Sarah Chen", postedAt: at(day, "11:15") });
    }
    for (const [amount, method, day, reference] of s.pays || []) {
      folio.push({ kind: "payment", code: "PAY", description: `Payment — ${method}`, amount, method, reference, receiptNo: await nextReceiptNo(), postedBy: "Sarah Chen", postedAt: at(day, "10:40") });
    }
    if (s.status === "No Show") {
      folio[0].voided = true;
      folio[0].voidReason = "Booking no show";
      folio[0].voidedBy = "Night Audit";
      folio.push({ kind: "charge", code: "NOSHOW", department: "Room", description: "No-show retention", amount: s.retention, postedBy: "Night Audit", postedAt: at(-1, "23:50") });
    }

    const res = new Reservation({
      confirmationNo: await nextConfirmationNo(),
      guest: guest._id, guestName: name, guestMobile: `+91 ${mobile}`,
      property: prop._id, room: room?._id || null, roomType: room?.type || s.type || "Standard", rate,
      checkIn, checkOut, status: s.status, holdUntil: s.holdUntil,
      adults: s.adults || 1, children: s.children || 0, source: s.source, purpose: s.purpose || "",
      billTo: s.billTo || "Guest", billToName: s.billToName || "", isVIP: !!s.vip, group: s.group || {},
      specialRequests: s.requests || "", internalNotes: s.notes || "", createdBy: "Sarah Chen",
      checkInAt: ["Checked In", "Checked Out"].includes(s.status) ? at(s.in, "14:20") : undefined,
      checkOutAt: s.status === "Checked Out" ? at(s.out, "10:50") : undefined,
      cancelledAt: s.status === "No Show" ? at(-1, "23:50") : undefined,
      folio,
    });
    if (s.override) {
      const { balance } = res.recalc();
      res.checkoutOverride = { reason: s.override, by: "Sarah Chen", balance };
    }
    await res.save();
    if (room && s.status === "Checked In") {
      room.status = "Occupied";
      room.currentReservation = res._id;
      room.statusLog.push({ from: "Available", to: "Occupied", note: `Check-in ${res.confirmationNo}`, by: "Sarah Chen", at: at(s.in, "14:20") });
      await room.save();
    }
  }
}

async function seedOperations(props) {
  const ab = (n) => Room.findOne({ property: props.ab._id, number: n });
  for (const n of ["05", "201"]) {
    const rm = await ab(n);
    rm.status = "Dirty";
    await rm.save();
    await HousekeepingTask.create({ room: rm._id, task: "Checkout Clean", priority: "High", assignedTo: "Maria G.", createdBy: "System" });
  }
  for (const [n, issue] of [["106", "AC unit not cooling"], ["302", "Bathroom tap leaking"]]) {
    const rm = await ab(n);
    rm.status = "Maintenance";
    rm.maintenance.push({ issue, priority: "High", assignedTo: "Tech Team", reportedBy: "Mike Torres" });
    await rm.save();
  }
  const gh10 = await Room.findOne({ property: props.gh._id, number: "GH-10" });
  gh10.status = "Blocked";
  gh10.block = { reason: "Reserved for visiting Swamiji's attendants", from: T, to: d(3), by: "Admin User" };
  await gh10.save();

  const r303 = await ab("303");
  await HousekeepingTask.create([
    { room: r303._id, task: "Turndown Service", priority: "Normal", assignedTo: "Jose M.", status: "In Progress", createdBy: "Mike Torres", note: "VIP — fresh flowers" },
    { room: (await ab("306"))._id, task: "Deep Clean", priority: "Low", assignedTo: "Maria G.", createdBy: "Mike Torres" },
  ]);

  await MenuItem.insertMany([
    { name: "Masala Dosa", category: "Breakfast", price: 180 },
    { name: "Aloo Paratha with Curd", category: "Breakfast", price: 160 },
    { name: "Poha", category: "Breakfast", price: 120 },
    { name: "Veg Thali", category: "Mains", price: 320 },
    { name: "Paneer Butter Masala", category: "Mains", price: 280 },
    { name: "Dal Tadka & Jeera Rice", category: "Mains", price: 240 },
    { name: "Club Sandwich", category: "Snacks", price: 350 },
    { name: "Veg Pakora", category: "Snacks", price: 150 },
    { name: "Masala Chai", category: "Beverages", price: 60 },
    { name: "Filter Coffee", category: "Beverages", price: 90 },
    { name: "Fresh Lime Soda", category: "Beverages", price: 110 },
    { name: "Mineral Water", category: "Beverages", price: 40 },
    { name: "Gulab Jamun (2 pc)", category: "Desserts", price: 90 },
  ]);
  await PosOrder.create([
    { orderNo: "KOT-101", table: "T2", items: [{ name: "Club Sandwich", price: 350, qty: 2 }, { name: "Filter Coffee", price: 90, qty: 2 }], total: 880, status: "Settled", paymentMethod: "UPI", createdBy: "Priya Nair" },
    { orderNo: "KOT-102", table: "T5", items: [{ name: "Veg Thali", price: 320, qty: 2 }, { name: "Fresh Lime Soda", price: 110, qty: 2 }], total: 860, status: "In Kitchen", createdBy: "Priya Nair" },
  ]);
  await Counter.updateOne({ _id: "pos" }, { seq: 102 }, { upsert: true });

  await AuditLog.create([
    { user: "System", type: "audit", action: "Database seeded with demo data" },
    { user: "Mike Torres", role: "Housekeeping", type: "housekeeping", action: "Maintenance logged for Room 106: AC unit not cooling" },
    { user: "Priya Nair", role: "Restaurant", type: "pos", action: "POS KOT-102 ₹860 · Table T5" },
  ]);
}

export async function seedAll() {
  for (const u of DEMO_USERS) {
    const user = new User({ name: u.name, email: u.email, role: u.role });
    await user.setPassword(u.password);
    await user.save();
  }
  const props = await seedProperties();
  await seedReservations(props);
  await seedOperations(props);
}

export async function seedIfEmpty() {
  if (await User.estimatedDocumentCount()) return;
  console.log("… Empty database — seeding demo data");
  await seedAll();
  console.log("✓ Demo data seeded");
}

export async function resetDatabase() {
  const models = [User, Property, Room, Guest, Reservation, Counter, HousekeepingTask, MenuItem, PosOrder, AuditLog, NightAudit];
  await Promise.all(models.map((m) => m.deleteMany({})));
  await seedAll();
}

export { mongoose };
