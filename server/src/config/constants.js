// Single source of truth for business constants. Served to the client via GET /api/meta.

export const HOTEL = {
  name: "DJJS Hotel",
  tagline: "Anand Bhawan · DSB · Guest House",
  standardCheckIn: "14:00",
  standardCheckOut: "11:00",
  currency: "INR",
};

export const ROLES = ["Admin", "Front Desk", "Housekeeping", "Restaurant"];

// Which app sections each role may open (enforced on the server per route as well).
export const ROLE_ACCESS = {
  Admin: ["dashboard", "reservations", "availability", "guests", "rooms", "billing", "housekeeping", "pos", "users", "reports"],
  "Front Desk": ["dashboard", "reservations", "availability", "guests", "rooms", "billing"],
  Housekeeping: ["rooms", "housekeeping"],
  Restaurant: ["pos"],
};

export const ROOM_TYPES = ["Standard", "Deluxe"];

export const ROOM_STATUSES = ["Available", "Occupied", "Dirty", "Maintenance", "Blocked"];

export const RES_STATUSES = ["Confirmed", "On Hold", "Checked In", "Checked Out", "Cancelled", "No Show"];
export const ACTIVE_RES_STATUSES = ["Confirmed", "On Hold", "Checked In"];

export const BOOKING_SOURCES = ["Walk-in", "Phone", "WhatsApp", "Travel Agent", "Corporate", "MakeMyTrip", "Yatra", "Website", "Email", "Other"];
export const NATIONALITIES = ["Indian", "American", "British", "Australian", "Canadian", "German", "French", "Japanese", "Chinese", "Emirati", "Saudi Arabian", "Singaporean", "Malaysian", "Russian", "Brazilian", "South African", "Other"];
export const PURPOSES = ["Personal", "Business", "Tourism", "Medical", "Pilgrimage / Religious", "Wedding / Event", "Government / Official", "NGO / Social Work", "Transit", "Other"];
export const VISA_TYPES = ["Tourist", "Business", "Student", "Medical", "Transit", "Diplomatic", "Work", "Other"];
export const BILL_TO = ["Guest", "Sponsor", "Company", "Travel Agent"];

export const ID_TYPES = [
  { id: "Aadhaar", pattern: "^\\d{12}$", hint: "12 digits" },
  { id: "PAN Card", pattern: "^[A-Z]{5}[0-9]{4}[A-Z]$", hint: "ABCDE1234F" },
  { id: "Passport", pattern: "^[A-Z][0-9]{7}$", hint: "A1234567" },
  { id: "Voter ID", pattern: "^[A-Z]{3}[0-9]{7}$|^[A-Z]{2}/\\d{2}/\\d{3}/\\d{6}$", hint: "ABC1234567" },
  { id: "Driving Licence", pattern: "^[A-Z0-9\\- ]{10,}$", hint: "min. 10 characters" },
  { id: "OCI Card", pattern: "^[A-Z0-9]{7,}$", hint: "min. 7 characters" },
];

export const COUNTRY_CODES = [
  { code: "+91", country: "India", digits: 10 },
  { code: "+1", country: "USA / Canada", digits: 10 },
  { code: "+44", country: "UK", digits: 10 },
  { code: "+61", country: "Australia", digits: 9 },
  { code: "+971", country: "UAE", digits: 9 },
  { code: "+65", country: "Singapore", digits: 8 },
  { code: "+60", country: "Malaysia", digits: 10 },
  { code: "+966", country: "Saudi Arabia", digits: 9 },
  { code: "+49", country: "Germany", digits: 10 },
  { code: "+33", country: "France", digits: 9 },
  { code: "+81", country: "Japan", digits: 10 },
  { code: "+86", country: "China", digits: 11 },
  { code: "+7", country: "Russia", digits: 10 },
  { code: "+55", country: "Brazil", digits: 11 },
  { code: "+27", country: "South Africa", digits: 9 },
];

