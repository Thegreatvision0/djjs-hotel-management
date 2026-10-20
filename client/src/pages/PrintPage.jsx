import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { api } from "../api/client";
import { useMeta } from "../api/hooks";
import { Button, Loading } from "../components/ui";
import Logo from "../components/Logo";
import { inr, fmtDate, fmtDateTime, amountInWords } from "../lib/format";

function Letterhead({ meta, title, number, sub }) {
  return (
    <header className="flex flex-col gap-4 border-b-4 border-gold-400 bg-ink-900 px-5 py-6 text-white sm:flex-row sm:items-start sm:justify-between sm:px-10 sm:py-7 print:flex-row print:px-8">
      <div className="flex items-center gap-4">
        <Logo size="lg" />
        <div>
          <p className="font-display text-2xl font-semibold tracking-wide text-gold-300 sm:text-3xl">{meta.hotel.name}</p>
          <p className="text-xs text-slate-300">{meta.hotel.tagline}</p>
        </div>
      </div>
      <div className="sm:text-right print:text-right">
        <p className="text-xs uppercase tracking-[.2em] text-slate-400">{title}</p>
        <p className="mt-1 font-mono text-lg font-semibold text-gold-300">{number}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </header>
  );
}

const Row = ({ label, value }) => (
  <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="text-[13.5px] font-medium">{value || "—"}</p></div>
);

