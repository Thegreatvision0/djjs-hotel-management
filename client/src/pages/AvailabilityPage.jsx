import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { useApiQuery, useMeta } from "../api/hooks";
import { useReservationUI } from "../features/reservations/ReservationUI";
import { PageHeader, Button, Card, Loading, Segmented } from "../components/ui";
import { RES_STATUS, ROOM_STATUS, floorLabel } from "../lib/status";
import { addDays, nightsBetween } from "../lib/format";

const MIN_CELL = 44;
const ROOM_COL_WIDE = 132;
const ROOM_COL_NARROW = 84;

export default function AvailabilityPage() {
  const { data: meta } = useMeta();
  const { openReservation, openNew } = useReservationUI();
  const [from, setFrom] = useState(addDays(meta.today, -1));
  const [days, setDays] = useState(14);
  const [propertyId, setPropertyId] = useState(meta.properties[0]?._id || "");
  const [roomType, setRoomType] = useState("");
  const { data, isLoading } = useApiQuery("availability", "/reservations/availability", { from, days, propertyId: propertyId || undefined, roomType: roomType || undefined }, { placeholderData: (p) => p });

  // Cells stretch to fill the card, but never shrink below MIN_CELL (then it scrolls).
  const boxRef = useRef(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    if (!boxRef.current) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [isLoading]);
  const ROOM_COL = boxW && boxW < 640 ? ROOM_COL_NARROW : ROOM_COL_WIDE;
  const CELL = Math.max(boxW && boxW < 640 ? 40 : MIN_CELL, Math.floor((boxW - ROOM_COL) / days) || MIN_CELL);

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(from, i)), [from, days]);
  const to = addDays(from, days);
  const byRoom = useMemo(() => {
    const m = {};
    (data?.bookings || []).forEach((b) => { if (b.room) (m[b.room] ||= []).push(b); });
    return m;
  }, [data]);
  const unassigned = (data?.bookings || []).filter((b) => !b.room && b.status !== "Checked Out");

  const freeOn = (d) => (data?.rooms || []).filter((r) => !["Maintenance", "Blocked"].includes(r.status) && !(byRoom[r._id] || []).some((b) => b.status !== "Checked Out" && b.checkIn <= d && b.checkOut > d)).length;

  const groups = useMemo(() => {
    const g = [];
    (data?.rooms || []).forEach((r) => {
      const key = `${r.property.name} · ${floorLabel(r.floor)}`;
      if (!g.length || g.at(-1).key !== key) g.push({ key, rooms: [] });
      g.at(-1).rooms.push(r);
    });
    return g;
  }, [data]);

  return (
    <>
      <PageHeader title="Availability" subtitle="Room-by-room timeline — click an empty night to book it"
        actions={<Button icon={Plus} onClick={() => openNew({ propertyId })}>New booking</Button>} />

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3 sm:gap-3">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => setFrom(addDays(from, -7))} aria-label="Previous week" />
          <Button variant="secondary" size="sm" onClick={() => setFrom(addDays(meta.today, -1))}>Today</Button>
          <Button variant="secondary" size="sm" icon={ChevronRight} onClick={() => setFrom(addDays(from, 7))} aria-label="Next week" />
        </div>
        <input type="date" className="input w-auto flex-1 sm:w-[160px] sm:flex-none" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <Segmented size="sm" value={days} onChange={setDays} options={[{ value: 7, label: "7 days" }, { value: 14, label: "14 days" }, { value: 30, label: "30 days" }]} />
        <select className="input w-auto min-w-0 flex-1 sm:flex-none" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">All properties</option>
          {meta.properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <select className="input w-auto min-w-0 flex-1 sm:flex-none" value={roomType} onChange={(e) => setRoomType(e.target.value)}>
          <option value="">All types</option>
          {meta.roomTypes.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div className="flex w-full flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 xl:ml-auto xl:w-auto">
          {["Confirmed", "On Hold", "Checked In", "Checked Out"].map((s) => <span key={s} className="flex items-center gap-1.5"><span className={clsx("h-2.5 w-4 rounded-sm", RES_STATUS[s].bar)} />{s}</span>)}
        </div>
      </Card>

      {unassigned.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
          <b>{unassigned.length} booking{unassigned.length === 1 ? "" : "s"} without a room:</b>
          {unassigned.map((b) => <button key={b._id} onClick={() => openReservation(b._id)} className="rounded-md bg-white px-2 py-0.5 text-xs font-medium ring-1 ring-amber-200 hover:ring-amber-400">{b.guestName} · {b.roomType}</button>)}
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading && !data ? <Loading /> : (
          <div ref={boxRef} className="max-h-[calc(100dvh-220px)] overflow-auto overscroll-contain scroll-thin sm:max-h-[calc(100dvh-290px)]">
            <div style={{ width: ROOM_COL + CELL * days }} className="relative">
              {/* Header */}
              <div className="sticky top-0 z-20 flex border-b border-line bg-[#faf9f6]">
                <div style={{ width: ROOM_COL }} className="sticky left-0 z-10 shrink-0 border-r border-line bg-[#faf9f6] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Room</div>
                {dates.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const isToday = d === meta.today;
                  const weekend = [0, 6].includes(dt.getDay());
                  return (
                    <div key={d} style={{ width: CELL }} className={clsx("shrink-0 border-r border-line/60 py-1.5 text-center", isToday && "bg-gold-100", weekend && !isToday && "bg-slate-50")}>
                      <p className="text-[10px] uppercase text-slate-400">{dt.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2)}</p>
                      <p className={clsx("text-[13px] font-semibold", isToday ? "text-gold-700" : "text-ink-900")}>{dt.getDate()}</p>
                      <p className="text-[9.5px] text-emerald-600" title="Rooms free">{freeOn(d)}</p>
                    </div>
                  );
                })}
              </div>

              {groups.map((g) => (
                <div key={g.key}>
                  <div className="sticky left-0 z-10 border-b border-line bg-slate-50/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ width: ROOM_COL + CELL * days }}>{g.key}</div>
                  {g.rooms.map((room) => {
                    const bookings = (byRoom[room._id] || []).filter((b) => b.checkOut > from && b.checkIn < to);
                    const outOfOrder = ["Maintenance", "Blocked"].includes(room.status);
                    return (
                      <div key={room._id} className="relative flex h-11 border-b border-line/60">
                        <div style={{ width: ROOM_COL }} className="sticky left-0 z-10 flex shrink-0 items-center justify-between gap-1 border-r border-line bg-white px-2 sm:gap-2 sm:px-3">
                          <span className="min-w-0 truncate"><span className="text-[13px] font-semibold sm:text-[13.5px]">{room.number}</span><span className="ml-1 text-[11px] text-slate-400 sm:ml-1.5">{room.type[0]}</span></span>
                          <span className={clsx("h-2 w-2 rounded-full", ROOM_STATUS[room.status]?.dot)} title={room.status} />
                        </div>
                        {dates.map((d) => (
                          <button key={d} style={{ width: CELL }} disabled={outOfOrder || d < meta.today}
                            onClick={() => openNew({ propertyId: room.property._id, roomId: room._id, roomType: room.type, checkIn: d })}
                            className={clsx("group shrink-0 border-r border-line/40", d === meta.today && "bg-gold-50/60", outOfOrder ? "bg-[repeating-linear-gradient(135deg,#f1f5f9,#f1f5f9_4px,#e2e8f0_4px,#e2e8f0_8px)]" : d >= meta.today && "hover:bg-gold-100/70")}
                            title={outOfOrder ? room.status : `Book ${room.number} from ${d}`}>
                            {!outOfOrder && d >= meta.today && <Plus className="mx-auto h-3.5 w-3.5 text-gold-500 opacity-0 group-hover:opacity-100" />}
                          </button>
                        ))}
                        {bookings.map((b) => {
                          const start = Math.max(0, nightsBetween(from, b.checkIn));
                          const end = Math.min(days, nightsBetween(from, b.checkOut));
                          const left = ROOM_COL + start * CELL + (b.checkIn >= from ? CELL / 2 : 0);
                          const width = (end - start) * CELL - (b.checkIn >= from ? CELL / 2 : 0) + (b.checkOut <= to ? CELL / 2 : 0) - 3;
                          if (width <= 0) return null;
                          return (
                            <button key={b._id} onClick={() => openReservation(b._id)} style={{ left, width }}
                              className={clsx("absolute top-1.5 z-[5] flex h-8 items-center gap-1 overflow-hidden rounded-md px-2 text-left text-[12px] font-medium text-white shadow-sm ring-1 ring-black/5 transition hover:brightness-110", RES_STATUS[b.status]?.bar, b.status === "On Hold" && "text-amber-950")}
                              title={`${b.guestName} · ${b.checkIn} → ${b.checkOut} · ${b.status}`}>
                              {b.isVIP && <Star className="h-3 w-3 shrink-0 fill-current" />}
                              <span className="truncate">{b.guestName}</span>
                              {b.totals?.balance > 0 && b.status !== "Confirmed" && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-rose-200" title="Balance due" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
