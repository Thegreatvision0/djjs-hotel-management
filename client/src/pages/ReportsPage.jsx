import { useState } from "react";
import clsx from "clsx";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Download, Printer, MoonStar, ScrollText, BarChart3, CheckCircle2, Search, ChevronRight, X, Filter } from "lucide-react";
import { api } from "../api/client";
import { useApiMutation, useApiQuery, useMeta } from "../api/hooks";
import { PageHeader, Card, CardHeader, Button, Tabs, Loading, Empty, Toggle, Alert, Badge, Confirm, Modal, KV } from "../components/ui";
import { useReservationUI } from "../features/reservations/ReservationUI";
import { inr, fmtDate, fmtShort, fmtDateTime, addDays, toCSV, download, relTime } from "../lib/format";

const REPORTS = [
  { id: "revenue", label: "Revenue by day", range: true },
  { id: "collections", label: "Cashier / collections", range: true },
  { id: "occupancy", label: "Room status" },
  { id: "inhouse", label: "In-house guests" },
  { id: "arrivals", label: "Arrivals", range: true },
  { id: "departures", label: "Departures", range: true },
  { id: "property", label: "Property performance", range: true },
  { id: "sources", label: "Booking sources", range: true },
  { id: "cancellations", label: "Cancellations & no-shows", range: true },
  { id: "outstanding", label: "Outstanding & credits" },
  { id: "guests", label: "Guest register" },
];

const cell = (v, type) => (type === "money" ? inr(v) : type === "date" ? (v ? fmtDate(v) : "—") : type === "datetime" ? fmtDateTime(v) : v === "" || v == null ? "—" : v);

// Summary tiles can carry a row filter from the server: { key, in: [...] } or { key, gt|lt|ne: n }.
const matches = (f, r) => {
  const v = r[f.key];
  if (f.in) return f.in.includes(v);
  if (f.gt != null) return v > f.gt;
  if (f.lt != null) return v < f.lt;
  if (f.ne != null) return v !== f.ne;
  return true;
};
const fmtSummary = (s) => (s.type === "money" ? inr(s.value) : s.value);

// Full info for a report row that isn't a booking (days, rooms, properties, sources, guests).
function RowDetail({ report, row, onClose, onDrill }) {
  return (
    <Modal open onClose={onClose} title={report.title} subtitle={report.columns.slice(0, 1).map((c) => cell(row[c.key], c.type)).join("")}
      footer={<>
        {report.type === "revenue" && <Button variant="secondary" className="mr-auto" onClick={() => onDrill("collections", row.date)}>View collections on this day</Button>}
        {report.type === "occupancy" && row._resId && <Button variant="secondary" className="mr-auto" onClick={() => onDrill("reservation", row._resId)}>Open guest booking</Button>}
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </>}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        {report.columns.map((c) => (
          <KV key={c.key} label={c.label}>
            <span className={clsx(c.type === "money" && "tabular-nums font-medium", c.type === "money" && row[c.key] < 0 && "text-rose-600")}>{cell(row[c.key], c.type)}</span>
          </KV>
        ))}
      </dl>
    </Modal>
  );
}

