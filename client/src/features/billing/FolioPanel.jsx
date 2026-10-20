import { useMemo, useState } from "react";
import clsx from "clsx";
import { Plus, CreditCard, Undo2, Ban, Printer, Trash2, Receipt, ArrowDownLeft, ArrowUpRight, Percent, Heart } from "lucide-react";
import { api } from "../../api/client";
import { useApiMutation, useMeta } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { Button, Modal, Input, Select, Textarea, Alert, Money, Badge, IconButton, Empty, Segmented } from "../../components/ui";
import { inr, fmtDateTime } from "../../lib/format";

const KIND = {
  charge: { icon: ArrowUpRight, tone: "text-ink-900", label: "Charge" },
  discount: { icon: Percent, tone: "text-emerald-700", label: "Discount" },
  payment: { icon: ArrowDownLeft, tone: "text-emerald-700", label: "Payment" },
  refund: { icon: Undo2, tone: "text-rose-700", label: "Refund" },
  tip: { icon: Heart, tone: "text-pink-600", label: "Tip" },
};

export function FolioSummary({ totals, compact }) {
  const t = totals || {};
  const items = [
    { label: "Charges", value: t.charges },
    { label: "Discounts", value: t.discounts },
    { label: "Paid", value: t.paid },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className={clsx("min-w-0 bg-white", compact ? "px-3 py-2.5" : "px-3 py-3 sm:px-4")}>
          <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px]">{i.label}</p>
          <p className="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-ink-900 sm:text-[16px]">{inr(i.value)}</p>
        </div>
      ))}
      <div className={clsx("min-w-0", compact ? "px-3 py-2.5" : "px-3 py-3 sm:px-4", t.balance > 0 ? "bg-rose-50" : t.balance < 0 ? "bg-emerald-50" : "bg-white")}>
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">{t.balance < 0 ? "Credit (refund due)" : "Balance due"}</p>
        <p className={clsx("mt-0.5 truncate text-[15px] font-bold sm:text-[16px] tabular-nums", t.balance > 0 ? "text-rose-700" : t.balance < 0 ? "text-emerald-700" : "text-ink-900")}>{inr(Math.abs(t.balance || 0))}</p>
      </div>
    </div>
  );
}

function ChargeDialog({ res, onClose }) {
  const { data: meta } = useMeta();
  const [f, setF] = useState({ code: "", description: "", quantity: 1, unitPrice: "" });
  const item = meta.chargeCatalog.find((c) => c.code === f.code);
  const groups = useMemo(() => meta.chargeCatalog.reduce((a, c) => { (a[c.group] ||= []).push(c); return a; }, {}), [meta]);
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/charges`, b), { success: "Charge posted", onSuccess: onClose });
  const total = (Number(f.quantity) || 0) * (Number(f.unitPrice) || 0);
  return (
    <Modal open onClose={onClose} title="Post a charge" subtitle={`${res.guestName} · ${res.confirmationNo}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={!f.code || !total} onClick={() => m.mutate(f)}>Post {total ? inr(total) : ""}</Button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Charge item</label>
          <select className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value, quantity: 1 })}>
            <option value="">Select…</option>
            {Object.entries(groups).map(([g, items]) => <optgroup key={g} label={g}>{items.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}</optgroup>)}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <Input label={item?.perNight ? "Nights / days" : "Quantity"} type="number" min={1} step="1" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
          <Input label="Unit price (₹)" type="number" min={1} value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} />
        </div>
        <Input label={f.code === "MS001" ? "Description" : "Note (optional)"} required={f.code === "MS001"} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
    </Modal>
  );
}

