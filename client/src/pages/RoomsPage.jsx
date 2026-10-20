import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Search, Lock, Unlock, Wrench, Moon, Pencil, Star, CheckSquare, X, User, History } from "lucide-react";
import { api } from "../api/client";
import { useApiMutation, useApiQuery, useMeta } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { can } from "../lib/access";
import { useReservationUI } from "../features/reservations/ReservationUI";
import { PageHeader, Card, Button, Drawer, Modal, Input, Select, Textarea, Toggle, RoomStatusBadge, ResStatusBadge, PriorityBadge, Loading, Empty, Tabs, KV, Alert, Money } from "../components/ui";
import { ROOM_STATUS, floorLabel } from "../lib/status";
import { fmtDate, fmtShort, fmtDateTime, inr, addDays } from "../lib/format";

function RoomTile({ room, selectMode, selected, onClick, today }) {
  const s = ROOM_STATUS[room.status];
  const guest = room.currentReservation;
  const arriving = room.nextBooking?.checkIn === today;
  return (
    <button onClick={onClick}
      className={clsx("relative flex h-[88px] min-w-0 flex-col justify-between rounded-xl border p-2 text-left sm:h-[92px] sm:p-2.5 transition hover:-translate-y-0.5 hover:shadow-pop", s.tile, selected && "ring-2 ring-gold-400 ring-offset-1")}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[15px] font-semibold leading-none text-ink-900">{room.number}</span>
        <span className="flex items-center gap-1">
          {room.dnd && <Moon className="h-3.5 w-3.5 text-violet-600" title="Do not disturb" />}
          {room.openIssues > 0 && <Wrench className="h-3.5 w-3.5 text-rose-600" title={`${room.openIssues} open issue(s)`} />}
          {selectMode && <span className={clsx("h-4 w-4 rounded border", selected ? "border-gold-500 bg-gold-500" : "border-slate-300 bg-white")} />}
        </span>
      </div>
      <div className="min-w-0">
        {guest ? (
          <p className="truncate text-[12px] font-medium text-blue-900">{guest.isVIP && <Star className="mr-0.5 inline h-3 w-3 fill-gold-400 text-gold-400" />}{guest.guestName}</p>
        ) : arriving ? (
          <p className="truncate text-[12px] font-medium text-emerald-800">↘ {room.nextBooking.guestName}</p>
        ) : (
          <p className="text-[11.5px] text-slate-500">{room.type} · {inr(room.rate)}</p>
        )}
        <p className="flex items-center gap-1 text-[11px] text-slate-500"><span className={clsx("h-1.5 w-1.5 rounded-full", s.dot)} />{room.status}{guest && ` · till ${fmtShort(guest.checkOut)}`}</p>
      </div>
    </button>
  );
}

