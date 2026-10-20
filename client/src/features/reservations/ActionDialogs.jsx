import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, CalendarClock, Sparkles, CreditCard, BedDouble } from "lucide-react";
import { api } from "../../api/client";
import { useApiMutation, useMeta } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { Modal, Button, Input, Select, Textarea, Toggle, Alert, RoomStatusBadge } from "../../components/ui";
import { inr, fmtDate, fmtDay, nightsBetween, addDays } from "../../lib/format";
import { FolioSummary, PaymentDialog } from "../billing/FolioPanel";

function RoomPicker({ rooms, value, onChange, currentId }) {
  if (!rooms) return <p className="py-4 text-center text-sm text-slate-500">Checking availability…</p>;
  if (!rooms.length) return <Alert tone="warn">No rooms are free for these dates in this property.</Alert>;
  return (
    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 scroll-thin min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
      {rooms.filter((r) => r._id !== currentId).map((r) => (
        <button key={r._id} type="button" onClick={() => onChange(r)}
          className={clsx("rounded-lg border p-2.5 text-left transition", value?._id === r._id ? "border-gold-400 bg-gold-50 ring-2 ring-gold-200" : "border-line bg-white hover:border-slate-300")}>
          <p className="text-[15px] font-semibold text-ink-900">{r.number}</p>
          <p className="text-[11px] text-slate-500">{r.type} · {inr(r.rate)}</p>
          {r.status !== "Available" && <div className="mt-1"><RoomStatusBadge status={r.status} /></div>}
        </button>
      ))}
    </div>
  );
}

const useFreeRooms = (res, from, to, enabled = true) =>
  useQuery({
    queryKey: ["freeRooms", res.property._id, from, to, res._id],
    queryFn: () => api.get("/reservations/free-rooms", { params: { propertyId: res.property._id, checkIn: from, checkOut: to, excludeId: res._id } }),
    enabled: enabled && from < to,
  });

// ── Check-in ─────────────────────────────────────────────────────────────────
export function CheckInDialog({ res, onClose }) {
  const { data: meta } = useMeta();
  const today = meta.today;
  const early = res.checkIn > today;
  const extraNights = early ? nightsBetween(today, res.checkIn) : 0;
  const [chargeExtra, setChargeExtra] = useState(true);
  const [room, setRoom] = useState(res.room ? { _id: res.room._id, number: res.room.number, status: res.room.status, rate: res.room.rate } : null);
  const [changing, setChanging] = useState(!res.room);
  const [allowDirty, setAllowDirty] = useState(false);
  const { data } = useFreeRooms(res, early ? today : res.checkIn, res.checkOut, changing);
  const dirty = room && room.status === "Dirty";
  const blocked = room && ["Occupied", "Maintenance", "Blocked"].includes(room.status);
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/check-in`, b), { success: `${res.guestName} checked in`, onSuccess: onClose });

  return (
    <Modal open onClose={onClose} title={`Check in ${res.guestName}`} subtitle={`${res.confirmationNo} · ${fmtDate(res.checkIn)} → ${fmtDate(res.checkOut)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="success" loading={m.isPending} disabled={!room || blocked || (dirty && !allowDirty)}
          onClick={() => m.mutate({ roomId: room._id, shiftToToday: early || undefined, chargeExtraNights: chargeExtra, allowDirty })}>Confirm check-in</Button></>}>
      <div className="space-y-4">
        {early && (
          <Alert tone="warn" icon={CalendarClock} title={`Early arrival — booked from ${fmtDay(res.checkIn)}`}>
            <p className="mb-2">Check-in moves to today, adding {extraNights} night{extraNights === 1 ? "" : "s"}.</p>
            <Toggle checked={chargeExtra} onChange={setChargeExtra} label={`Charge extra night${extraNights === 1 ? "" : "s"} (${inr(extraNights * res.rate)})`} description="Turn off to make the extra nights complimentary" />
          </Alert>
        )}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="label mb-0">Room</p>
            {res.room && <Button size="xs" variant="ghost" onClick={() => setChanging(!changing)}>{changing ? "Keep assigned room" : "Assign a different room"}</Button>}
          </div>
          {changing ? <RoomPicker rooms={data?.rooms} value={room} onChange={setRoom} /> : (
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
              <span className="flex items-center gap-2 font-semibold"><BedDouble className="h-4 w-4 text-gold-500" /> Room {room?.number}</span>
              <RoomStatusBadge status={room?.status} />
            </div>
          )}
        </div>
        {blocked && <Alert tone="danger" icon={AlertTriangle}>Room {room.number} is {room.status.toLowerCase()}. Choose another room.</Alert>}
        {dirty && (
          <Alert tone="warn" icon={Sparkles} title={`Room ${room.number} hasn't been cleaned yet`}>
            <Toggle checked={allowDirty} onChange={setAllowDirty} label="Room has been inspected and is ready" />
          </Alert>
        )}
        <FolioSummary totals={res.totals} compact />
        {res.specialRequests && <Alert tone="info" title="Guest requests">{res.specialRequests}</Alert>}
      </div>
    </Modal>
  );
}

