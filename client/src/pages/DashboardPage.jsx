import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { BedDouble, LogIn, LogOut, Wallet, AlertTriangle, Plus, CalendarDays, Activity, Sparkles, Star } from "lucide-react";
import { useApiQuery } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { useReservationUI } from "../features/reservations/ReservationUI";
import { PageHeader, Stat, Card, CardHeader, Button, Loading, ResStatusBadge, Empty, Money } from "../components/ui";
import { ROOM_STATUS } from "../lib/status";
import { inr, fmtShort, relTime, fmtDate } from "../lib/format";

function GuestRow({ r, time, onOpen }) {
  return (
    <button onClick={() => onOpen(r._id)} className="flex w-full items-center gap-2 border-b border-line/70 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50 sm:gap-3 sm:px-5">
      <span className="w-10 shrink-0 font-mono text-xs text-slate-500 sm:w-12">{time || "—"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink-900">{r.guestName}{r.isVIP && <Star className="ml-1 inline h-3 w-3 fill-gold-400 text-gold-400" />}</span>
        <span className="text-xs text-slate-500">{r.room ? `Room ${r.room.number}` : `${r.roomType || ""} · room TBA`}</span>
      </span>
      {r.totals?.balance > 0 && <span className="hidden whitespace-nowrap text-xs font-medium text-rose-600 min-[420px]:inline">{inr(r.totals.balance)} due</span>}
      <ResStatusBadge status={r.status} />
    </button>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { openReservation, openNew } = useReservationUI();
  const { data: d, isLoading } = useApiQuery("dashboard", "/dashboard", undefined, { refetchInterval: 60_000 });
  if (isLoading || !d) return <Loading />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const pendingArrivals = d.arrivals.filter((a) => a.status !== "Checked In").length;
  const pendingDepartures = d.departures.filter((a) => a.status === "Checked In").length;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={<><Button variant="secondary" icon={CalendarDays} onClick={() => nav("/availability")}>Availability</Button><Button icon={Plus} onClick={() => openNew()}>New booking</Button></>}
      />

      {d.overstays > 0 && (
        <button onClick={() => nav("/reservations?filter=overstay")} className="mb-5 flex w-full items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-[13.5px] text-rose-800 hover:bg-rose-100/60">
          <AlertTriangle className="h-4 w-4" /> <b>{d.overstays}</b> guest{d.overstays === 1 ? " is" : "s are"} past their departure date. Review overstays →
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Occupancy" value={`${d.occupancyPct}%`} sub={`${d.statusCounts.Occupied || 0} of ${d.totalRooms} rooms · ${d.inHouse} in-house`} icon={BedDouble} onClick={() => nav("/rooms")} />
        <Stat label="Arrivals today" value={d.arrivals.length} sub={`${pendingArrivals} still to arrive`} icon={LogIn} accent="text-emerald-600" onClick={() => nav("/reservations?filter=duein")} />
        <Stat label="Departures today" value={d.departures.length} sub={`${pendingDepartures} yet to check out`} icon={LogOut} accent="text-violet-600" onClick={() => nav("/reservations?filter=dueout")} />
        <Stat label="Collected today" value={inr(d.collectedToday)} sub={d.pendingCollection.count ? `${inr(d.pendingCollection.amount)} pending from ${d.pendingCollection.count} departed` : "No pending collections"} icon={Wallet} accent="text-sky-600" onClick={() => nav("/billing")} />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader title="Last 7 days" subtitle="Collections (bars) and occupancy (line)" icon={Activity} />
          <div className="h-[220px] px-1 py-3 sm:h-[260px] sm:px-2 sm:py-4 2xl:h-[300px]">
            <ResponsiveContainer>
              <ComposedChart data={d.trend} margin={{ left: 0, right: 4 }}>
                <CartesianGrid vertical={false} stroke="#eeebe3" />
                <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" width={48} tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" unit="%" domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip formatter={(v, n) => (n === "occupancy" ? [`${v}%`, "Occupancy"] : [inr(v), "Collected"])} labelFormatter={(l) => fmtDate(l)} contentStyle={{ borderRadius: 10, border: "1px solid #e8e5dc", fontSize: 13 }} />
                <Bar yAxisId="l" dataKey="collected" fill="#c9a84c" radius={[5, 5, 0, 0]} maxBarSize={36} />
                <Line yAxisId="r" dataKey="occupancy" stroke="#151b2b" strokeWidth={2} dot={{ r: 3, fill: "#151b2b" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader title="Room status" subtitle={`${d.totalRooms} rooms across ${d.properties.length} properties`} icon={BedDouble} />
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {Object.keys(ROOM_STATUS).map((s) => d.statusCounts[s] ? <div key={s} className={ROOM_STATUS[s].dot} style={{ width: `${(d.statusCounts[s] / d.totalRooms) * 100}%` }} title={`${s}: ${d.statusCounts[s]}`} /> : null)}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-2">
              {Object.keys(ROOM_STATUS).map((s) => (
                <button key={s} onClick={() => nav(`/rooms?status=${s}`)} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-slate-50">
                  <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${ROOM_STATUS[s].dot}`} />{s}</span>
                  <span className="font-semibold tabular-nums">{d.statusCounts[s] || 0}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2.5 border-t border-line pt-4">
              {d.properties.map((p) => (
                <div key={p.code}>
                  <div className="mb-1 flex justify-between text-[12.5px]"><span className="font-medium">{p.name}</span><span className="text-slate-500">{p.occupied}/{p.total} occupied · {p.available} free</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-ink-800" style={{ width: `${(p.occupied / p.total) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Arrivals" subtitle="Today" icon={LogIn} action={<Button size="xs" variant="ghost" onClick={() => nav("/reservations?filter=duein")}>All</Button>} />
          {d.arrivals.length ? d.arrivals.map((r) => <GuestRow key={r._id} r={r} time={r.eta} onOpen={openReservation} />) : <Empty title="No arrivals today" />}
        </Card>
        <Card>
          <CardHeader title="Departures" subtitle="Today" icon={LogOut} action={<Button size="xs" variant="ghost" onClick={() => nav("/reservations?filter=dueout")}>All</Button>} />
          {d.departures.length ? d.departures.map((r) => <GuestRow key={r._id} r={r} time={r.etd} onOpen={openReservation} />) : <Empty title="No departures today" />}
        </Card>
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader title="Recent activity" icon={Sparkles} subtitle={`${d.openTasks} open housekeeping task${d.openTasks === 1 ? "" : "s"}`} />
          <ul className="max-h-[360px] overflow-y-auto scroll-thin">
            {d.recent.map((l) => (
              <li key={l._id} className="border-b border-line/70 px-4 py-2.5 last:border-0 sm:px-5">
                <p className="text-[13px] leading-snug text-ink-800">{l.action}</p>
                <p className="mt-0.5 text-[11.5px] text-slate-400">{l.user} · {relTime(l.at)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {d.pendingCollection.count > 0 && (
        <p className="mt-6 text-center text-xs text-slate-400">Pending collection: <Money value={d.pendingCollection.amount} /> across {d.pendingCollection.count} departed guest{d.pendingCollection.count === 1 ? "" : "s"}</p>
      )}
    </>
  );
}
