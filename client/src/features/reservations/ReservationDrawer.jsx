import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  LogIn, LogOut, CalendarPlus, ArrowLeftRight, Pencil, XCircle, UserX, Printer, Star, Phone, BedDouble,
  CalendarDays, Users, Clock, FileText, Building2, MessageSquareText, Lock, ShieldAlert,
} from "lucide-react";
import { api } from "../../api/client";
import { useMeta } from "../../api/hooks";
import { Drawer, Button, Avatar, ResStatusBadge, Badge, KV, Tabs, Loading, Alert, Card } from "../../components/ui";
import { fmtDate, fmtDay, fmtDateTime, inr } from "../../lib/format";
import FolioPanel from "../billing/FolioPanel";
import { CheckInDialog, CheckOutDialog, ExtendDialog, MoveDialog, CloseBookingDialog } from "./ActionDialogs";
import { useReservationUI } from "./ReservationUI";

export default function ReservationDrawer({ id, onClose }) {
  const { data: meta } = useMeta();
  const { openEdit } = useReservationUI();
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState(null);
  const { data: res, isLoading, error } = useQuery({ queryKey: ["reservation", id], queryFn: () => api.get(`/reservations/${id}`) });

  if (isLoading || error || !res) {
    return <Drawer open onClose={onClose} title="Reservation">{error ? <div className="p-5"><Alert tone="danger">{error.message}</Alert></div> : <Loading />}</Drawer>;
  }

  const today = meta.today;
  const s = res.status;
  const pre = ["Confirmed", "On Hold"].includes(s);
  const inHouse = s === "Checked In";
  const closed = ["Checked Out", "Cancelled", "No Show"].includes(s);
  const g = res.guest || {};
  const overstay = inHouse && res.checkOut < today;
  const print = (kind) => window.open(`/print/${kind}/${res._id}`, "_blank");

  const header = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={res.guestName} size="lg" className="hidden min-[420px]:inline-flex" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-[17px] font-semibold text-ink-900 sm:text-[18px]">{res.guestName}</h2>
          {res.isVIP && <Badge className="bg-gold-100 text-gold-700 ring-gold-400/30"><Star className="h-3 w-3 fill-current" /> VIP</Badge>}
          <ResStatusBadge status={s} />
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-slate-500">
          <span className="font-mono text-ink-700">{res.confirmationNo}</span>
          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{res.guestMobile}</span>
        </p>
      </div>
    </div>
  );

  const footer = (
    <>
      {pre && <Button variant="success" icon={LogIn} onClick={() => setDialog("checkin")}>Check in</Button>}
      {inHouse && <Button icon={LogOut} onClick={() => setDialog("checkout")}>Check out</Button>}
      {(pre || inHouse) && <Button variant="secondary" icon={CalendarPlus} onClick={() => setDialog("extend")}>Extend</Button>}
      {(pre || inHouse) && <Button variant="secondary" icon={ArrowLeftRight} onClick={() => setDialog("move")}>{res.room ? "Move room" : "Assign room"}</Button>}
      {(pre || inHouse) && <Button variant="ghost" icon={Pencil} onClick={() => openEdit(res)}>Edit</Button>}
      <div className="flex gap-1 sm:ml-auto">
        {pre && res.checkIn <= today && <Button variant="danger-ghost" icon={UserX} onClick={() => setDialog("no-show")}>No-show</Button>}
        {pre && <Button variant="danger-ghost" icon={XCircle} onClick={() => setDialog("cancel")}>Cancel</Button>}
        {closed && <Button variant="ghost" icon={Lock} disabled>Closed</Button>}
      </div>
    </>
  );

  return (
    <Drawer open onClose={onClose} header={header} footer={footer} width="max-w-3xl">
      <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
        {overstay && <Alert tone="danger" icon={ShieldAlert} title="Overstay">Departure was {fmtDay(res.checkOut)}. Extend the stay or check the guest out.</Alert>}
        {s === "On Hold" && res.holdUntil && <Alert tone="warn" icon={Clock}>On hold until {fmtDateTime(res.holdUntil)} — confirm with an advance or it will be released at night audit.</Alert>}

        <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
          {[
            { icon: Building2, label: "Property", value: res.property?.name },
            { icon: BedDouble, label: "Room", value: res.room ? `${res.room.number} · ${res.roomType}` : <span className="text-amber-600">{res.roomType} · TBA</span> },
            { icon: CalendarDays, label: `${res.nights} night${res.nights === 1 ? "" : "s"}`, value: `${fmtDate(res.checkIn, { day: "numeric", month: "short" })} → ${fmtDate(res.checkOut, { day: "numeric", month: "short" })}` },
            { icon: Users, label: "Guests", value: `${res.adults} adult${res.adults === 1 ? "" : "s"}${res.children ? ` · ${res.children} child` : ""}` },
          ].map((x) => (
            <div key={x.label} className="min-w-0 bg-white px-3 py-3 sm:px-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><x.icon className="h-3.5 w-3.5" />{x.label}</p>
              <p className="mt-1 text-[13.5px] font-medium text-ink-900">{x.value}</p>
            </div>
          ))}
        </Card>

        <Tabs value={tab} onChange={setTab} tabs={[
          { value: "overview", label: "Overview", icon: FileText },
          { value: "folio", label: "Folio", icon: MessageSquareText, count: inr(res.totals.balance) },
        ]} />

        {tab === "overview" ? (
          <div className="space-y-5">
            {(res.specialRequests || res.internalNotes) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {res.specialRequests && <Alert tone="info" title="Guest requests">{res.specialRequests}</Alert>}
                {res.internalNotes && <Alert tone="warn" title="Internal notes">{res.internalNotes}</Alert>}
              </div>
            )}
            <Card className="p-4 sm:p-5">
              <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-gold-600">Guest</h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
                <KV label="ID">{g.idType && `${g.idType} · ${g.idNumber}`}</KV>
                <KV label="Nationality">{g.nationality}</KV>
                <KV label="Date of birth">{g.dob && fmtDate(g.dob)}</KV>
                <KV label="Email">{g.email}</KV>
                <KV label="Address" className="min-[420px]:col-span-2">{g.address}</KV>
              </dl>
              {res.companions?.length > 0 && <p className="mt-4 text-[13px] text-slate-600"><span className="font-medium">Companions: </span>{res.companions.map((c) => `${c.name}${c.relation ? ` (${c.relation})` : ""}`).join(", ")}</p>}
            </Card>
            <Card className="p-4 sm:p-5">
              <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-gold-600">Booking</h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
                <KV label="Source">{res.source}{res.reference && ` · ${res.reference}`}</KV>
                <KV label="Bill to">{res.billTo}{res.billToName && ` · ${res.billToName}`}</KV>
                <KV label="Rate">{inr(res.rate)} / night</KV>
                <KV label="ETA / ETD">{res.eta} / {res.etd}</KV>
                <KV label="Purpose">{res.purpose}</KV>
                <KV label="Group">{res.group?.id && `${res.group.id}${res.group.name ? ` · ${res.group.name}` : ""}`}</KV>
                <KV label="Early check-in">{res.earlyCheckIn?.requested && `Requested ${res.earlyCheckIn.time || ""}`}</KV>
                <KV label="Late check-out">{res.lateCheckOut?.requested && `Requested ${res.lateCheckOut.time || ""}`}</KV>
                <KV label="Emergency contact">{res.emergencyContact?.name && `${res.emergencyContact.name} ${res.emergencyContact.phone || ""}`}</KV>
              </dl>
            </Card>
            <Card className="p-4 sm:p-5">
              <h4 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gold-600">Timeline</h4>
              <ol className="space-y-2.5 text-[13px]">
                {[
                  { at: res.createdAt, text: `Booked by ${res.createdBy || "—"}` },
                  res.originalCheckIn && { text: `Arrival moved from ${fmtDate(res.originalCheckIn)} (early arrival)` },
                  res.checkInAt && { at: res.checkInAt, text: "Checked in" },
                  ...(res.roomMoves || []).map((m) => ({ at: m.at, text: `${m.moveType}: ${m.fromRoom} → ${m.toRoom}${m.reason ? ` · ${m.reason}` : ""}${m.rateAdjust ? ` · ${inr(m.rateAdjust, { sign: true })}` : ""}` })),
                  res.originalCheckOut && { text: `Departure changed from ${fmtDate(res.originalCheckOut)} to ${fmtDate(res.checkOut)}` },
                  res.checkOutAt && { at: res.checkOutAt, text: "Checked out" },
                  res.cancelledAt && { at: res.cancelledAt, text: `${s}${res.cancelReason ? ` · ${res.cancelReason}` : ""}` },
                  res.invoiceNo && { text: `Invoice ${res.invoiceNo} issued` },
                ].filter(Boolean).map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-400" />
                    <span className="min-w-0 flex-1 text-ink-800">{e.text}{e.at && <span className="block text-xs text-slate-400 sm:hidden">{fmtDateTime(e.at)}</span>}</span>
                    {e.at && <span className="hidden whitespace-nowrap text-xs text-slate-400 sm:inline">{fmtDateTime(e.at)}</span>}
                  </li>
                ))}
              </ol>
            </Card>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={Printer} onClick={() => print("confirmation")}>Booking confirmation</Button>
              <Button variant="secondary" size="sm" icon={Printer} onClick={() => print("invoice")}>Invoice</Button>
              <Button variant="ghost" size="sm" onClick={() => { onClose(); nav(`/guests?id=${g._id}`); }}>Guest profile →</Button>
            </div>
          </div>
        ) : (
          <FolioPanel res={res} onPrint={() => print("invoice")} />
        )}
      </div>

      {dialog === "checkin" && <CheckInDialog res={res} onClose={() => setDialog(null)} />}
      {dialog === "checkout" && <CheckOutDialog res={res} onClose={() => setDialog(null)} />}
      {dialog === "extend" && <ExtendDialog res={res} onClose={() => setDialog(null)} />}
      {dialog === "move" && <MoveDialog res={res} onClose={() => setDialog(null)} />}
      {(dialog === "cancel" || dialog === "no-show") && <CloseBookingDialog res={res} kind={dialog} onClose={() => setDialog(null)} />}
    </Drawer>
  );
}