export const AMENITIES = [
  { id: "ac", label: "AC" }, { id: "tv", label: "TV" }, { id: "wifi", label: "Wi-Fi" },
  { id: "geyser", label: "Geyser" }, { id: "hotwater", label: "Hot Water" }, { id: "attachedBath", label: "Attached Bath" },
  { id: "balcony", label: "Balcony" }, { id: "safe", label: "Safe" }, { id: "minibar", label: "Minibar" },
  { id: "fridge", label: "Fridge" }, { id: "kettle", label: "Kettle" }, { id: "sofa", label: "Sofa" },
  { id: "wardrobe", label: "Wardrobe" }, { id: "wheelchair", label: "Wheelchair Access" },
];

export const PAYMENT_METHODS = [
  { id: "UPI", refLabel: "UPI Transaction ID", refRequired: true },
  { id: "Cash", refLabel: "Receipt / Remarks", refRequired: false },
  { id: "Card", refLabel: "Approval / Auth Code", refRequired: true },
  { id: "Bank Transfer", refLabel: "UTR / NEFT / IMPS Ref", refRequired: true },
  { id: "Cheque", refLabel: "Cheque Number", refRequired: true },
  { id: "Complimentary", refLabel: "Approved By", refRequired: true },
  { id: "Sponsor", refLabel: "Sponsor / Reference", refRequired: true },
];

export const CHARGE_CATALOG = [
  { group: "Room", code: "RC001", label: "Extra Bed", perNight: true },
  { group: "Room", code: "RC002", label: "Extra Person", perNight: true },
  { group: "Room", code: "RC003", label: "Early Check-In Fee" },
  { group: "Room", code: "RC004", label: "Late Check-Out Fee" },
  { group: "Room", code: "RC005", label: "Room Upgrade" },
  { group: "Room", code: "RC006", label: "Baby Cot / Crib", perNight: true },
  { group: "F&B", code: "FB001", label: "Restaurant" },
  { group: "F&B", code: "FB002", label: "Room Service" },
  { group: "F&B", code: "FB003", label: "Minibar" },
  { group: "F&B", code: "FB004", label: "Sanjeevika" },
  { group: "F&B", code: "FB005", label: "Divya Misthan" },
  { group: "F&B", code: "FB006", label: "Banquet / Events" },
  { group: "Laundry", code: "LH001", label: "Laundry — Wash & Fold" },
  { group: "Laundry", code: "LH002", label: "Laundry — Dry Cleaning" },
  { group: "Laundry", code: "LH003", label: "Pressing / Ironing" },
  { group: "Laundry", code: "LH004", label: "Extra Linen / Towels" },
  { group: "Telecom", code: "TC001", label: "Local / STD Calls" },
  { group: "Telecom", code: "TC002", label: "ISD Calls" },
  { group: "Telecom", code: "TC003", label: "Internet / Wi-Fi", perNight: true },
  { group: "Telecom", code: "BC001", label: "Printing / Courier" },
  { group: "Transport", code: "TR001", label: "Airport Pickup" },
  { group: "Transport", code: "TR002", label: "Airport Drop" },
  { group: "Transport", code: "TR003", label: "Local Taxi" },
  { group: "Transport", code: "TR004", label: "Parking", perNight: true },
  { group: "Damage", code: "DP001", label: "Property Damage" },
  { group: "Damage", code: "DP002", label: "Smoking Penalty" },
  { group: "Damage", code: "DP003", label: "Lost Key / Card" },
  { group: "Other", code: "MS001", label: "Miscellaneous" },
];

export const CHECKOUT_OVERRIDE_REASONS = [
  "Corporate billing — invoice to follow",
  "Travel agent settlement pending",
  "City ledger transfer authorized",
  "Complimentary waiver by management",
  "Guest will pay by bank transfer",
  "Sponsor to settle directly",
  "Other (see note)",
];

export const HK_TASK_TYPES = ["Checkout Clean", "Full Clean", "Deep Clean", "Turndown Service", "Linen Change", "Maintenance Check", "Inspection"];
export const HK_STATUSES = ["Pending", "In Progress", "Done"];
export const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

export const POS_ORDER_STATUSES = ["In Kitchen", "Served", "Settled", "Cancelled"];
