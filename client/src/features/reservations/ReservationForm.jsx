import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronDown, UserCheck, Star, AlertCircle, BedDouble, Search } from "lucide-react";
import { api } from "../../api/client";
import { useApiMutation, useMeta } from "../../api/hooks";
import { Modal, Button, Input, Select, Textarea, Toggle, Alert, Badge, Segmented } from "../../components/ui";
import { addDays, inr, nightsBetween, fmtDate } from "../../lib/format";

const blankGuest = { name: "", countryCode: "+91", mobile: "", email: "", dob: "", gender: "", address: "", nationality: "Indian", idType: "Aadhaar", idNumber: "" };

function toForm(meta, { reservation: r, prefill = {} }) {
  const today = meta.today;
  if (r) {
    const g = r.guest || {};
    return {
      guest: { ...blankGuest, ...Object.fromEntries(Object.keys(blankGuest).map((k) => [k, g[k] ?? blankGuest[k]])) },
      propertyId: r.property?._id, roomId: r.room?._id || "", roomType: r.roomType, checkIn: r.checkIn, checkOut: r.checkOut,
      eta: r.eta || "14:00", etd: r.etd || "11:00", status: r.status, holdUntil: r.holdUntil ? new Date(r.holdUntil).toISOString().slice(0, 16) : "",
      adults: r.adults, children: r.children, companions: r.companions || [], source: r.source, reference: r.reference || "", purpose: r.purpose || "",
      billTo: r.billTo || "Guest", billToName: r.billToName || "", isVIP: !!r.isVIP, group: r.group || { id: "", name: "" },
      earlyCheckIn: r.earlyCheckIn || { requested: false, time: "" }, lateCheckOut: r.lateCheckOut || { requested: false, time: "" },
      specialRequests: r.specialRequests || "", internalNotes: r.internalNotes || "",
      emergencyContact: r.emergencyContact || { name: "", relation: "", phone: "" }, cForm: r.cForm || {},
      advance: { amount: "", method: "Cash", reference: "" },
    };
  }
  return {
    guest: { ...blankGuest },
    propertyId: prefill.propertyId || meta.properties[0]?._id, roomId: prefill.roomId || "", roomType: prefill.roomType || "Standard",
    checkIn: prefill.checkIn || today, checkOut: prefill.checkOut || addDays(prefill.checkIn || today, 1),
    eta: "14:00", etd: "11:00", status: "Confirmed", holdUntil: "",
    adults: 1, children: 0, companions: [], source: "Walk-in", reference: "", purpose: "", billTo: "Guest", billToName: "", isVIP: false,
    group: { id: "", name: "" }, earlyCheckIn: { requested: false, time: "" }, lateCheckOut: { requested: false, time: "" },
    specialRequests: "", internalNotes: "", emergencyContact: { name: "", relation: "", phone: "" }, cForm: {},
    advance: { amount: "", method: "Cash", reference: "" },
  };
}

