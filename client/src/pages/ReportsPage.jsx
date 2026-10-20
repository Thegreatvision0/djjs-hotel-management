import { useState } from "react";
import clsx from "clsx";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Download, Printer, MoonStar, ScrollText, BarChart3, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { api } from "../api/client";
import { useApiMutation, useApiQuery, useMeta } from "../api/hooks";
import { PageHeader, Card, CardHeader, Button, Tabs, Loading, Empty, Toggle, Alert, Badge, Confirm } from "../components/ui";
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

function ReportView() {
  const { data: meta } = useMeta();
  const [type, setType] = useState("revenue");
  const [from, setFrom] = useState(addDays(meta.today, -29));
  const [to, setTo] = useState(meta.today);
  const def = REPORTS.find((r) => r.id === type);
  const { data, isLoading } = useApiQuery("audit", `/reports/${type}`, def.range ? { from, to } : undefined, { placeholderData: (p) => p });

  const exportCsv = () => download(`${type}_${from}_${to}.csv`, toCSV(data.columns, data.rows.map((r) => Object.fromEntries(data.columns.map((c) => [c.key, c.type === "money" ? r[c.key] : cell(r[c.key], c.type)])))));

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">
      <select className="input lg:hidden" value={type} onChange={(e) => setType(e.target.value)} aria-label="Report">
        {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <Card className="hidden h-fit p-2 lg:block">
        {REPORTS.map((r) => (
          <button key={r.id} onClick={() => setType(r.id)} className={clsx("block w-full rounded-lg px-3 py-2 text-left text-[13.5px] transition", type === r.id ? "bg-gold-50 font-medium text-gold-700" : "text-slate-600 hover:bg-slate-50")}>{r.label}</button>
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
          <Button size="sm" variant="secondary" icon={Download} disabled={!data?.rows?.length} onClick={exportCsv}>CSV</Button>
          <Button size="sm" variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
        </Card>

        {isLoading && !data ? <Loading /> : data && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
              {data.summary.map((s) => (
                <Card key={s.label} className="min-w-0 px-3 py-3 sm:px-4">
                  <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px]">{s.label}</p>
                  <p className="mt-0.5 truncate text-base font-semibold tabular-nums sm:text-lg">{s.type === "money" ? inr(s.value) : s.value}</p>
                </Card>
              ))}
            </div>
            {data.chart && (
              <Card className="h-[220px] p-2 sm:h-[260px] sm:p-4">
                <ResponsiveContainer>
                  <BarChart data={data.rows}>
                    <CartesianGrid vertical={false} stroke="#eeebe3" />
                    <XAxis dataKey={data.chart.x} tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [inr(v), n === "net" ? "Net revenue" : "Collected"]} labelFormatter={(l) => fmtDate(l)} contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                    <Legend formatter={(v) => (v === "net" ? "Net revenue" : "Collected")} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="net" fill="#151b2b" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="collected" fill="#c9a84c" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
            <Card className="overflow-hidden">
              {data.rows.length === 0 ? <Empty title="No data for this period" /> : (
                <div className="max-h-[560px] overflow-auto overscroll-contain scroll-thin">
                  <table className="table-base whitespace-nowrap">
                    <thead><tr>{data.columns.map((c) => <th key={c.key} className={clsx(c.type === "money" && "text-right")}>{c.label}</th>)}</tr></thead>
                    <tbody>
                      {data.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          {data.columns.map((c) => <td key={c.key} className={clsx(c.type === "money" && "text-right tabular-nums", (c.type === "money" && r[c.key] < 0) && "text-rose-600")}>{cell(r[c.key], c.type)}</td>)}
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
    </div>
  );
}

function AuditList({ title, items, empty, tone }) {
  return (
    <Card>
      <CardHeader title={title} action={<Badge className={items.length ? tone : undefined}>{items.length}</Badge>} />
      {items.length === 0 ? <p className="px-5 py-4 text-[13px] text-slate-400">{empty}</p> : (
        <ul className="divide-y divide-line">
          {items.map((r) => (
            <li key={r._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] sm:px-5">
              <span><span className="font-medium">{r.guestName}</span><span className="block text-xs text-slate-500">{r.confirmationNo} · {r.room ? `Room ${r.room}` : "TBA"} · {fmtShort(r.checkIn)} → {fmtShort(r.checkOut)}</span></span>
              {r.balance !== 0 && <span className={clsx("text-xs font-medium", r.balance > 0 ? "text-rose-600" : "text-emerald-600")}>{inr(r.balance)}</span>}
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
  const run = useApiMutation((b) => api.post("/night-audit", b), { success: "Night audit completed", onSuccess: () => setConfirm(false) });
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
        <MoonStar className="h-8 w-8 text-gold-500" />
        <div className="flex-1">
          <p className="text-[16px] font-semibold">Business date {fmtDate(data.businessDate)}</p>
          <p className="text-[13px] text-slate-500">{data.lastRun ? `Last run ${fmtDate(data.lastRun.businessDate)} by ${data.lastRun.runBy}` : "Never run"} · {data.inHouse} in-house</p>
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
    </div>
  );
}

function AuditTrail() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
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
            <thead><tr><th>When</th><th className="hidden sm:table-cell">User</th><th className="hidden md:table-cell">Type</th><th>Action</th></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l._id}>
                  <td className="whitespace-nowrap text-xs text-slate-500" title={fmtDateTime(l.at)}>{relTime(l.at)}</td>
                  <td className="hidden whitespace-nowrap text-[13px] sm:table-cell">{l.user}<span className="block text-[11px] text-slate-400">{l.role}</span></td>
                  <td className="hidden md:table-cell"><Badge>{l.type}</Badge></td>
                  <td className="min-w-[200px] text-[13px]">{l.action}<span className="mt-0.5 block text-[11px] text-slate-400 sm:hidden">{l.user}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
