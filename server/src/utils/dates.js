// Stay dates are stored as "YYYY-MM-DD" strings (date-only, timezone-free).
// "Today" is evaluated in the hotel's timezone so night/day boundaries are correct.
const HOTEL_TZ = process.env.HOTEL_TZ || "Asia/Kolkata";

export function todayStr(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: HOTEL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function nowHHMM(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: HOTEL_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(from, to) {
  if (!from || !to) return 0;
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

export function rangesOverlap(aIn, aOut, bIn, bOut) {
  return aIn < bOut && aOut > bIn;
}

export function isDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function enumerateDates(from, count) {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