export function PaymentDialog({ res, onClose, onPaid }) {
  const { data: meta } = useMeta();
  const balance = Math.max(0, res.totals?.balance || 0);
  const [splits, setSplits] = useState([{ method: "UPI", amount: String(balance || ""), reference: "" }]);
  const [discount, setDiscount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [tip, setTip] = useState("");
  const [note, setNote] = useState("");
  const paying = splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const disc = Number(discount) || 0;
  const remaining = Math.round((balance - disc - paying) * 100) / 100;
  const over = remaining < -0.001;
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/payments`, b), {
    success: (d) => `Payment recorded · ${d.receiptNo}`,
    onSuccess: (d) => { onPaid?.(d); onClose(); },
  });
  const upd = (i, k, v) => setSplits((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const methodInfo = (id) => meta.paymentMethods.find((p) => p.id === id);
  const missingRef = splits.some((s) => Number(s.amount) > 0 && methodInfo(s.method)?.refRequired && !s.reference.trim());

  return (
    <Modal open onClose={onClose} size="lg" title="Take payment" subtitle={`${res.guestName} · balance ${inr(balance)}`}
      footer={
        <>
          <div className={clsx("w-full text-[13px] sm:mr-auto sm:w-auto", over ? "text-rose-600" : "text-slate-500")}>
            {over ? `Exceeds balance by ${inr(-remaining)}` : remaining > 0 ? `${inr(remaining)} will remain due` : "Settles the folio in full"}
          </div>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" loading={m.isPending} disabled={over || paying <= 0 || missingRef || (disc > 0 && !discountReason.trim())}
            onClick={() => m.mutate({ splits: splits.filter((s) => Number(s.amount) > 0).map((s) => ({ ...s, amount: Number(s.amount) })), discount: disc, discountReason, tip: Number(tip) || 0, note })}>
            Record {inr(paying)}
          </Button>
        </>
      }>
      <div className="space-y-5">
        <div className="space-y-3">
          {splits.map((s, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {meta.paymentMethods.map((p) => (
                  <button key={p.id} type="button" onClick={() => upd(i, "method", p.id)}
                    className={clsx("chip", s.method === p.id ? "border-gold-400 bg-gold-50 text-gold-700" : "border-line text-slate-600 hover:border-slate-300")}>{p.id}</button>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[160px_1fr_auto]">
                <Input label="Amount (₹)" type="number" min={0} value={s.amount} onChange={(e) => upd(i, "amount", e.target.value)} className={splits.length > 1 ? "" : "col-span-2 sm:col-span-1"} />
                <Input className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" label={methodInfo(s.method)?.refLabel} required={methodInfo(s.method)?.refRequired} value={s.reference} onChange={(e) => upd(i, "reference", e.target.value)} />
                {splits.length > 1 && <div className="flex items-end"><IconButton icon={Trash2} label="Remove split" onClick={() => setSplits(splits.filter((_, j) => j !== i))} /></div>}
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => setSplits([...splits, { method: "Cash", amount: remaining > 0 ? String(remaining) : "", reference: "" }])}>Split across another method</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Discount (₹)" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <Input label="Discount reason" className="sm:col-span-2" required={disc > 0} value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="e.g. Loyalty, service recovery" />
          <Input label="Tip / donation (₹)" type="number" min={0} value={tip} onChange={(e) => setTip(e.target.value)} hint="Recorded separately; doesn't affect balance" />
          <Input label="Note" className="sm:col-span-2" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function RefundDialog({ res, onClose }) {
  const { data: meta } = useMeta();
  const credit = Math.max(0, -(res.totals?.balance || 0));
  const [f, setF] = useState({ amount: String(credit), method: "UPI", reference: "", reason: "" });
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/refunds`, b), { success: "Refund recorded", onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Refund guest credit" subtitle={`Credit available ${inr(credit)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" loading={m.isPending} disabled={!Number(f.amount) || f.reason.trim().length < 3} onClick={() => m.mutate({ ...f, amount: Number(f.amount) })}>Refund {inr(Number(f.amount))}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Amount (₹)" type="number" max={credit} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Select label="Method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={meta.paymentMethods.filter((p) => !["Complimentary", "Sponsor"].includes(p.id)).map((p) => p.id)} />
        <Input label="Reference" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        <Input label="Reason" required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      </div>
    </Modal>
  );
}