function RoomDrawer({ id, onClose }) {
  const { data: meta } = useMeta();
  const { user } = useAuth();
  const ui = useReservationUI();
  const openReservation = (rid) => can(user, "reservations") && ui.openReservation(rid);
  const [tab, setTab] = useState("details");
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["room", id], queryFn: () => api.get(`/rooms/${id}`) });
  const status = useApiMutation((b) => api.post(`/rooms/${id}/status`, b), { success: (r) => `Room ${r.number} → ${r.status}`, onSuccess: () => setNote("") });
  const dnd = useApiMutation(() => api.post(`/rooms/${id}/dnd`), {});
  const prio = useApiMutation((b) => api.post(`/rooms/${id}/cleaning-priority`, b), { success: "Cleaning priority updated" });
  const maint = useApiMutation(({ logId, ...b }) => api.patch(`/rooms/${id}/maintenance/${logId}`, b), { success: "Maintenance updated" });
  const unblock = useApiMutation(() => api.post("/rooms/unblock", { roomIds: [id] }), { success: "Block released" });

  if (isLoading) return <Drawer open onClose={onClose} title="Room"><Loading /></Drawer>;
  const { room, history, tasks } = data;
  const cur = room.currentReservation;
  const open = room.maintenance.filter((m) => m.status === "Open");
  const quickStatuses = ["Available", "Dirty", "Maintenance"].filter((s) => s !== room.status);

  return (
    <Drawer open onClose={onClose} width="max-w-xl"
      header={
        <div>
          <div className="flex items-center gap-2"><h2 className="font-display text-[22px] font-semibold leading-none sm:text-[26px]">Room {room.number}</h2><RoomStatusBadge status={room.status} /></div>
          <p className="mt-1 text-[13px] text-slate-500">{room.property.name} · {floorLabel(room.floor)} · {room.type} · {inr(room.rate)}/night · sleeps {room.maxOccupancy}</p>
        </div>
      }>
      <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
        {cur && (
          <button onClick={() => openReservation(cur._id)} className="card flex w-full items-center gap-3 p-4 text-left hover:shadow-pop">
            <User className="h-5 w-5 text-blue-600" />
            <span className="flex-1">
              <span className="block font-medium">{cur.guestName}{cur.isVIP && <Star className="ml-1 inline h-3 w-3 fill-gold-400 text-gold-400" />}</span>
              <span className="text-xs text-slate-500">{fmtDate(cur.checkIn)} → {fmtDate(cur.checkOut)} · {cur.adults}A {cur.children}C</span>
            </span>
            <span className="text-right text-xs">Balance<span className="block text-sm font-semibold"><Money value={cur.totals?.balance} colored /></span></span>
          </button>
        )}
        {room.status === "Blocked" && room.block && (
          <Alert tone="warn" icon={Lock} title={`Blocked ${fmtShort(room.block.from)} → ${fmtShort(room.block.to)}`}>
            {room.block.reason} · by {room.block.by}
            <div className="mt-2"><Button size="xs" variant="secondary" icon={Unlock} loading={unblock.isPending} onClick={() => unblock.mutate()}>Release block</Button></div>
          </Alert>
        )}

        <Tabs value={tab} onChange={setTab} tabs={[
          { value: "details", label: "Status" },
          { value: "maintenance", label: "Maintenance", count: open.length || undefined },
          { value: "history", label: "Stays", count: history.length },
          { value: "log", label: "Log" },
        ]} />

        {tab === "details" && (
          <div className="space-y-5">
            {room.status !== "Occupied" && room.status !== "Blocked" && (
              <Card className="space-y-3 p-4">
                <p className="text-[13px] font-semibold">Change status</p>
                <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {quickStatuses.map((s) => (
                    <Button key={s} size="sm" variant={s === "Available" ? "success" : "secondary"} loading={status.isPending && status.variables?.status === s} onClick={() => status.mutate({ status: s, note })}>
                      <span className={clsx("h-2 w-2 rounded-full", ROOM_STATUS[s].dot)} /> Mark {s.toLowerCase()}
                    </Button>
                  ))}
                </div>
                {room.status === "Dirty" && <p className="text-xs text-slate-500">Marking available also closes open cleaning tasks for this room.</p>}
              </Card>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {room.status === "Occupied" && <Toggle checked={room.dnd} onChange={() => dnd.mutate()} label="Do not disturb" description="Housekeeping will skip this room" />}
              <Select label="Cleaning priority" value={room.cleaningPriority} onChange={(e) => prio.mutate({ priority: e.target.value })} options={meta.priorities} />
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <KV label="Last cleaned">{room.lastCleanedAt && fmtDateTime(room.lastCleanedAt)}</KV>
              <KV label="Amenities">{room.amenities.map((a) => meta.amenities.find((x) => x.id === a)?.label || a).join(", ")}</KV>
              <KV label="Notes" className="col-span-2">{room.notes}</KV>
            </dl>
            {tasks.length > 0 && (
              <div>
                <p className="label">Open housekeeping tasks</p>
                {tasks.map((t) => <div key={t._id} className="flex items-center justify-between border-b border-line py-2 text-[13px]"><span>{t.task}{t.assignedTo && <span className="text-slate-500"> · {t.assignedTo}</span>}</span><PriorityBadge priority={t.priority} /></div>)}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={Wrench} onClick={() => setDialog("maint")}>Report issue</Button>
              {user.role === "Admin" && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setDialog("edit")}>Edit room</Button>}
            </div>
          </div>
        )}

        {tab === "maintenance" && (
          <div className="space-y-3">
            <Button size="sm" variant="secondary" icon={Wrench} onClick={() => setDialog("maint")}>Report issue</Button>
            {room.maintenance.length === 0 ? <Empty title="No maintenance history" /> : room.maintenance.map((m) => (
              <Card key={m._id} className={clsx("p-4", m.status === "Closed" && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{m.issue}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(m.createdAt)} · {m.reportedBy}{m.assignedTo && ` → ${m.assignedTo}`}</p>
                    {m.notes && <p className="mt-1 text-[13px] text-slate-600">{m.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <PriorityBadge priority={m.priority} />
                    {m.status === "Open" ? (
                      <Button size="xs" variant="success" onClick={() => maint.mutate({ logId: m._id, status: "Closed", returnToService: true })}>Resolve</Button>
                    ) : <span className="text-xs text-emerald-600">Resolved {fmtShort(m.closedAt?.slice(0, 10))}</span>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "history" && (history.length === 0 ? <Empty icon={History} title="No stays yet" /> : (
          <Card className="overflow-hidden">
            <table className="table-base">
              <tbody>
                {history.map((h) => (
                  <tr key={h._id} onClick={() => openReservation(h._id)} className="cursor-pointer hover:bg-gold-50/40">
                    <td><p className="font-medium">{h.guestName}</p><p className="text-xs text-slate-500">{fmtDate(h.checkIn)} → {fmtDate(h.checkOut)}</p></td>
                    <td><ResStatusBadge status={h.status} /></td>
                    <td className="text-right"><Money value={h.totals.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

        {tab === "log" && (
          <ol className="space-y-2">
            {[...room.statusLog].reverse().map((l, i) => (
              <li key={i} className="flex gap-3 text-[13px]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                <span className="flex-1">{l.from} → <b>{l.to}</b>{l.note && <span className="text-slate-500"> · {l.note}</span>}<span className="block text-xs text-slate-400">{fmtDateTime(l.at)} · {l.by}</span></span>
              </li>
            ))}
            {room.statusLog.length === 0 && <Empty title="No status changes yet" />}
          </ol>
        )}
      </div>
      {dialog === "maint" && <MaintenanceDialog room={room} onClose={() => setDialog(null)} />}
      {dialog === "edit" && <EditRoomDialog room={room} onClose={() => setDialog(null)} />}
    </Drawer>
  );
}

function MaintenanceDialog({ room, onClose }) {
  const { data: meta } = useMeta();
  const [f, setF] = useState({ issue: "", priority: "Normal", assignedTo: "", notes: "", takeOutOfService: room.status !== "Occupied" });
  const m = useApiMutation((b) => api.post(`/rooms/${room._id}/maintenance`, b), { success: "Issue logged", onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title={`Report issue — Room ${room.number}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={f.issue.trim().length < 3} onClick={() => m.mutate(f)}>Log issue</Button></>}>
      <div className="space-y-4">
        <Input label="Issue" required value={f.issue} onChange={(e) => setF({ ...f, issue: e.target.value })} placeholder="e.g. AC not cooling" autoFocus />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={meta.priorities} />
          <Input label="Assigned to" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })} />
        </div>
        <Textarea label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        {room.status === "Occupied" ? <Alert tone="info">Room is occupied — it stays in service; the issue is queued.</Alert> : <Toggle checked={f.takeOutOfService} onChange={(v) => setF({ ...f, takeOutOfService: v })} label="Take room out of service" description="Sets status to Maintenance until resolved" />}
      </div>
    </Modal>
  );
}

function EditRoomDialog({ room, onClose }) {
  const { data: meta } = useMeta();
  const [f, setF] = useState({ type: room.type, rate: room.rate, maxOccupancy: room.maxOccupancy, amenities: room.amenities, notes: room.notes || "" });
  const m = useApiMutation((b) => api.patch(`/rooms/${room._id}`, b), { success: "Room updated", onSuccess: onClose });
  const toggle = (a) => setF({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] });
  return (
    <Modal open onClose={onClose} title={`Edit Room ${room.number}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate({ ...f, rate: Number(f.rate), maxOccupancy: Number(f.maxOccupancy) })}>Save</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={meta.roomTypes} />
          <Input label="Rate (₹/night)" type="number" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} />
          <Input label="Max occupancy" type="number" min={1} value={f.maxOccupancy} onChange={(e) => setF({ ...f, maxOccupancy: e.target.value })} />
        </div>
        <p className="text-xs text-slate-500">Rate changes apply to new bookings; existing bookings keep their locked rate.</p>
        <div>
          <p className="label">Amenities</p>
          <div className="flex flex-wrap gap-1.5">
            {meta.amenities.map((a) => (
              <button key={a.id} type="button" onClick={() => toggle(a.id)} className={clsx("chip", f.amenities.includes(a.id) ? "border-gold-400 bg-gold-50 text-gold-700" : "border-line text-slate-500")}>{a.label}</button>
            ))}
          </div>
        </div>
        <Textarea label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </Modal>
  );
}

function BlockDialog({ rooms, onClose, onDone }) {
  const { data: meta } = useMeta();
  const [f, setF] = useState({ from: meta.today, to: addDays(meta.today, 1), reason: "" });
  const m = useApiMutation((b) => api.post("/rooms/block", b), { success: (d) => `${d.count} room(s) blocked`, onSuccess: () => { onDone(); onClose(); } });
  return (
    <Modal open onClose={onClose} title={`Block ${rooms.length} room${rooms.length === 1 ? "" : "s"}`} subtitle={rooms.map((r) => r.number).join(", ")}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={f.reason.trim().length < 3} onClick={() => m.mutate({ ...f, roomIds: rooms.map((r) => r._id) })}>Block rooms</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="From" type="date" min={meta.today} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <Input label="To" type="date" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </div>
        <Input label="Reason" required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Reserved for event, renovation" />
        <p className="text-xs text-slate-500">Rooms with bookings in this period can't be blocked — move those bookings first.</p>
      </div>
    </Modal>
  );
}

export default function RoomsPage() {
  const { data: meta } = useMeta();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const roomId = params.get("room");
  const [status, setStatus] = useState(params.get("status") || "");
  const [propertyId, setPropertyId] = useState("");
  const [q, setQ] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [blockOpen, setBlockOpen] = useState(false);
  const { data, isLoading } = useApiQuery("rooms", "/rooms");
  const all = data?.items || [];
  const unblock = useApiMutation(() => api.post("/rooms/unblock", { roomIds: [...sel] }), { success: "Blocks released", onSuccess: () => setSel(new Set()) });

  const rooms = all.filter((r) => (!status || r.status === status) && (!propertyId || r.property._id === propertyId) && (!q || r.number.toLowerCase().includes(q.toLowerCase()) || r.currentReservation?.guestName?.toLowerCase().includes(q.toLowerCase())));
  const counts = useMemo(() => all.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}), [all]);
  const groups = useMemo(() => {
    const g = [];
    rooms.forEach((r) => {
      const key = `${r.property.name}|${r.floor}`;
      if (!g.length || g.at(-1).key !== key) g.push({ key, property: r.property.name, floor: r.floor, rooms: [] });
      g.at(-1).rooms.push(r);
    });
    return g;
  }, [rooms]);
  const selectedRooms = all.filter((r) => sel.has(r._id));
  const canBlock = can(user, "reservations");

  const click = (r) => {
    if (selectMode) setSel((s) => { const n = new Set(s); n.has(r._id) ? n.delete(r._id) : n.add(r._id); return n; });
    else setParams((p) => { p.set("room", r._id); return p; });
  };

  return (
    <>
      <PageHeader title="Rooms" subtitle={`${all.length} rooms · live status across all properties`}
        actions={canBlock && (selectMode ? (
          <>
            <span className="text-[13px] text-slate-500">{sel.size} selected</span>
            <Button variant="secondary" icon={Unlock} disabled={!selectedRooms.some((r) => r.status === "Blocked")} loading={unblock.isPending} onClick={() => unblock.mutate()}>Release</Button>
            <Button icon={Lock} disabled={!sel.size} onClick={() => setBlockOpen(true)}>Block</Button>
            <Button variant="ghost" icon={X} onClick={() => { setSelectMode(false); setSel(new Set()); }}>Done</Button>
          </>
        ) : <Button variant="secondary" icon={CheckSquare} onClick={() => setSelectMode(true)}>Select rooms</Button>)} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scroll-thin sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <button onClick={() => setStatus("")} className={clsx("chip shrink-0", !status ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-slate-600")}>All <span className="opacity-70">{all.length}</span></button>
        {Object.keys(ROOM_STATUS).map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)} className={clsx("chip shrink-0", status === s ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-slate-600")}>
            <span className={clsx("h-2 w-2 rounded-full", ROOM_STATUS[s].dot)} />{s}<span className="opacity-70">{counts[s] || 0}</span>
          </button>
        ))}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:ml-auto lg:flex">
          <select className="input lg:w-auto" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">All properties</option>
            {meta.properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 lg:w-[200px]" placeholder="Room or guest" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {isLoading ? <Loading /> : groups.length === 0 ? <Card><Empty title="No rooms match" /></Card> : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="mb-2.5 flex items-baseline gap-2 text-[13px] font-semibold text-ink-900">{g.property}<span className="font-normal text-slate-500">· {floorLabel(g.floor)} · {g.rooms.length} rooms</span></h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(102px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))] sm:gap-2.5 2xl:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
                {g.rooms.map((r) => <RoomTile key={r._id} room={r} today={meta.today} selectMode={selectMode} selected={sel.has(r._id)} onClick={() => click(r)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {roomId && <RoomDrawer id={roomId} onClose={() => setParams((p) => { p.delete("room"); return p; })} />}
      {blockOpen && <BlockDialog rooms={selectedRooms} onClose={() => setBlockOpen(false)} onDone={() => { setSel(new Set()); setSelectMode(false); }} />}
    </>
  );
}
