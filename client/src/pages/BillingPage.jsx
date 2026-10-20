import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Search, Receipt, Star, AlertTriangle, ArrowLeft } from "lucide-react";
import { api } from "../api/client";
import { useApiQuery } from "../api/hooks";
import { useReservationUI } from "../features/reservations/ReservationUI";
import FolioPanel from "../features/billing/FolioPanel";
import { PageHeader, Card, Tabs, Loading, Empty, Money, ResStatusBadge, Avatar, Button } from "../components/ui";
import { fmtShort, inr } from "../lib/format";

const VIEWS = [
  { value: "open", label: "In-house folios" },
  { value: "pending", label: "Pending collection" },
  { value: "credit", label: "Refunds due" },
  { value: "upcoming", label: "Advance due" },
];

function FolioDetail({ id, onBack }) {
  const { openReservation } = useReservationUI();
  const { data: res, isLoading } = useQuery({ queryKey: ["reservation", id], queryFn: () => api.get(`/reservations/${id}`) });
  if (isLoading) return <Card><Loading /></Card>;
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2 lg:hidden" onClick={onBack}>All folios</Button>
      <Card className="flex flex-wrap items-center gap-3 p-4 sm:gap-4">
        <Avatar name={res.guestName} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[16px] font-semibold">{res.guestName}<ResStatusBadge status={res.status} /></p>
          <p className="text-[13px] text-slate-500">
            <span className="font-mono">{res.confirmationNo}</span> · Room {res.room?.number || "TBA"} · {fmtShort(res.checkIn)} → {fmtShort(res.checkOut)}
            {res.billTo !== "Guest" && <> · bill to <b>{res.billToName || res.billTo}</b></>}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => openReservation(res._id)}>Open booking</Button>
      </Card>
      <FolioPanel res={res} onPrint={() => window.open(`/print/invoice/${res._id}`, "_blank")} />
    </div>
  );
}

export default function BillingPage() {
  const [view, setView] = useState("open");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  useEffect(() => { document.querySelector("main")?.scrollTo({ top: 0 }); }, [selected]);
  const { data, isLoading } = useApiQuery("billing", "/billing/folios", { view }, { placeholderData: (p) => p });
  const items = (data?.items || []).filter((r) => !q || r.guestName.toLowerCase().includes(q.toLowerCase()) || r.room?.number?.includes(q) || r.confirmationNo.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Billing" subtitle="Guest folios, collections and refunds" />
      {data?.pendingTotal > 0 && (
        <button onClick={() => setView("pending")} className="mb-5 flex w-full items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-[13.5px] text-rose-800">
          <AlertTriangle className="h-4 w-4" /> <b>{inr(data.pendingTotal)}</b> is still owed by {data.counts.pending} departed guest{data.counts.pending === 1 ? "" : "s"}.
        </button>
      )}
      <Tabs className="mb-5" value={view} onChange={(v) => { setView(v); setSelected(null); }} tabs={VIEWS.map((v) => ({ ...v, count: data?.counts?.[v.value] }))} />
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr]">
        <Card className={clsx("flex-col overflow-hidden lg:flex lg:max-h-[calc(100dvh-250px)]", selected ? "hidden" : "flex")}>
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Guest, room or confirmation" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">
            {isLoading ? <Loading /> : items.length === 0 ? <Empty icon={Receipt} title="No folios here" /> : items.map((r) => (
              <button key={r._id} onClick={() => setSelected(r._id)}
                className={clsx("flex w-full items-center gap-3 border-b border-line/70 px-4 py-3 text-left transition", selected === r._id ? "bg-gold-50" : "hover:bg-slate-50")}>
                <span className="grid h-9 w-[58px] shrink-0 place-items-center whitespace-nowrap rounded-lg bg-slate-100 text-[12.5px] font-semibold">{r.room?.number || "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{r.guestName}{r.isVIP && <Star className="ml-1 inline h-3 w-3 fill-gold-400 text-gold-400" />}</span>
                  <span className="text-xs text-slate-500">{view === "pending" ? `Left ${fmtShort(r.checkOut)}` : `${fmtShort(r.checkIn)} → ${fmtShort(r.checkOut)}`}{r.billTo !== "Guest" && ` · ${r.billTo}`}</span>
                </span>
                <span className="text-right">
                  <Money value={r.totals.balance} colored className="block text-[13.5px] font-semibold" />
                  <span className="text-[11px] text-slate-400">of {inr(r.totals.total)}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
        <div className={clsx("min-w-0", !selected && "hidden lg:block")}>{selected ? <FolioDetail id={selected} onBack={() => setSelected(null)} /> : <Card><Empty icon={Receipt} title="Select a folio">Choose a guest on the left to post charges, take payments or print an invoice.</Empty></Card>}</div>
      </div>
    </>
  );
}