// ── Check-out ────────────────────────────────────────────────────────────────
export function CheckOutDialog({ res, onClose }) {
  const { data: meta } = useMeta();
  const { user } = useAuth();
  const today = meta.today;
  const early = today < res.checkOut;
  const used = Math.max(1, nightsBetween(res.checkIn, today));
  const unused = Math.max(0, nightsBetween(res.checkIn, res.checkOut) - used);
  const [policy, setPolicy] = useState("full");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [paying, setPaying] = useState(false);
  const credit = early && policy !== "full" ? unused * res.rate : 0;
  const balanceAfter = Math.round((res.totals.balance - credit) * 100) / 100;
  const nothingPaid = (res.totals.paid || 0) <= 0;
  const needsAdmin = balanceAfter > 0 && nothingPaid && user.role !== "Admin";
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/check-out`, b), { success: `${res.guestName} checked out`, onSuccess: onClose });

  if (paying) return <PaymentDialog res={res} onClose={() => setPaying(false)} />;

  const policies = [
    { id: "full", label: "Charge full stay", sub: `No change — ${inr(res.totals.total)}` },
    { id: "actual", label: `Charge ${used} night${used === 1 ? "" : "s"} used`, sub: `Credit ${inr(unused * res.rate)} for ${unused} unused` },
    { id: "waive", label: "Waive remaining nights", sub: `Management waiver of ${inr(unused * res.rate)}` },
  ];

  return (
    <Modal open onClose={onClose} title={`Check out ${res.guestName}`} subtitle={`Room ${res.room?.number} · ${res.confirmationNo}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        {balanceAfter > 0 && <Button variant="secondary" icon={CreditCard} onClick={() => setPaying(true)}>Take payment</Button>}
        <Button variant="primary" loading={m.isPending} disabled={(balanceAfter > 0 && !overrideReason) || needsAdmin}
          onClick={() => m.mutate({ earlyPolicy: policy, overrideReason: balanceAfter > 0 ? overrideReason : "", overrideNote })}>Complete check-out</Button></>}>
      <div className="space-y-4">
        {early && unused > 0 && (
          <div>
            <p className="label">Early departure — {unused} night{unused === 1 ? "" : "s"} unused</p>
            <div className="space-y-2">
              {policies.map((p) => (
                <label key={p.id} className={clsx("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition", policy === p.id ? "border-gold-400 bg-gold-50/60" : "border-line hover:border-slate-300")}>
                  <input type="radio" className="mt-1 accent-gold-500" checked={policy === p.id} onChange={() => setPolicy(p.id)} />
                  <span><span className="block text-[13.5px] font-medium">{p.label}</span><span className="text-xs text-slate-500">{p.sub}</span></span>
                </label>
              ))}
            </div>
          </div>
        )}
        <FolioSummary totals={{ ...res.totals, discounts: res.totals.discounts + credit, total: res.totals.total - credit, balance: balanceAfter }} compact />
        {balanceAfter > 0 ? (
          <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-rose-800"><AlertTriangle className="h-4 w-4" /> {inr(balanceAfter)} is still outstanding</p>
            <p className="text-[13px] text-rose-900/80">Take payment now, or record why the guest may leave with a balance.</p>
            {needsAdmin && <Alert tone="danger">Nothing has been paid on this folio — only an Admin can authorise this checkout.</Alert>}
            <Select label="Override reason" required value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="— Select reason —" options={meta.checkoutOverrideReasons} />
            <Textarea label="Manager note" rows={2} value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} />
          </div>
        ) : balanceAfter < 0 ? (
          <Alert tone="success">Guest will have a credit of {inr(-balanceAfter)} — refund it from the folio after checkout.</Alert>
        ) : (
          <Alert tone="success">Folio is settled.</Alert>
        )}
        <p className="text-xs text-slate-500">The room will be marked Dirty and a checkout-clean task created for housekeeping.</p>
      </div>
    </Modal>
  );
}