function Section({ title, subtitle, open, onToggle, children, badge }) {
  return (
    <div className="rounded-xl border border-line">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="text-[13.5px] font-semibold text-ink-900">{title}</span>
          {badge && <span className="ml-2">{badge}</span>}
          {subtitle && <span className="block text-xs text-slate-500">{subtitle}</span>}
        </span>
        <ChevronDown className={clsx("h-4 w-4 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-4 border-t border-line px-4 py-4">{children}</div>}
    </div>
  );
}

function GuestLookup({ onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data } = useQuery({ queryKey: ["guests", "lookup", q], queryFn: () => api.get("/guests", { params: { q, limit: 6 } }), enabled: q.trim().length >= 2 });
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" placeholder="Returning guest? Search by name or phone…" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && data?.items?.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          {data.items.map((g) => (
            <button key={g._id} type="button" onClick={() => { onPick(g); setQ(""); setOpen(false); }}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-gold-50/50">
              <span>
                <span className="text-[13.5px] font-medium text-ink-900">{g.name}</span>{g.isVIP && <Star className="ml-1 inline h-3.5 w-3.5 fill-gold-400 text-gold-400" />}
                <span className="block text-xs text-slate-500">{g.countryCode} {g.mobile} · {g.idType}</span>
              </span>
              <span className="text-right text-xs text-slate-500">{g.stats.stays} stay{g.stats.stays === 1 ? "" : "s"}{g.stats.lastStay && <span className="block">last {fmtDate(g.stats.lastStay)}</span>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReservationForm({ reservation, prefill, onClose, onSaved }) {
  const { data: meta } = useMeta();
  const isEdit = !!reservation;
  const inHouse = reservation?.status === "Checked In";
  const [f, setF] = useState(() => toForm(meta, { reservation, prefill }));
  const [error, setError] = useState("");
  const [returning, setReturning] = useState(false);
  const [open, setOpen] = useState({ details: false, notes: !!(reservation?.specialRequests || reservation?.internalNotes), emergency: false });

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setG = (k, v) => setF((s) => ({ ...s, guest: { ...s.guest, [k]: v } }));
  const setN = (k, sub, v) => setF((s) => ({ ...s, [k]: { ...s[k], [sub]: v } }));

  const nights = Math.max(0, nightsBetween(f.checkIn, f.checkOut));
  const property = meta.properties.find((p) => p._id === f.propertyId);
  const datesOk = f.checkIn && f.checkOut && nights > 0;

  const { data: free, isFetching: loadingRooms } = useQuery({
    queryKey: ["freeRooms", f.propertyId, f.checkIn, f.checkOut, reservation?._id],
    queryFn: () => api.get("/reservations/free-rooms", { params: { propertyId: f.propertyId, checkIn: f.checkIn, checkOut: f.checkOut, excludeId: reservation?._id } }),
    enabled: !!f.propertyId && datesOk && !inHouse,
  });
  const rooms = free?.rooms || [];
  const room = rooms.find((r) => r._id === f.roomId);
  useEffect(() => {
    if (f.roomId && free && !room) set("roomId", ""); // selected room no longer free for these dates
  }, [free]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = room ? room.rate : property?.defaultRates?.[f.roomType] ?? property?.defaultRates?.Standard ?? 0;
  const estimate = nights * rate;
  const countryRule = meta.countryCodes.find((c) => c.code === f.guest.countryCode);
  const idRule = meta.idTypes.find((t) => t.id === f.guest.idType);
  const isForeign = f.guest.nationality && f.guest.nationality !== "Indian";
  const canCheckInNow = !isEdit && f.checkIn === meta.today;

  const pickGuest = (g) => {
    setF((s) => ({ ...s, isVIP: s.isVIP || g.isVIP, guest: { ...blankGuest, ...Object.fromEntries(Object.keys(blankGuest).map((k) => [k, g[k] ?? blankGuest[k]])) } }));
    setReturning(true);
  };

  const save = useApiMutation(
    (body) => (isEdit ? api.patch(`/reservations/${reservation._id}`, body) : api.post("/reservations", body)),
    { success: isEdit ? "Reservation updated" : (r) => `Booking ${r.confirmationNo} created`, onSuccess: (r) => onSaved(r), onError: (e) => setError(e.message) }
  );

  const submit = (e) => {
    e.preventDefault();
    setError("");
    const body = {
      ...f,
      roomId: f.roomId || null,
      holdUntil: f.status === "On Hold" && f.holdUntil ? new Date(f.holdUntil).toISOString() : null,
      companions: f.companions.filter((c) => c.name?.trim()),
      advance: !isEdit && Number(f.advance.amount) > 0 ? { ...f.advance, amount: Number(f.advance.amount) } : undefined,
    };
    if (isEdit) {
      delete body.advance;
      if (inHouse) { delete body.checkIn; delete body.checkOut; delete body.roomId; delete body.propertyId; delete body.roomType; delete body.status; }
    }
    save.mutate(body);
  };

  const statusOptions = [
    { value: "Confirmed", label: "Confirmed" },
    { value: "On Hold", label: "On Hold" },
    ...(canCheckInNow ? [{ value: "Checked In", label: "Check in now" }] : []),
  ];

  return (
    <Modal open onClose={onClose} size="lg"
      title={isEdit ? `Edit ${reservation.confirmationNo}` : "New reservation"}
      subtitle={isEdit ? reservation.guestName : "Capture guest, stay and payment details"}
      footer={
        <>
          <div className="w-full text-[13px] text-slate-500 sm:mr-auto sm:w-auto">
            {datesOk && <><span className="font-semibold text-ink-900">{nights} night{nights === 1 ? "" : "s"}</span> × {inr(rate)} = <span className="font-semibold text-ink-900">{inr(estimate)}</span></>}
          </div>
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="res-form" className="flex-1 sm:flex-none" loading={save.isPending}>{isEdit ? "Save changes" : f.status === "Checked In" ? "Book & check in" : "Create booking"}</Button>
        </>
      }>
      <form id="res-form" onSubmit={submit} className="space-y-6">
        {error && <Alert tone="danger" icon={AlertCircle}>{error}</Alert>}

        {/* ── Guest ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gold-600">Guest</h3>
            {returning && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/15"><UserCheck className="h-3 w-3" /> Returning guest — details filled</Badge>}
          </div>
          {!isEdit && <GuestLookup onPick={pickGuest} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" required value={f.guest.name} onChange={(e) => setG("name", e.target.value)} placeholder="As on ID" />
            <div>
              <label className="label">Mobile <span className="text-rose-500">*</span></label>
              <div className="flex gap-2">
                <select className="input w-[92px] shrink-0 sm:w-[104px]" value={f.guest.countryCode} onChange={(e) => setG("countryCode", e.target.value)}>
                  {meta.countryCodes.map((c) => <option key={c.code} value={c.code}>{c.code} {c.country.split(" ")[0]}</option>)}
                </select>
                <input className="input" inputMode="numeric" required value={f.guest.mobile} onChange={(e) => setG("mobile", e.target.value.replace(/[^\d ]/g, ""))} placeholder={`${countryRule?.digits || 10} digits`} />
              </div>
            </div>
            <Select label="ID type" required value={f.guest.idType} onChange={(e) => setG("idType", e.target.value)} options={meta.idTypes.map((t) => t.id)} />
            <Input label="ID number" required value={f.guest.idNumber} onChange={(e) => setG("idNumber", e.target.value.toUpperCase())} hint={`Format: ${idRule?.hint}`} />
            <Select label="Nationality" value={f.guest.nationality} onChange={(e) => setG("nationality", e.target.value)} options={meta.nationalities} />
            <Input label="Email" type="email" value={f.guest.email} onChange={(e) => setG("email", e.target.value)} />
            <Input label="Address" className="sm:col-span-2" value={f.guest.address} onChange={(e) => setG("address", e.target.value)} />
          </div>
        </section>

        {/* ── Stay ── */}
        <section className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gold-600">Stay</h3>
          {inHouse && <Alert tone="info">Guest is in-house — use <b>Extend stay</b> or <b>Move room</b> from the booking to change dates or room.</Alert>}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Select label="Property" required className="col-span-2" disabled={inHouse} value={f.propertyId} onChange={(e) => setF((s) => ({ ...s, propertyId: e.target.value, roomId: "" }))}
              options={meta.properties.map((p) => ({ value: p._id, label: p.name }))} />
            <Input label="Check-in" type="date" required disabled={inHouse} min={isEdit ? undefined : meta.today} value={f.checkIn}
              onChange={(e) => setF((s) => ({ ...s, checkIn: e.target.value, checkOut: s.checkOut <= e.target.value ? addDays(e.target.value, 1) : s.checkOut }))} />
            <Input label="Check-out" type="date" required disabled={inHouse} min={f.checkIn ? addDays(f.checkIn, 1) : undefined} value={f.checkOut} onChange={(e) => set("checkOut", e.target.value)} />
          </div>
          {!inHouse && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="col-span-2">
                <label className="label">Room</label>
                <select className="input" value={f.roomId} onChange={(e) => set("roomId", e.target.value)} disabled={!datesOk}>
                  <option value="">{loadingRooms ? "Checking availability…" : `Assign later (room TBA) · ${rooms.length} free`}</option>
                  {Object.entries(rooms.reduce((acc, r) => { (acc[r.type] ||= []).push(r); return acc; }, {})).map(([type, list]) => (
                    <optgroup key={type} label={`${type} — ${inr(list[0].rate)}/night`}>
                      {list.map((r) => <option key={r._id} value={r._id}>{r.number} · {r.type}{r.status !== "Available" ? ` (${r.status.toLowerCase()} now)` : ""} · {inr(r.rate)}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <Select label="Room type" className="col-span-2 sm:col-span-1" disabled={!!f.roomId} value={room ? room.type : f.roomType} onChange={(e) => set("roomType", e.target.value)} options={Object.keys(property?.defaultRates || { Standard: 1 })} hint={f.roomId ? "From selected room" : "Rate basis while TBA"} />
              <div className="col-span-2 flex gap-2 sm:col-span-1">
                <Input label="Adults" className="flex-1" type="number" min={1} max={20} value={f.adults} onChange={(e) => set("adults", e.target.value)} />
                <Input label="Children" className="flex-1" type="number" min={0} max={20} value={f.children} onChange={(e) => set("children", e.target.value)} />
              </div>
            </div>
          )}
          {room && Number(f.adults) + Number(f.children) > room.maxOccupancy && (
            <Alert tone="warn">Room {room.number} sleeps {room.maxOccupancy}. Consider an extra bed charge.</Alert>
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {!inHouse && (
              <div className="col-span-2">
                <label className="label">Booking status</label>
                <Segmented value={f.status} onChange={(v) => set("status", v)} options={statusOptions} />
              </div>
            )}
            {f.status === "On Hold" && <Input label="Hold until" type="datetime-local" required value={f.holdUntil} onChange={(e) => set("holdUntil", e.target.value)} className="col-span-2" />}
            <Input label="ETA" type="time" value={f.eta} onChange={(e) => set("eta", e.target.value)} />
            <Input label="ETD" type="time" value={f.etd} onChange={(e) => set("etd", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Select label="Source" value={f.source} onChange={(e) => set("source", e.target.value)} options={meta.bookingSources} />
            <Input label="Source reference" value={f.reference} onChange={(e) => set("reference", e.target.value)} placeholder="OTA / agent ref" />
            <Select label="Bill to" value={f.billTo} onChange={(e) => set("billTo", e.target.value)} options={meta.billTo} />
            {f.billTo !== "Guest" ? <Input label={`${f.billTo} name`} value={f.billToName} onChange={(e) => set("billToName", e.target.value)} /> : <div className="col-span-2 flex items-end pb-2 md:col-span-1"><Toggle checked={f.isVIP} onChange={(v) => set("isVIP", v)} label="VIP guest" /></div>}
          </div>
        </section>

        {/* ── Advance ── */}
        {!isEdit && (
          <section className="space-y-4">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gold-600">Advance payment</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Amount (₹)" type="number" min={0} max={estimate} value={f.advance.amount} onChange={(e) => setN("advance", "amount", e.target.value)} placeholder="0" hint={estimate ? `Booking total ${inr(estimate)}` : undefined} />
              <Select label="Method" value={f.advance.method} onChange={(e) => setN("advance", "method", e.target.value)} options={meta.paymentMethods.filter((m) => !["Complimentary", "Sponsor"].includes(m.id)).map((m) => m.id)} />
              <Input label={meta.paymentMethods.find((m) => m.id === f.advance.method)?.refLabel || "Reference"} value={f.advance.reference} onChange={(e) => setN("advance", "reference", e.target.value)} />
            </div>
          </section>
        )}

        {/* ── Optional sections ── */}
        <div className="space-y-3">
          <Section title="More guest & stay details" subtitle="DOB, purpose, group, early / late requests" open={open.details} onToggle={() => setOpen((o) => ({ ...o, details: !o.details }))}
            badge={isForeign && <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">C-Form required</Badge>}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Date of birth" type="date" max={meta.today} value={f.guest.dob} onChange={(e) => setG("dob", e.target.value)} />
              <Select label="Gender" value={f.guest.gender} onChange={(e) => setG("gender", e.target.value)} placeholder="—" options={["Male", "Female", "Other"]} />
              <Select label="Purpose of visit" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="—" options={meta.purposes} />
              <Input label="Group ID" value={f.group.id} onChange={(e) => setN("group", "id", e.target.value)} placeholder="GRP-…" />
              <Input label="Group name" className="sm:col-span-2" value={f.group.name} onChange={(e) => setN("group", "name", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Toggle checked={!!f.earlyCheckIn.requested} onChange={(v) => setN("earlyCheckIn", "requested", v)} label="Early check-in requested" />
                {f.earlyCheckIn.requested && <input type="time" className="input" value={f.earlyCheckIn.time} onChange={(e) => setN("earlyCheckIn", "time", e.target.value)} />}
              </div>
              <div className="space-y-2">
                <Toggle checked={!!f.lateCheckOut.requested} onChange={(v) => setN("lateCheckOut", "requested", v)} label="Late check-out requested" />
                {f.lateCheckOut.requested && <input type="time" className="input" value={f.lateCheckOut.time} onChange={(e) => setN("lateCheckOut", "time", e.target.value)} />}
              </div>
            </div>
            {f.billTo !== "Guest" && <Toggle checked={f.isVIP} onChange={(v) => set("isVIP", v)} label="VIP guest" />}
            {isForeign && (
              <div className="rounded-lg bg-amber-50/50 p-3 ring-1 ring-amber-200">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800">C-Form (foreign national)</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select label="Visa type" value={f.cForm.visaType || ""} placeholder="—" onChange={(e) => setN("cForm", "visaType", e.target.value)} options={meta.visaTypes} />
                  <Input label="Visa number" value={f.cForm.visaNo || ""} onChange={(e) => setN("cForm", "visaNo", e.target.value)} />
                  <Input label="Visa valid until" type="date" value={f.cForm.visaValidUntil || ""} onChange={(e) => setN("cForm", "visaValidUntil", e.target.value)} />
                  <Input label="Place of issue" value={f.cForm.visaIssuePlace || ""} onChange={(e) => setN("cForm", "visaIssuePlace", e.target.value)} />
                  <Input label="Arrival in India" type="date" value={f.cForm.arrivalDate || ""} onChange={(e) => setN("cForm", "arrivalDate", e.target.value)} />
                  <Input label="Next destination" value={f.cForm.nextDestination || ""} onChange={(e) => setN("cForm", "nextDestination", e.target.value)} />
                </div>
              </div>
            )}
          </Section>

          <Section title="Companions & emergency contact" open={open.emergency} onToggle={() => setOpen((o) => ({ ...o, emergency: !o.emergency }))}>
            <div className="space-y-2">
              {f.companions.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_64px] gap-2 sm:flex">
                  <input className="input col-span-3" placeholder="Name" value={c.name} onChange={(e) => set("companions", f.companions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input className="input sm:w-36" placeholder="Relation" value={c.relation || ""} onChange={(e) => set("companions", f.companions.map((x, j) => (j === i ? { ...x, relation: e.target.value } : x)))} />
                  <input className="input sm:w-20" placeholder="Age" type="number" value={c.age || ""} onChange={(e) => set("companions", f.companions.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)))} />
                  <Button variant="danger-ghost" size="sm" onClick={() => set("companions", f.companions.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => set("companions", [...f.companions, { name: "", relation: "", age: "" }])}>Add companion</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Emergency contact" value={f.emergencyContact.name} onChange={(e) => setN("emergencyContact", "name", e.target.value)} />
              <Input label="Relation" value={f.emergencyContact.relation} onChange={(e) => setN("emergencyContact", "relation", e.target.value)} />
              <Input label="Phone" value={f.emergencyContact.phone} onChange={(e) => setN("emergencyContact", "phone", e.target.value)} />
            </div>
          </Section>

          <Section title="Requests & internal notes" open={open.notes} onToggle={() => setOpen((o) => ({ ...o, notes: !o.notes }))}>
            <Textarea label="Guest requests" value={f.specialRequests} onChange={(e) => set("specialRequests", e.target.value)} placeholder="Shown to front desk and housekeeping" />
            <Textarea label="Internal notes" value={f.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} placeholder="Staff only — never printed" />
          </Section>
        </div>

        {!isEdit && f.status === "Checked In" && !f.roomId && (
          <Alert tone="warn" icon={BedDouble}>Pick a room to check the guest in right away.</Alert>
        )}
      </form>
    </Modal>
  );
}
