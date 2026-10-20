// Visual vocabulary for statuses — one place, used everywhere.
export const ROOM_STATUS = {
  Available: { dot: "bg-emerald-500", tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", tile: "border-emerald-200 bg-emerald-50/60", label: "Available" },
  Occupied: { dot: "bg-blue-500", tone: "bg-blue-50 text-blue-700 ring-blue-600/15", tile: "border-blue-200 bg-blue-50/70", label: "Occupied" },
  Dirty: { dot: "bg-amber-500", tone: "bg-amber-50 text-amber-700 ring-amber-600/20", tile: "border-amber-200 bg-amber-50/70", label: "Dirty" },
  Maintenance: { dot: "bg-rose-500", tone: "bg-rose-50 text-rose-700 ring-rose-600/15", tile: "border-rose-200 bg-rose-50/70", label: "Maintenance" },
  Blocked: { dot: "bg-slate-500", tone: "bg-slate-100 text-slate-700 ring-slate-600/15", tile: "border-slate-300 bg-slate-100/80", label: "Blocked" },
};

export const RES_STATUS = {
  Confirmed: { tone: "bg-sky-50 text-sky-700 ring-sky-600/15", bar: "bg-sky-500", dot: "bg-sky-500" },
  "On Hold": { tone: "bg-amber-50 text-amber-700 ring-amber-600/20", bar: "bg-amber-400", dot: "bg-amber-400" },
  "Checked In": { tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  "Checked Out": { tone: "bg-slate-100 text-slate-600 ring-slate-500/15", bar: "bg-slate-400", dot: "bg-slate-400" },
  Cancelled: { tone: "bg-zinc-100 text-zinc-500 ring-zinc-500/15 line-through decoration-zinc-400/60", bar: "bg-zinc-300", dot: "bg-zinc-400" },
  "No Show": { tone: "bg-rose-50 text-rose-700 ring-rose-600/15", bar: "bg-rose-400", dot: "bg-rose-500" },
};

export const PRIORITY = {
  Low: "bg-slate-100 text-slate-600 ring-slate-500/10",
  Normal: "bg-sky-50 text-sky-700 ring-sky-600/10",
  High: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Urgent: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export const floorLabel = (f) => (f === 0 ? "Ground floor" : `Floor ${f}`);