function ReportView() {
  const { data: meta } = useMeta();
  const [type, setType] = useState("revenue");
  const [from, setFrom] = useState(addDays(meta.today, -29));
  const [to, setTo] = useState(meta.today);
  const [filter, setFilter] = useState(null); // summary tile currently applied
  const [detail, setDetail] = useState(null); // non-booking row
  const { openReservation } = useReservationUI();
  const def = REPORTS.find((r) => r.id === type);
  const pick = (t) => { setType(t); setFilter(null); };
  const { data, isLoading } = useApiQuery("audit", `/reports/${type}`, def.range ? { from, to } : undefined, { placeholderData: (p) => p });

  const rows = data ? (filter ? data.rows.filter((r) => matches(filter.filter, r)) : data.rows) : [];
  const openRow = (r) => (r._resId && data.type !== "occupancy" ? openReservation(r._resId) : setDetail(r));
  const drill = (kind, v) => {
    setDetail(null);
    if (kind === "reservation") return openReservation(v);
    pick(kind); setFrom(v); setTo(v);
  };
  const exportCsv = () => download(`${type}_${from}_${to}.csv`, toCSV(data.columns, rows.map((r) => Object.fromEntries(data.columns.map((c) => [c.key, c.type === "money" ? r[c.key] : cell(r[c.key], c.type)])))));

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">
      <select className="input lg:hidden" value={type} onChange={(e) => pick(e.target.value)} aria-label="Report">
        {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <Card className="hidden h-fit p-2 lg:block">
        {REPORTS.map((r) => (
          <button key={r.id} onClick={() => pick(r.id)} className={clsx("block w-full rounded-lg px-3 py-2 text-left text-[13.5px] transition", type === r.id ? "bg-gold-50 font-medium text-gold-700" : "text-slate-600 hover:bg-slate-50")}>{r.label}</button>
        ))}
      </Card>
      <div className="min-w-0 space-y-4">
        <Card className="flex flex-wrap items-center gap-2 p-3 sm:gap-3">
          <h3 className="w-full text-[15px] font-semibold md:mr-auto md:w-auto">{data?.title || def.label}</h3>
          {def.range && (
            <>
              <input type="date" className="input w-auto min-w-0 flex-1 md:w-[150px] md:flex-none" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-slate-400">–</span>
              <input type="date" className="input w-auto min-w-0 flex-1 md:w-[150px] md:flex-none" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              <div className="flex gap-1">
                {[["7d", 6], ["30d", 29], ["90d", 89]].map(([l, n]) => <Button key={l} size="xs" variant="ghost" onClick={() => { setTo(meta.today); setFrom(addDays(meta.today, -n)); }}>{l}</Button>)}
              </div>
            </>
          )}
          <Button size="sm" variant="secondary" icon={Download} disabled={!rows.length} onClick={exportCsv}>CSV</Button>
          <Button size="sm" variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
        </Card>

        {isLoading && !data ? <Loading /> : data && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
              {data.summary.map((s) => {
                const active = filter?.label === s.label;
                // Tiles with a filter narrow the table; the rest clear it and show every row.
                return (
                  <button key={s.label} type="button" onClick={() => setFilter(s.filter && !active ? s : null)}
                    title={s.filter ? (active ? "Show all rows" : `Show only: ${s.label}`) : "Show all rows"}
                    className={clsx("card min-w-0 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-pop sm:px-4", active && "ring-2 ring-gold-400")}>
                    <p className="flex items-center gap-1 truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px]">{s.label}{s.filter && <Filter className="h-3 w-3 shrink-0" />}</p>
                    <p className="mt-0.5 truncate text-base font-semibold tabular-nums sm:text-lg">{fmtSummary(s)}</p>
                  </button>
                );
              })}
            </div>
            {filter && (
              <div className="flex items-center gap-2 text-[13px] text-slate-600">
                <Badge className="bg-gold-50 text-gold-700 ring-gold-600/20">{filter.label}</Badge>
                {rows.length} of {data.rows.length} rows
                <Button size="xs" variant="ghost" icon={X} onClick={() => setFilter(null)}>Clear</Button>
              </div>
            )}
            {data.chart && (
              <Card className="h-[220px] p-2 sm:h-[260px] sm:p-4">
                <ResponsiveContainer>
                  <BarChart data={data.rows}>
                    <CartesianGrid vertical={false} stroke="#eeebe3" />
                    <XAxis dataKey={data.chart.x} tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [inr(v), n === "net" ? "Net revenue" : "Collected"]} labelFormatter={(l) => fmtDate(l)} contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                    <Legend formatter={(v) => (v === "net" ? "Net revenue" : "Collected")} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="net" fill="#151b2b" radius={[4, 4, 0, 0]} maxBarSize={22} cursor="pointer" onClick={(d) => setDetail(d.payload)} />
                    <Bar dataKey="collected" fill="#c9a84c" radius={[4, 4, 0, 0]} maxBarSize={22} cursor="pointer" onClick={(d) => setDetail(d.payload)} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
            <Card className="overflow-hidden">
              {rows.length === 0 ? <Empty title={filter ? "No rows match this filter" : "No data for this period"} /> : (
                <div className="max-h-[560px] overflow-auto overscroll-contain scroll-thin">
                  <table className="table-base whitespace-nowrap">
                    <thead><tr>{data.columns.map((c) => <th key={c.key} className={clsx(c.type === "money" && "text-right")}>{c.label}</th>)}<th className="w-6" /></tr></thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} onClick={() => openRow(r)} className="cursor-pointer hover:bg-gold-50/40" title={r._resId && data.type !== "occupancy" ? "Open booking" : "Open details"}>
                          {data.columns.map((c) => <td key={c.key} className={clsx(c.type === "money" && "text-right tabular-nums", (c.type === "money" && r[c.key] < 0) && "text-rose-600")}>{cell(r[c.key], c.type)}</td>)}
                          <td className="pl-0"><ChevronRight className="h-4 w-4 text-slate-300" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
      {detail && data && <RowDetail report={data} row={detail} onClose={() => setDetail(null)} onDrill={drill} />}
    </div>
  );
}

function AuditList({ title, items, empty, tone }) {
  const { openReservation } = useReservationUI();
  return (
    <Card>
      <CardHeader title={title} action={<Badge className={items.length ? tone : undefined}>{items.length}</Badge>} />
      {items.length === 0 ? <p className="px-5 py-4 text-[13px] text-slate-400">{empty}</p> : (
        <ul className="divide-y divide-line">
          {items.map((r) => (
            <li key={r._id} role="button" tabIndex={0} onClick={() => openReservation(r._id)} onKeyDown={(e) => e.key === "Enter" && openReservation(r._id)}
              className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-[13px] transition hover:bg-gold-50/40 sm:px-5">
              <span><span className="font-medium">{r.guestName}</span><span className="block text-xs text-slate-500">{r.confirmationNo} · {r.room ? `Room ${r.room}` : "TBA"} · {fmtShort(r.checkIn)} → {fmtShort(r.checkOut)}</span></span>
              <span className="flex shrink-0 items-center gap-2">
                {r.balance !== 0 && <span className={clsx("text-xs font-medium", r.balance > 0 ? "text-rose-600" : "text-emerald-600")}>{inr(r.balance)}</span>}
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NightAuditView() {
  const { data, isLoading } = useApiQuery("audit", "/night-audit");
  const [opts, setOpts] = useState({ markNoShows: true, cancelExpiredHolds: true });
  const [confirm, setConfirm] = useState(false);
  const [showLast, setShowLast] = useState(false);
  const run = useApiMutation((b) => api.post("/night-audit", b), { success: "Night audit completed", onSuccess: () => setConfirm(false) });
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
        <MoonStar className="h-8 w-8 text-gold-500" />
        <div className="flex-1">
          <p className="text-[16px] font-semibold">Business date {fmtDate(data.businessDate)}</p>
          <p className="text-[13px] text-slate-500">
            {data.lastRun ? <button type="button" className="font-medium text-gold-700 underline-offset-2 hover:underline" onClick={() => setShowLast(true)}>Last run {fmtDate(data.lastRun.businessDate)} by {data.lastRun.runBy}</button> : "Never run"} · {data.inHouse} in-house
          </p>
        </div>
        {data.alreadyRun ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/15"><CheckCircle2 className="h-3 w-3" /> Completed for today</Badge> : (
          <div className="flex w-full flex-wrap items-center gap-4 md:w-auto">
            <Toggle checked={opts.markNoShows} onChange={(v) => setOpts({ ...opts, markNoShows: v })} label="Post no-shows" />
            <Toggle checked={opts.cancelExpiredHolds} onChange={(v) => setOpts({ ...opts, cancelExpiredHolds: v })} label="Release expired holds" />
            <Button onClick={() => setConfirm(true)}>Run night audit</Button>
          </div>
        )}
      </Card>
      <Alert tone="info">Room charges are posted for the whole stay at booking, so night audit doesn't add nightly charges. It closes the day: missed arrivals become no-shows (room charges voided), expired holds are released, and overstays are flagged.</Alert>
      <div className="grid gap-5 lg:grid-cols-2">
        <AuditList title="Missed arrivals → No Show" items={data.missedArrivals} empty="Every expected guest has arrived." tone="bg-rose-50 text-rose-700 ring-rose-600/15" />
        <AuditList title="Expired holds → Cancel" items={data.expiredHolds} empty="No expired holds." tone="bg-amber-50 text-amber-700 ring-amber-600/20" />
        <AuditList title="Overstays (flag only)" items={data.overstays} empty="No overstays." tone="bg-rose-50 text-rose-700 ring-rose-600/15" />
        <AuditList title="Still due out today" items={data.dueOut} empty="All departures checked out." tone="bg-violet-50 text-violet-700 ring-violet-600/15" />
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={() => run.mutate(opts)} loading={run.isPending} title="Run night audit?" confirmLabel="Run audit">
        This closes {fmtDate(data.businessDate)}. {opts.markNoShows && `${data.missedArrivals.length} booking(s) will be marked No Show. `}{opts.cancelExpiredHolds && `${data.expiredHolds.length} hold(s) will be cancelled. `}It can only run once per day.
      </Confirm>
      {showLast && data.lastRun && (
        <Modal open onClose={() => setShowLast(false)} size="sm" title={`Night audit · ${fmtDate(data.lastRun.businessDate)}`} subtitle={`Run by ${data.lastRun.runBy} · ${fmtDateTime(data.lastRun.createdAt)}`}>
          <dl className="grid grid-cols-2 gap-4">
            <KV label="In-house">{String(data.lastRun.summary?.inHouse ?? 0)}</KV>
            <KV label="No-shows posted">{String(data.lastRun.summary?.noShows ?? 0)}</KV>
            <KV label="Holds cancelled">{String(data.lastRun.summary?.holdsCancelled ?? 0)}</KV>
            <KV label="Overstays flagged">{String(data.lastRun.summary?.overstays ?? 0)}</KV>
            <KV label="Due out">{String(data.lastRun.summary?.dueOut ?? 0)}</KV>
          </dl>
        </Modal>
      )}
    </div>
  );
}

function AuditTrail() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [entry, setEntry] = useState(null);
  const { data, isLoading } = useApiQuery("audit", "/audit-logs", { q: q || undefined, type: type || undefined, limit: 300 }, { placeholderData: (p) => p });
  const types = ["booking", "checkin", "checkout", "payment", "room", "housekeeping", "pos", "audit", "user", "auth"];
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <div className="relative min-w-0 flex-1 basis-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search action or user…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      {isLoading ? <Loading /> : (
        <div className="max-h-[640px] overflow-auto scroll-thin">
          <table className="table-base">
            <thead><tr><th>When</th><th className="hidden sm:table-cell">User</th><th className="hidden md:table-cell">Type</th><th>Action</th><th className="w-6" /></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l._id} onClick={() => setEntry(l)} className="cursor-pointer hover:bg-gold-50/40">
                  <td className="whitespace-nowrap text-xs text-slate-500" title={fmtDateTime(l.at)}>{relTime(l.at)}</td>
                  <td className="hidden whitespace-nowrap text-[13px] sm:table-cell">{l.user}<span className="block text-[11px] text-slate-400">{l.role}</span></td>
                  <td className="hidden md:table-cell"><Badge>{l.type}</Badge></td>
                  <td className="min-w-[200px] text-[13px]">{l.action}<span className="mt-0.5 block text-[11px] text-slate-400 sm:hidden">{l.user}</span></td>
                  <td className="pl-0"><ChevronRight className="h-4 w-4 text-slate-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entry && (
        <Modal open onClose={() => setEntry(null)} title="Activity entry" subtitle={fmtDateTime(entry.at)}>
          <dl className="grid grid-cols-2 gap-4">
            <KV label="User">{entry.user}</KV>
            <KV label="Role">{entry.role}</KV>
            <KV label="Type"><Badge>{entry.type}</Badge></KV>
            <KV label="When">{`${fmtDateTime(entry.at)} (${relTime(entry.at)})`}</KV>
            <KV label="Action" className="col-span-2"><span className="whitespace-pre-wrap break-words">{entry.action}</span></KV>
            {entry.ref && <KV label="Reference" className="col-span-2"><span className="font-mono text-xs">{entry.ref}</span></KV>}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button size="sm" variant="secondary" icon={Search} onClick={() => { setQ(entry.user); setType(""); setEntry(null); }}>All activity by {entry.user}</Button>
            <Button size="sm" variant="secondary" icon={Filter} onClick={() => { setType(entry.type); setQ(""); setEntry(null); }}>All "{entry.type}" entries</Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState("reports");
  return (
    <>
      <PageHeader title="Reports & Audit" subtitle="Operational reports, end-of-day close and the full activity trail" />
      <Tabs className="mb-6 no-print" value={tab} onChange={setTab} tabs={[
        { value: "reports", label: "Reports", icon: BarChart3 },
        { value: "night", label: "Night audit", icon: MoonStar },
        { value: "trail", label: "Activity trail", icon: ScrollText },
      ]} />
      {tab === "reports" && <ReportView />}
      {tab === "night" && <NightAuditView />}
      {tab === "trail" && <AuditTrail />}
    </>
  );
}
