import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Plus, Search, Star, ArrowUpDown, ArrowUp, ArrowDown, CalendarRange, X } from "lucide-react";
import { useApiQuery, useMeta } from "../api/hooks";
import { useReservationUI } from "../features/reservations/ReservationUI";
import { PageHeader, Button, Card, ResStatusBadge, Empty, Loading, Money, Avatar } from "../components/ui";
import { fmtDate, nightsBetween } from "../lib/format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "duein", label: "Due in" },
  { id: "dueout", label: "Due out" },
  { id: "inhouse", label: "In-house" },
  { id: "upcoming", label: "Confirmed" },
  { id: "onhold", label: "On hold" },
  { id: "overstay", label: "Overstay", danger: true },
  { id: "arrived", label: "Arrived today" },
  { id: "departed", label: "Departed today" },
  { id: "checkedout", label: "Checked out" },
  { id: "vip", label: "VIP" },
  { id: "noshow", label: "No show" },
  { id: "cancelled", label: "Cancelled" },
];

const COLS = [
  { key: "guest", label: "Guest", sort: "guest" },
  { key: "room", label: "Room" },
  { key: "checkIn", label: "Arrival", sort: "checkIn" },
  { key: "checkOut", label: "Departure", sort: "checkOut", hide: "hidden lg:table-cell" },
  { key: "status", label: "Status", sort: "status" },
  { key: "total", label: "Total", sort: "total", right: true, hide: "hidden xl:table-cell" },
  { key: "balance", label: "Balance", sort: "balance", right: true },
];

export default function ReservationsPage() {
  const { data: meta } = useMeta();
  const { openReservation, openNew } = useReservationUI();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") || "all";
  const [q, setQ] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState({ by: "checkIn", dir: "asc" });

  const { data, isLoading } = useApiQuery("reservations", "/reservations", { filter, q: q || undefined, propertyId: propertyId || undefined, from: from || undefined, to: to || undefined, sort: sort.by, dir: sort.dir }, { placeholderData: (p) => p });
  const { data: counts } = useApiQuery("counts", "/reservations/counts");
  const items = data?.items || [];

  const setFilter = (id) => setParams((p) => { p.set("filter", id); p.delete("res"); return p; });
  const toggleSort = (by) => setSort((s) => ({ by, dir: s.by === by && s.dir === "asc" ? "desc" : "asc" }));
  const hasFilters = q || propertyId || from || to;

  return (
    <>
      <PageHeader title="Reservations" subtitle="Every booking, from enquiry to departure" actions={<Button icon={Plus} onClick={() => openNew()}>New booking</Button>} />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 scroll-thin sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const n = counts?.[f.id];
          if (f.danger && !n && !active) return null;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={clsx("chip shrink-0", active ? (f.danger ? "border-rose-600 bg-rose-600 text-white" : "border-ink-900 bg-ink-900 text-white") : f.danger ? "border-rose-200 bg-rose-50 text-rose-700" : "border-line bg-white text-slate-600 hover:border-slate-300")}>
              {f.label}
              {n != null && <span className={clsx("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", active ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{n}</span>}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 md:flex md:flex-wrap md:items-center">
          <div className="relative col-span-2 md:min-w-[220px] md:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search guest, phone, room, confirmation or group…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input col-span-2 sm:col-span-1 md:w-auto" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">All properties</option>
            {meta.properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <div className="col-span-2 flex min-w-0 items-center gap-1.5 sm:col-span-1">
            <CalendarRange className="hidden h-4 w-4 shrink-0 text-slate-400 md:block" />
            <input type="date" className="input flex-1 md:w-[150px] md:flex-none" value={from} onChange={(e) => setFrom(e.target.value)} title="Arrival from" aria-label="Arrival from" />
            <span className="text-slate-400">–</span>
            <input type="date" className="input flex-1 md:w-[150px] md:flex-none" value={to} onChange={(e) => setTo(e.target.value)} title="Arrival to" aria-label="Arrival to" />
          </div>
          {hasFilters && <Button variant="ghost" size="sm" icon={X} className="col-span-2 justify-self-start" onClick={() => { setQ(""); setPropertyId(""); setFrom(""); setTo(""); }}>Clear filters</Button>}
        </div>

        {isLoading ? <Loading /> : items.length === 0 ? (
          <Empty title="No bookings match">Try another filter, or create a new booking.</Empty>
        ) : (
          <>
          {/* Phones: card list */}
          <ul className="divide-y divide-line md:hidden">
            {items.map((r) => {
              const n = nightsBetween(r.checkIn, r.checkOut);
              return (
                <li key={r._id}>
                  <button onClick={() => openReservation(r._id)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-gold-50/60">
                    <Avatar name={r.guestName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-[14px] font-medium text-ink-900">{r.guestName}{r.isVIP && <Star className="ml-1 inline h-3 w-3 fill-gold-400 text-gold-400" />}</span>
                        <ResStatusBadge status={r.status} />
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-slate-600">
                        {r.room ? <b className="font-semibold text-ink-900">{r.room.number}</b> : <span className="text-amber-600">Room TBA</span>} · {r.property?.code} · {fmtDate(r.checkIn, { day: "numeric", month: "short" })} → {fmtDate(r.checkOut, { day: "numeric", month: "short" })} · {n}N
                      </span>
                      <span className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate font-mono">{r.confirmationNo}</span>
                        <span>{r.totals?.balance ? <Money value={r.totals.balance} colored className="font-semibold" /> : <span className="text-slate-400">Settled</span>}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Tablet & desktop: table (less important columns appear as space allows) */}
          <div className="table-scroll hidden md:block">
            <table className="table-base">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} className={clsx(c.right && "text-right", c.hide)}>
                      {c.sort ? (
                        <button onClick={() => toggleSort(c.sort)} className={clsx("inline-flex items-center gap-1 uppercase hover:text-ink-900", sort.by === c.sort && "text-ink-900")}>
                          {c.label}{sort.by === c.sort ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      ) : c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const n = nightsBetween(r.checkIn, r.checkOut);
                  return (
                    <tr key={r._id} onClick={() => openReservation(r._id)} className="cursor-pointer hover:bg-gold-50/40">
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.guestName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">{r.guestName}{r.isVIP && <Star className="ml-1 inline h-3 w-3 fill-gold-400 text-gold-400" />}</p>
                            <p className="truncate text-xs text-slate-500"><span className="font-mono">{r.confirmationNo}</span>{r.group?.id && ` · ${r.group.id}`}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {r.room ? <span className="font-semibold">{r.room.number}</span> : <span className="text-amber-600">TBA</span>}
                        <span className="block text-xs text-slate-500">{r.property?.code} · {r.roomType}</span>
                      </td>
                      <td className="whitespace-nowrap">{fmtDate(r.checkIn)}<span className="block text-xs text-slate-500">{n} night{n === 1 ? "" : "s"}<span className="lg:hidden"> · to {fmtDate(r.checkOut, { day: "numeric", month: "short" })}</span></span></td>
                      <td className="hidden whitespace-nowrap lg:table-cell">{fmtDate(r.checkOut)}</td>
                      <td><ResStatusBadge status={r.status} /></td>
                      <td className="hidden text-right xl:table-cell"><Money value={r.totals?.total} /></td>
                      <td className="text-right font-medium"><Money value={r.totals?.balance} colored /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        {items.length > 0 && <div className="border-t border-line px-4 py-2.5 text-xs text-slate-500">{items.length} booking{items.length === 1 ? "" : "s"}</div>}
      </Card>
    </>
  );
}
