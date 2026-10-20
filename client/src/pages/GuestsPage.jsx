import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Search, Star, Plus, Phone, Mail, MapPin, IdCard, Users2, ArrowLeft } from "lucide-react";
import { api } from "../api/client";
import { useApiMutation, useApiQuery } from "../api/hooks";
import { useReservationUI } from "../features/reservations/ReservationUI";
import { PageHeader, Card, Avatar, Loading, Empty, Money, ResStatusBadge, Button, Badge, Toggle, Textarea } from "../components/ui";
import { fmtDate, inr } from "../lib/format";

function Profile({ id }) {
  const { openReservation, openNew } = useReservationUI();
  const { data, isLoading } = useQuery({ queryKey: ["guests", id], queryFn: () => api.get(`/guests/${id}`) });
  const [notes, setNotes] = useState(null);
  const save = useApiMutation((b) => api.patch(`/guests/${id}`, b), { success: "Guest updated", invalidate: ["guests"] });
  if (isLoading) return <Loading />;
  const { guest: g, stays } = data;
  const done = stays.filter((s) => ["Checked Out", "Checked In"].includes(s.status));
  const spend = done.reduce((s, x) => s + x.totals.total, 0);
  const due = stays.reduce((s, x) => s + Math.max(0, x.totals.balance), 0);

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3 sm:gap-4">
          <Avatar name={g.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 break-words font-display text-[22px] font-semibold sm:text-2xl">{g.name}{g.isVIP && <Star className="h-4 w-4 fill-gold-400 text-gold-400" />}</h2>
            <div className="mt-2 flex flex-col gap-1 text-[13px] text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{g.countryCode} {g.mobile}</span>
              {g.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{g.email}</span>}
              <span className="flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5" />{g.idType} · {g.idNumber}</span>
              {g.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{g.address}</span>}
            </div>
          </div>
          <Button size="sm" icon={Plus} className="w-full sm:w-auto" onClick={() => openNew()}>Book again</Button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
          {[["Stays", done.length], ["Lifetime spend", inr(spend)], ["Outstanding", inr(due)]].map(([l, v]) => (
            <div key={l} className="min-w-0 bg-white px-3 py-3 sm:px-4"><p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px]">{l}</p><p className={clsx("mt-0.5 truncate text-base font-semibold sm:text-lg", l === "Outstanding" && due > 0 && "text-rose-600")}>{v}</p></div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
          <Toggle checked={!!g.isVIP} onChange={(v) => save.mutate({ isVIP: v })} label="VIP guest" description="Flags all future bookings" />
          <div className="space-y-2">
            <Textarea label="Guest notes" rows={2} value={notes ?? g.notes ?? ""} onChange={(e) => setNotes(e.target.value)} placeholder="Preferences, allergies, history…" />
            {notes !== null && notes !== (g.notes || "") && <Button size="xs" loading={save.isPending} onClick={() => save.mutate({ notes }, { onSuccess: () => setNotes(null) })}>Save notes</Button>}
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3 text-[14px] font-semibold">Stay history</div>
        {stays.length === 0 ? <Empty title="No bookings yet" /> : (
          <div className="table-scroll"><table className="table-base">
            <thead><tr><th className="hidden sm:table-cell">Booking</th><th>Stay</th><th className="hidden md:table-cell">Room</th><th>Status</th><th className="hidden text-right sm:table-cell">Total</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {stays.map((s) => (
                <tr key={s._id} onClick={() => openReservation(s._id)} className="cursor-pointer hover:bg-gold-50/40">
                  <td className="hidden font-mono text-xs sm:table-cell">{s.confirmationNo}</td>
                  <td className="whitespace-nowrap">{fmtDate(s.checkIn, { day: "numeric", month: "short", year: "2-digit" })} → {fmtDate(s.checkOut, { day: "numeric", month: "short", year: "2-digit" })}<span className="block text-xs text-slate-500 md:hidden">Room {s.room?.number || "TBA"} · {s.property?.code}</span></td>
                  <td className="hidden md:table-cell">{s.room?.number || "TBA"} <span className="text-xs text-slate-500">{s.property?.code}</span></td>
                  <td><ResStatusBadge status={s.status} /></td>
                  <td className="hidden text-right sm:table-cell"><Money value={s.totals.total} /></td>
                  <td className="text-right"><Money value={s.totals.balance} colored /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}

export default function GuestsPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("id");
  const [q, setQ] = useState("");
  useEffect(() => { document.querySelector("main")?.scrollTo({ top: 0 }); }, [selected]);
  const { data, isLoading } = useApiQuery("guests", "/guests", { q: q || undefined }, { placeholderData: (p) => p });
  const items = data?.items || [];

  return (
    <>
      <PageHeader title="Guests" subtitle="Profiles are created automatically from bookings and matched by phone number" />
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] 2xl:grid-cols-[400px_1fr]">
        <Card className={clsx("flex-col overflow-hidden lg:flex lg:max-h-[calc(100dvh-180px)]", selected ? "hidden" : "flex")}>
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">
            {isLoading ? <Loading /> : items.length === 0 ? <Empty title="No guests found" /> : items.map((g) => (
              <button key={g._id} onClick={() => setParams({ id: g._id })}
                className={clsx("flex w-full items-center gap-3 border-b border-line/70 px-4 py-3 text-left transition", selected === g._id ? "bg-gold-50" : "hover:bg-slate-50")}>
                <Avatar name={g.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{g.name}{g.isVIP && <Star className="ml-1 inline h-3 w-3 fill-gold-400 text-gold-400" />}</span>
                  <span className="text-xs text-slate-500">{g.countryCode} {g.mobile}</span>
                </span>
                <span className="text-right text-xs text-slate-500">
                  {g.stats.inHouse ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/15">In-house</Badge> : `${g.stats.stays} stay${g.stats.stays === 1 ? "" : "s"}`}
                  {g.stats.outstanding > 0 && <span className="block text-rose-600">{inr(g.stats.outstanding)} due</span>}
                </span>
              </button>
            ))}
          </div>
        </Card>
        <div className={clsx("min-w-0", !selected && "hidden lg:block")}>{selected ? <><Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2 mb-3 lg:hidden" onClick={() => setParams({})}>All guests</Button><Profile id={selected} /></> : <Card><Empty icon={Users2} title="Select a guest">Pick someone on the left to see their profile and stay history.</Empty></Card>}</div>
      </div>
    </>
  );
}
