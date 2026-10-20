import { useState } from "react";
import clsx from "clsx";
import { Plus, Moon, Play, Check, Sparkles, BedDouble } from "lucide-react";
import { api } from "../api/client";
import { useApiMutation, useApiQuery, useMeta } from "../api/hooks";
import { PageHeader, Card, Button, Modal, Select, Input, Textarea, PriorityBadge, Loading, Empty, Badge, Stat } from "../components/ui";
import { relTime } from "../lib/format";

const COLUMNS = [
  { status: "Pending", title: "To do", tone: "bg-slate-400" },
  { status: "In Progress", title: "In progress", tone: "bg-sky-500" },
  { status: "Done", title: "Done today", tone: "bg-emerald-500" },
];

function NewTaskDialog({ rooms, onClose, preset }) {
  const { data: meta } = useMeta();
  const [f, setF] = useState({ roomId: preset?.roomId || "", task: preset?.task || "Full Clean", assignedTo: "", priority: "Normal", note: "" });
  const m = useApiMutation((b) => api.post("/housekeeping", b), { success: "Task created", onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="New housekeeping task"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={!f.roomId} onClick={() => m.mutate(f)}>Create task</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Room" required value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })} placeholder="Select room…" options={rooms.map((r) => ({ value: r._id, label: `${r.number} · ${r.property.code} · ${r.status}` }))} />
        <Select label="Task" value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} options={meta.hkTaskTypes} />
        <Input label="Assign to" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })} placeholder="Staff name" />
        <Select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={meta.priorities} />
        <Textarea label="Note" className="sm:col-span-2" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>
    </Modal>
  );
}

export default function HousekeepingPage() {
  const [dialog, setDialog] = useState(null);
  const { data, isLoading } = useApiQuery("housekeeping", "/housekeeping");
  const { data: roomsData } = useApiQuery("rooms", "/rooms");
  const rooms = roomsData?.items || [];
  const update = useApiMutation(({ id, ...b }) => api.patch(`/housekeeping/${id}`, b), { success: (t) => `Room ${t.room.number}: ${t.task} → ${t.status}` });
  const markClean = useApiMutation((id) => api.post(`/rooms/${id}/status`, { status: "Available", note: "Inspected & ready" }), { success: (r) => `Room ${r.number} is ready` });

  const today = new Date().toDateString();
  const tasks = (data?.items || []).filter((t) => t.status !== "Done" || new Date(t.completedAt).toDateString() === today);
  const dirty = rooms.filter((r) => r.status === "Dirty");
  const dndRooms = rooms.filter((r) => r.dnd);

  return (
    <>
      <PageHeader title="Housekeeping" subtitle="Cleaning board — checkouts create tasks automatically"
        actions={<Button icon={Plus} onClick={() => setDialog({})}>New task</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Dirty rooms" value={dirty.length} icon={BedDouble} accent="text-amber-600" />
        <Stat label="Open tasks" value={tasks.filter((t) => t.status !== "Done").length} icon={Sparkles} />
        <Stat label="Done today" value={tasks.filter((t) => t.status === "Done").length} icon={Check} accent="text-emerald-600" />
        <Stat label="Do not disturb" value={dndRooms.length} icon={Moon} accent="text-violet-600" sub={dndRooms.map((r) => r.number).join(", ") || "—"} />
      </div>

      {dirty.length > 0 && (
        <Card className="mb-6 p-4">
          <p className="mb-3 text-[13px] font-semibold">Dirty rooms — quick inspect</p>
          <div className="flex flex-wrap gap-2">
            {dirty.map((r) => (
              <div key={r._id} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 py-1 pl-3 pr-1">
                <span className="text-[13px] font-semibold">{r.number}</span>
                <span className="text-[11px] text-slate-500">{r.property.code}</span>
                <Button size="xs" variant="success" icon={Check} loading={markClean.isPending && markClean.variables === r._id} onClick={() => markClean.mutate(r._id)}>Ready</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? <Loading /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((c) => {
            const list = tasks.filter((t) => t.status === c.status);
            return (
              <div key={c.status} className="rounded-2xl bg-slate-100/70 p-3">
                <div className="mb-3 flex items-center gap-2 px-1"><span className={clsx("h-2 w-2 rounded-full", c.tone)} /><span className="text-[13px] font-semibold">{c.title}</span><span className="text-xs text-slate-500">{list.length}</span></div>
                <div className="space-y-2.5">
                  {list.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Nothing here</p>}
                  {list.map((t) => (
                    <Card key={t._id} className={clsx("p-3.5", t.status === "Done" && "opacity-70")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[15px] font-semibold">Room {t.room.number} <span className="text-xs font-normal text-slate-500">{t.room.property?.code}</span></p>
                          <p className="text-[13px] text-slate-600">{t.task}</p>
                        </div>
                        <PriorityBadge priority={t.priority} />
                      </div>
                      {t.note && <p className="mt-2 text-xs text-slate-500">{t.note}</p>}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-400">{t.assignedTo || "Unassigned"} · {relTime(t.updatedAt)}</span>
                        <div className="flex gap-1">
                          {t.room.dnd && <Badge className="bg-violet-50 text-violet-700 ring-violet-600/15"><Moon className="h-3 w-3" />DND</Badge>}
                          {t.status === "Pending" && <Button size="xs" variant="secondary" icon={Play} onClick={() => update.mutate({ id: t._id, status: "In Progress" })}>Start</Button>}
                          {t.status === "In Progress" && <Button size="xs" variant="success" icon={Check} onClick={() => update.mutate({ id: t._id, status: "Done" })}>Done</Button>}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {dialog && <NewTaskDialog rooms={rooms} preset={dialog} onClose={() => setDialog(null)} />}
      {!isLoading && !tasks.length && !dirty.length && <Empty icon={Sparkles} title="All rooms are clean" />}
    </>
  );
}