// ── Extend ───────────────────────────────────────────────────────────────────
export function ExtendDialog({ res, onClose }) {
  const [newCheckOut, setNewCheckOut] = useState(addDays(res.checkOut, 1));
  const [reason, setReason] = useState("");
  const [charge, setCharge] = useState(true);
  const extra = Math.max(0, nightsBetween(res.checkOut, newCheckOut));
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/extend`, b), { success: "Stay extended", onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Extend stay" subtitle={`Currently departing ${fmtDay(res.checkOut)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={!extra} onClick={() => m.mutate({ newCheckOut, reason, charge })}>Extend by {extra} night{extra === 1 ? "" : "s"}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="New check-out" type="date" min={addDays(res.checkOut, 1)} value={newCheckOut} onChange={(e) => setNewCheckOut(e.target.value)} />
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Guest request" />
        </div>
        <Toggle checked={charge} onChange={setCharge} label={`Charge ${extra} extra night${extra === 1 ? "" : "s"} · ${inr(extra * res.rate)}`} description={`At the booked rate of ${inr(res.rate)}/night`} />
        {res.room && <p className="text-xs text-slate-500">The system checks Room {res.room.number} is free for the extra nights.</p>}
      </div>
    </Modal>
  );
}

// ── Room move ────────────────────────────────────────────────────────────────
export function MoveDialog({ res, onClose }) {
  const { data: meta } = useMeta();
  const from = res.status === "Checked In" ? meta.today : res.checkIn;
  const remaining = Math.max(1, nightsBetween(from, res.checkOut));
  const { data } = useFreeRooms(res, from, res.checkOut);
  const rooms = res.status === "Checked In" ? data?.rooms?.filter((r) => r.status === "Available") : data?.rooms;
  const [target, setTarget] = useState(null);
  const [adjust, setAdjust] = useState("0");
  const [useNewRate, setUseNewRate] = useState(false);
  const [reason, setReason] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const pick = (r) => {
    setTarget(r);
    setAdjust(String((r.rate - res.rate) * remaining));
  };
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/move`, b), { success: "Room changed", onSuccess: onClose });
  const isPreArrival = res.status !== "Checked In";

  return (
    <Modal open onClose={onClose} size="lg" title={res.room ? `Move from Room ${res.room.number}` : "Assign room"} subtitle={`${remaining} night${remaining === 1 ? "" : "s"} affected · ${res.property.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={m.isPending} disabled={!target} onClick={() => m.mutate({ roomId: target._id, rateAdjust: isPreArrival ? 0 : Number(adjust) || 0, newRate: isPreArrival || useNewRate ? target.rate : undefined, reason, authorizedBy })}>
          {res.room ? `Move to ${target?.number || "…"}` : `Assign ${target?.number || "…"}`}
        </Button></>}>
      <div className="space-y-4">
        <RoomPicker rooms={rooms} value={target} onChange={pick} currentId={res.room?._id} />
        {target && !isPreArrival && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Rate adjustment (₹)" type="number" value={adjust} onChange={(e) => setAdjust(e.target.value)} hint={`Suggested: (${inr(target.rate)} − ${inr(res.rate)}) × ${remaining}. Positive = upgrade charge, negative = credit, 0 = complimentary.`} />
            <Input label="Authorised by" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} />
            <Input label="Reason" className="sm:col-span-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. AC fault, guest upgrade request" />
            <div className="sm:col-span-2"><Toggle checked={useNewRate} onChange={setUseNewRate} label="Use the new room's rate for any future extensions" /></div>
          </div>
        )}
        {target && isPreArrival && target.rate !== res.rate && (
          <Alert tone="info">The booking will be re-rated to {inr(target.rate)}/night (room charge updated).</Alert>
        )}
      </div>
    </Modal>
  );
}

// ── Cancel / No-show ─────────────────────────────────────────────────────────
export function CloseBookingDialog({ res, kind, onClose }) {
  const isNoShow = kind === "no-show";
  const [fee, setFee] = useState(isNoShow ? String(Math.min(res.rate, res.totals.paid || 0)) : "0");
  const [reason, setReason] = useState("");
  const paid = res.totals.paid || 0;
  const refund = paid - (Number(fee) || 0);
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/${kind}`, b), { success: isNoShow ? "Marked as no-show" : "Booking cancelled", onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title={isNoShow ? "Mark as no-show" : "Cancel booking"} subtitle={`${res.guestName} · ${res.confirmationNo}`}
      footer={<><Button variant="secondary" onClick={onClose}>Keep booking</Button><Button variant="danger" loading={m.isPending} onClick={() => m.mutate({ fee: Number(fee) || 0, reason })}>{isNoShow ? "Post no-show" : "Cancel booking"}</Button></>}>
      <div className="space-y-4">
        <p className="text-[13.5px] text-slate-600">Room charges are voided{res.room ? ` and Room ${res.room.number} is released` : ""}. You can retain a fee against the advance.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={isNoShow ? "Retention fee (₹)" : "Cancellation fee (₹)"} type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} hint={`Advance paid: ${inr(paid)} · one night: ${inr(res.rate)}`} />
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {refund > 0 && <Alert tone="info">{inr(refund)} will be shown as a guest credit to refund.</Alert>}
        {refund < 0 && <Alert tone="warn">{inr(-refund)} of the fee will be outstanding (more than the advance paid).</Alert>}
      </div>
    </Modal>
  );
}