export default function PrintPage() {
  const { kind, id } = useParams();
  const { data: meta } = useMeta();
  const isInvoice = kind === "invoice";
  const { data: res, isLoading } = useQuery({
    queryKey: ["print", kind, id],
    queryFn: () => (isInvoice ? api.post(`/reservations/${id}/invoice`) : api.get(`/reservations/${id}`)),
    staleTime: Infinity,
  });
  useEffect(() => { if (res) document.title = `${isInvoice ? res.invoiceNo : res.confirmationNo} — ${res.guestName}`; }, [res, isInvoice]);
  if (isLoading || !meta) return <Loading />;

  const g = res.guest || {};
  const live = (res.folio || []).filter((l) => !l.voided);
  const charges = live.filter((l) => l.kind === "charge");
  const discounts = live.filter((l) => l.kind === "discount");
  const payments = live.filter((l) => ["payment", "refund"].includes(l.kind));
  const t = res.totals;

  return (
    <div className="min-h-screen bg-slate-200/60 py-0 sm:py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto flex max-w-[820px] justify-end gap-2 px-4 py-3 sm:mb-4 sm:py-0">
        <Button variant="secondary" onClick={() => window.close()}>Close</Button>
        <Button icon={Printer} onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      <article className="mx-auto max-w-[820px] overflow-hidden bg-white shadow-pop print:max-w-none print:shadow-none">
        <Letterhead meta={meta} title={isInvoice ? "Tax invoice" : "Booking confirmation"} number={isInvoice ? res.invoiceNo : res.confirmationNo} sub={isInvoice ? `Booking ${res.confirmationNo}` : `Issued ${fmtDate(new Date().toISOString().slice(0, 10))}`} />
        <div className="space-y-6 px-5 py-6 sm:space-y-7 sm:px-10 sm:py-8 print:px-8">
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 print:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-600">{isInvoice ? "Billed to" : "Guest"}</p>
              <div>
                <p className="text-lg font-semibold">{res.billTo !== "Guest" && res.billToName ? res.billToName : res.guestName}</p>
                {res.billTo !== "Guest" && res.billToName && <p className="text-[13px] text-slate-600">Guest: {res.guestName}</p>}
                <p className="text-[13px] text-slate-600">{res.guestMobile}{g.email && ` · ${g.email}`}</p>
                {g.address && <p className="text-[13px] text-slate-600">{g.address}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Row label="Property" value={res.property?.name} />
              <Row label="Room" value={res.room ? `${res.room.number} · ${res.roomType}` : `${res.roomType} (to be assigned)`} />
              <Row label="Arrival" value={`${fmtDate(res.checkIn)} · ${res.eta}`} />
              <Row label="Departure" value={`${fmtDate(res.checkOut)} · ${res.etd}`} />
              <Row label="Nights" value={res.nights} />
              <Row label="Guests" value={`${res.adults} adult${res.adults === 1 ? "" : "s"}${res.children ? `, ${res.children} child` : ""}`} />
            </div>
          </section>

          {isInvoice ? (
            <section>
              <div className="table-scroll"><table className="w-full min-w-[420px] text-[13px]">
                <thead><tr className="border-b-2 border-ink-900 text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="py-2">Description</th><th className="py-2">Date</th><th className="py-2 text-right">Amount</th></tr></thead>
                <tbody>
                  {charges.map((l) => <tr key={l._id} className="border-b border-slate-100"><td className="py-2 pr-4">{l.description}</td><td className="py-2 text-slate-500">{fmtDate(l.chargeDate || (l.code === "ROOM" ? res.checkIn : l.postedAt))}</td><td className="py-2 text-right tabular-nums">{inr(l.amount)}</td></tr>)}
                  {discounts.map((l) => <tr key={l._id} className="border-b border-slate-100 text-emerald-700"><td className="py-2 pr-4">{l.description}</td><td className="py-2">{fmtDate(l.postedAt)}</td><td className="py-2 text-right tabular-nums">−{inr(l.amount)}</td></tr>)}
                </tbody>
              </table></div>
              <div className="mt-5 ml-auto w-full sm:w-72 space-y-1.5 text-[13.5px]">
                <div className="flex justify-between"><span className="text-slate-500">Total charges</span><span className="tabular-nums">{inr(t.charges)}</span></div>
                {t.discounts > 0 && <div className="flex justify-between text-emerald-700"><span>Discounts</span><span className="tabular-nums">−{inr(t.discounts)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold"><span>Invoice total</span><span className="tabular-nums">{inr(t.total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="tabular-nums">{inr(t.paid)}</span></div>
                <div className="flex justify-between rounded-lg bg-ink-900 px-3 py-2 font-semibold text-white"><span>{t.balance < 0 ? "Credit due to guest" : "Balance due"}</span><span className="tabular-nums text-gold-300">{inr(Math.abs(t.balance))}</span></div>
              </div>
              <p className="mt-4 text-[12.5px] italic text-slate-600">Amount in words: {amountInWords(t.total)}</p>
              {payments.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gold-600">Payments received</p>
                  <div className="table-scroll"><table className="w-full min-w-[440px] text-[12.5px]">
                    <tbody>
                      {payments.map((l) => <tr key={l._id} className="border-b border-slate-100"><td className="py-1.5">{fmtDateTime(l.postedAt)}</td><td>{l.kind === "refund" ? "Refund" : "Payment"} — {l.method}{l.reference && ` · ${l.reference}`}</td><td className="font-mono text-slate-500">{l.receiptNo}</td><td className="text-right tabular-nums">{l.kind === "refund" ? "−" : ""}{inr(l.amount)}</td></tr>)}
                    </tbody>
                  </table></div>
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-5">
              <div className="flex flex-col gap-3 rounded-xl border border-gold-200 bg-gold-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 print:flex-row">
                <div><p className="font-display text-4xl font-semibold text-gold-600">{res.nights} night{res.nights === 1 ? "" : "s"}</p><p className="text-[13px] text-slate-600">{fmtDate(res.checkIn)} → {fmtDate(res.checkOut)}</p></div>
                <div className="sm:text-right print:text-right"><p className="text-xs uppercase tracking-wider text-slate-500">Stay total</p><p className="text-2xl font-semibold">{inr(t.total)}</p><p className="text-[13px] text-slate-600">Advance paid {inr(t.paid)} · due {inr(Math.max(0, t.balance))}</p></div>
              </div>
              {res.specialRequests && <div><p className="text-[11px] font-semibold uppercase tracking-widest text-gold-600">Your requests</p><p className="mt-1 text-[13.5px]">{res.specialRequests}</p></div>}
              <div className="rounded-lg bg-slate-50 p-4 text-[12.5px] leading-relaxed text-slate-600">
                Check-in from {meta.hotel.standardCheckIn} · check-out by {meta.hotel.standardCheckOut}. Please carry the original photo ID used for this booking. Early arrival and late departure are subject to availability and may be chargeable.
              </div>
            </section>
          )}

          <footer className="flex flex-col gap-2 border-t border-slate-200 pt-6 sm:flex-row sm:items-end sm:justify-between text-[11.5px] text-slate-500">
            <p>Thank you for staying with {meta.hotel.name}.<br />This is a computer-generated document.</p>
            <p className="sm:text-right">Generated {fmtDateTime(new Date())}</p>
          </footer>
        </div>
      </article>
    </div>
  );
}
