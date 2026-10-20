import { useRef, useState } from "react";
import clsx from "clsx";
import { Minus, Plus, ShoppingBag, Trash2, ChefHat, BedDouble, UtensilsCrossed, Settings2, Check } from "lucide-react";
import { api } from "../api/client";
import { useApiMutation, useApiQuery, useMeta } from "../api/hooks";
import { PageHeader, Card, CardHeader, Button, Tabs, Segmented, Input, Select, Modal, Badge, Empty, Loading, Toggle } from "../components/ui";
import { inr, relTime } from "../lib/format";

const STATUS_TONE = { "In Kitchen": "bg-amber-50 text-amber-700 ring-amber-600/20", Served: "bg-sky-50 text-sky-700 ring-sky-600/15", Settled: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", Cancelled: "bg-zinc-100 text-zinc-500 ring-zinc-400/20" };

function MenuManager({ items, onClose }) {
  const [f, setF] = useState({ name: "", category: "Mains", price: "" });
  const add = useApiMutation((b) => api.post("/pos/menu", b), { success: "Item added", invalidate: ["pos"], onSuccess: () => setF({ ...f, name: "", price: "" }) });
  const toggle = useApiMutation(({ id, ...b }) => api.patch(`/pos/menu/${id}`, b), { invalidate: ["pos"] });
  return (
    <Modal open onClose={onClose} size="lg" title="Menu" subtitle="Add items or mark them unavailable">
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_160px_120px_auto]">
        <Input label="Item" className="col-span-2 sm:col-span-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <Input label="Price (₹)" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <div className="col-span-2 flex items-end sm:col-span-1"><Button icon={Plus} className="w-full sm:w-auto" loading={add.isPending} disabled={!f.name || !f.price} onClick={() => add.mutate({ ...f, price: Number(f.price) })}>Add</Button></div>
      </div>
      <div className="divide-y divide-line rounded-xl border border-line">
        {items.map((i) => (
          <div key={i._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span><span className="font-medium">{i.name}</span> <span className="text-xs text-slate-500">{i.category} · {inr(i.price)}</span></span>
            <Toggle checked={i.available} onChange={(v) => toggle.mutate({ id: i._id, available: v })} label={i.available ? "Available" : "Off"} />
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function PosPage() {
  const { data: meta } = useMeta();
  const [tab, setTab] = useState("order");
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState([]);
  const [target, setTarget] = useState("table");
  const [table, setTable] = useState("");
  const [resId, setResId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [settle, setSettle] = useState(null);
  const cartRef = useRef(null);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const { data: menu, isLoading } = useApiQuery("pos", "/pos/menu");
  const { data: inHouse } = useApiQuery("pos", "/pos/in-house");
  const { data: orders } = useApiQuery("pos", "/pos/orders");
  const items = menu?.items || [];
  const cats = ["All", ...new Set(items.map((i) => i.category))];
  const visible = items.filter((i) => cat === "All" || i.category === cat);
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const openOrders = (orders?.items || []).filter((o) => ["In Kitchen", "Served"].includes(o.status));

  const add = (i) => setCart((c) => (c.some((x) => x._id === i._id) ? c.map((x) => (x._id === i._id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { ...i, qty: 1 }]));
  const qty = (id, d) => setCart((c) => c.map((x) => (x._id === id ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));

  const place = useApiMutation((b) => api.post("/pos/orders", b), {
    success: (o) => `${o.orderNo} sent to kitchen${o.roomLabel ? ` · charged to Room ${o.roomLabel}` : ""}`,
    invalidate: ["pos", "reservation", "billing"],
    onSuccess: () => { setCart([]); setTable(""); setResId(""); },
  });
  const updateOrder = useApiMutation(({ id, ...b }) => api.patch(`/pos/orders/${id}`, b), { success: (o) => `${o.orderNo} → ${o.status}`, invalidate: ["pos"], onSuccess: () => setSettle(null) });

  return (
    <>
      <PageHeader title="Restaurant POS" subtitle="Take orders for tables or charge them to an in-house guest's folio"
        actions={<Button variant="secondary" icon={Settings2} onClick={() => setMenuOpen(true)}>Manage menu</Button>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: "order", label: "New order", icon: UtensilsCrossed }, { value: "orders", label: "Open orders", icon: ChefHat, count: openOrders.length }]} />

      {tab === "order" ? (
        <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-[1fr_340px] lg:pb-0 xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_400px]">
          <div className="min-w-0">
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 scroll-thin sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={clsx("chip shrink-0", cat === c ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-slate-600")}>{c}</button>)}
            </div>
            {isLoading ? <Loading /> : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-3">
                {visible.map((i) => (
                  <button key={i._id} disabled={!i.available} onClick={() => add(i)}
                    className="card flex min-w-0 flex-col justify-between p-3 text-left transition sm:p-4 hover:-translate-y-0.5 hover:shadow-pop disabled:opacity-40">
                    <span className="text-[14px] font-medium leading-snug">{i.name}</span>
                    <span className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">{i.category}</span><span className="font-semibold text-gold-600">{inr(i.price)}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Card className="h-fit lg:sticky lg:top-6">
            <div ref={cartRef} className="scroll-mt-20" />
            <CardHeader title="Current order" icon={ShoppingBag} action={cart.length > 0 && <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setCart([])}>Clear</Button>} />
            <div className="space-y-4 p-4">
              <Segmented value={target} onChange={setTarget} options={[{ value: "table", label: "Table", icon: UtensilsCrossed }, { value: "room", label: "Room charge", icon: BedDouble }]} />
              {target === "table" ? <Input placeholder="Table no. e.g. T4" value={table} onChange={(e) => setTable(e.target.value)} />
                : <Select value={resId} onChange={(e) => setResId(e.target.value)} placeholder="Select in-house guest…" options={(inHouse?.items || []).map((r) => ({ value: r._id, label: `${r.room?.number} · ${r.guestName}` }))} />}
              {cart.length === 0 ? <p className="py-8 text-center text-[13px] text-slate-400">Tap menu items to add them</p> : (
                <div className="divide-y divide-line">
                  {cart.map((c) => (
                    <div key={c._id} className="flex items-center gap-2 py-2">
                      <span className="flex-1 text-[13.5px]">{c.name}<span className="block text-xs text-slate-500">{inr(c.price)}</span></span>
                      <button className="rounded-md border border-line p-1 hover:bg-slate-50" onClick={() => qty(c._id, -1)}><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">{c.qty}</span>
                      <button className="rounded-md border border-line p-1 hover:bg-slate-50" onClick={() => qty(c._id, 1)}><Plus className="h-3 w-3" /></button>
                      <span className="w-16 text-right text-[13px] font-medium tabular-nums">{inr(c.price * c.qty)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-line pt-3"><span className="text-[13px] text-slate-500">Total</span><span className="text-xl font-semibold">{inr(total)}</span></div>
              <Button className="w-full" size="lg" variant="gold" loading={place.isPending} disabled={!cart.length || (target === "table" ? !table.trim() : !resId)}
                onClick={() => place.mutate({ table: target === "table" ? table : "", reservationId: target === "room" ? resId : null, items: cart.map((c) => ({ menuItemId: c._id, qty: c.qty })) })}>
                {target === "room" ? "Charge to room" : "Send to kitchen"}
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden">
          {!(orders?.items || []).length ? <Empty icon={ChefHat} title="No orders yet" /> : (
            <div className="table-scroll"><table className="table-base">
              <thead><tr><th>Order</th><th>For</th><th className="hidden md:table-cell">Items</th><th className="text-right">Total</th><th className="hidden sm:table-cell">Status</th><th /></tr></thead>
              <tbody>
                {orders.items.map((o) => (
                  <tr key={o._id}>
                    <td className="font-mono text-xs">{o.orderNo}<span className="block font-sans text-[11px] text-slate-400">{relTime(o.createdAt)}</span></td>
                    <td>{o.reservation ? <span>Room {o.roomLabel}<span className="block text-xs text-slate-500">{o.guestName}</span></span> : `Table ${o.table}`}</td>
                    <td className="hidden max-w-[320px] text-[13px] text-slate-600 md:table-cell">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                    <td className="text-right font-medium">{inr(o.total)}<div className="mt-1 sm:hidden"><Badge className={STATUS_TONE[o.status]}>{o.status}</Badge></div></td>
                    <td className="hidden sm:table-cell"><Badge className={STATUS_TONE[o.status]}>{o.status}</Badge>{o.paymentMethod && <span className="ml-1 text-xs text-slate-500">{o.paymentMethod}</span>}</td>
                    <td className="text-right">
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                      {o.status === "In Kitchen" && <Button size="xs" variant="secondary" onClick={() => updateOrder.mutate({ id: o._id, status: "Served" })}>Served</Button>}
                      {o.status === "Served" && (o.reservation
                        ? <Button size="xs" variant="success" icon={Check} onClick={() => updateOrder.mutate({ id: o._id, status: "Settled" })}>Close (on folio)</Button>
                        : <Button size="xs" variant="success" onClick={() => setSettle(o)}>Settle</Button>)}
                      {o.status === "In Kitchen" && !o.reservation && <Button size="xs" variant="danger-ghost" onClick={() => updateOrder.mutate({ id: o._id, status: "Cancelled" })}>Cancel</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      )}

      {/* Phones & tablets: floating cart summary that jumps to the order panel */}
      {tab === "order" && cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <button onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex w-full items-center justify-between rounded-xl bg-gold-500 px-4 py-3 text-white shadow-pop">
            <span className="flex items-center gap-2 font-medium"><ShoppingBag className="h-4 w-4" />{cartCount} item{cartCount === 1 ? "" : "s"} · review order</span>
            <span className="font-semibold">{inr(total)}</span>
          </button>
        </div>
      )}
      {menuOpen && <MenuManager items={items} onClose={() => setMenuOpen(false)} />}
      {settle && (
        <Modal open onClose={() => setSettle(null)} size="sm" title={`Settle ${settle.orderNo}`} subtitle={`Table ${settle.table} · ${inr(settle.total)}`}>
          <div className="grid grid-cols-2 gap-2">
            {meta.paymentMethods.filter((m) => !["Sponsor"].includes(m.id)).map((m) => (
              <Button key={m.id} variant="secondary" loading={updateOrder.isPending && updateOrder.variables?.paymentMethod === m.id} onClick={() => updateOrder.mutate({ id: settle._id, status: "Settled", paymentMethod: m.id })}>{m.id}</Button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