function VoidDialog({ res, line, onClose }) {
  const [reason, setReason] = useState("");
  const m = useApiMutation((b) => api.post(`/reservations/${res._id}/folio/${line._id}/void`, b), { success: "Line voided", onSuccess: onClose });
  return (
    <Modal open onClose={onClose} size="sm" title={`Void ${line.kind}`} subtitle={`${line.description} · ${inr(line.amount)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Keep</Button><Button variant="danger" loading={m.isPending} disabled={reason.trim().length < 3} onClick={() => m.mutate({ reason })}>Void line</Button></>}>
      <Textarea label="Reason (kept in the audit trail)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
    </Modal>
  );
}

export default function FolioPanel({ res, onPrint }) {
  const { user } = useAuth();
  const [dialog, setDialog] = useState(null);
  const [showVoided, setShowVoided] = useState(false);
  const closed = ["Cancelled", "No Show"].includes(res.status);
  const lines = [...(res.folio || [])].filter((l) => showVoided || !l.voided).sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));
  const voidedCount = (res.folio || []).filter((l) => l.voided).length;
  const canVoid = (l) => !l.voided && (["charge", "discount", "tip"].includes(l.kind) || user.role === "Admin");

  return (
    <div className="space-y-4">
      <FolioSummary totals={res.totals} />
      <div className="flex flex-wrap items-center gap-2">
        {!closed && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setDialog("charge")}>Add charge</Button>}
        {res.totals?.balance > 0 && <Button size="sm" variant="success" icon={CreditCard} onClick={() => setDialog("pay")}>Take payment</Button>}
        {res.totals?.balance < 0 && <Button size="sm" variant="secondary" icon={Undo2} onClick={() => setDialog("refund")}>Refund credit</Button>}
        {onPrint && <Button size="sm" variant="ghost" icon={Printer} onClick={onPrint}>Invoice</Button>}
        {voidedCount > 0 && (
          <div className="w-full sm:ml-auto sm:w-auto"><Segmented size="sm" value={showVoided ? "all" : "live"} onChange={(v) => setShowVoided(v === "all")} options={[{ value: "live", label: "Live" }, { value: "all", label: `All (${voidedCount} void)` }]} /></div>
        )}
      </div>

      <div className="card overflow-hidden">
        {lines.length === 0 ? <Empty icon={Receipt} title="No folio lines yet" /> : (
          <table className="table-base table-fixed sm:table-auto">
            <thead><tr><th className="hidden w-36 sm:table-cell">Posted</th><th>Description</th><th className="w-[92px] text-right sm:w-auto">Amount</th><th className="w-10" /></tr></thead>
            <tbody>
              {lines.map((l) => {
                const K = KIND[l.kind];
                const negative = ["payment", "discount"].includes(l.kind);
                return (
                  <tr key={l._id} className={clsx(l.voided && "bg-slate-50/80 text-slate-400")}>
                    <td className="hidden whitespace-nowrap text-xs text-slate-500 sm:table-cell">{fmtDateTime(l.postedAt)}<span className="block text-[11px] text-slate-400">{l.postedBy}</span></td>
                    <td>
                      <div className="flex items-start gap-2">
                        <K.icon className={clsx("mt-0.5 h-3.5 w-3.5 shrink-0", l.voided ? "text-slate-300" : K.tone)} />
                        <div className={clsx("min-w-0 break-words", l.voided && "line-through decoration-slate-300")}>
                          <span className="text-[13px]">{l.description}</span>
                          <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
                            <span className="sm:hidden">{fmtDateTime(l.postedAt)}</span>
                            {l.receiptNo && <span className="font-mono">{l.receiptNo}</span>}
                            {l.reference && <span>Ref {l.reference}</span>}
                            {l.kind === "tip" && <span>not in balance</span>}
                          </span>
                        </div>
                        {l.voided && <Badge className="ml-auto hidden bg-slate-100 sm:inline-flex text-slate-500 ring-slate-300/40" >Void · {l.voidReason}</Badge>}
                      </div>
                    </td>
                    <td className={clsx("whitespace-nowrap text-right font-medium tabular-nums", !l.voided && K.tone, l.voided && "line-through")}>{negative ? "−" : ""}{inr(l.amount)}</td>
                    <td>{canVoid(l) && <IconButton icon={Ban} label="Void line" onClick={() => setDialog({ void: l })} className="h-7 w-7 hover:text-rose-600" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {res.checkoutOverride?.reason && (
        <Alert tone="warn" title={`Checked out with ${inr(res.checkoutOverride.balance)} outstanding`}>{res.checkoutOverride.reason}{res.checkoutOverride.note && ` — ${res.checkoutOverride.note}`} · authorised by {res.checkoutOverride.by}</Alert>
      )}

      {dialog === "charge" && <ChargeDialog res={res} onClose={() => setDialog(null)} />}
      {dialog === "pay" && <PaymentDialog res={res} onClose={() => setDialog(null)} />}
      {dialog === "refund" && <RefundDialog res={res} onClose={() => setDialog(null)} />}
      {dialog?.void && <VoidDialog res={res} line={dialog.void} onClose={() => setDialog(null)} />}
    </div>
  );
}
