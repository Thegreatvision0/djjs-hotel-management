import { useState } from "react";
import clsx from "clsx";
import { Plus, Moon, Play, Check, Sparkles, BedDouble, Trash2, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import { useApiMutation, useApiQuery, useMeta } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Card, Button, Modal, Select, Input, Textarea, PriorityBadge, RoomStatusBadge, Loading, Empty, Badge, Stat, KV, Confirm } from "../components/ui";
import { relTime, fmtDateTime } from "../lib/format";

const COLUMNS = [
  { status: "Pending", title: "To do", tone: "bg-slate-400" },
  { status: "In Progress", title: "In progress", tone: "bg-sky-500" },
  { status: "Done", title: "Done today", tone: "bg-emerald-500" },
];

// Keyboard-accessible click target for cards and rows.
const clickable = (onClick) => ({
  role: "button",
  tabIndex: 0,
  onClick,
  onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
});
const stop = (e) => e.stopPropagation();

function NewTaskDialog({ rooms, onClose, preset }) {
  const { data: meta } = useMeta();
  const [f, setF] = useState({ roomId: preset?.roomId || "", task: preset?.task || "Full Clean", assignedTo: "", priority: preset?.priority || "Normal", note: "" });
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

// Full task form: every field of the task, editable, plus its history.
function TaskDetailDialog({ task: t, onClose }) {
  const { data: meta } = useMeta();
  const { user } = useAuth();
  const [f, setF] = useState({ task: t.task, status: t.status, assignedTo: t.assignedTo || "", priority: t.priority, note: t.note || "" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const changes = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== (t[k] ?? "")));
  const dirty = Object.keys(changes).length > 0;
  const save = useApiMutation((b) => api.patch(`/housekeeping/${t._id}`, b), { success: (x) => `Room ${x.room.number}: task updated`, onSuccess: onClose });
  const remove = useApiMutation(() => api.delete(`/housekeeping/${t._id}`), { success: "Task deleted", onSuccess: onClose });
  const room = t.room || {};

  return (
    <Modal open onClose={onClose} size="lg" title={`Room ${room.number} · ${t.task}`} subtitle={`${room.property?.name || room.property?.code || ""}${room.floor != null ? ` · Floor ${room.floor === 0 ? "Ground" : room.floor}` : ""}`}
      footer={<>
        {user?.role === "Admin" && <Button variant="danger-ghost" icon={Trash2} className="mr-auto" onClick={() => setConfirmDelete(true)}>Delete</Button>}
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(changes)}>Save changes</Button>
      </>}>
      <div className="mb-5 grid grid-cols-2 gap-4 rounded-xl border border-line bg-slate-50/60 p-4 sm:grid-cols-4">
        <KV label="Room status"><RoomStatusBadge status={room.status} /></KV>
        <KV label="Do not disturb">{room.dnd ? <Badge className="bg-violet-50 text-violet-700 ring-violet-600/15"><Moon className="h-3 w-3" />DND on</Badge> : "No"}</KV>
        <KV label="Current status">{t.status}</KV>
        <KV label="Priority"><PriorityBadge priority={t.priority} /></KV>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Task" value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} options={meta.hkTaskTypes} />
        <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={meta.hkStatuses} />
        <Input label="Assigned to" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })} placeholder="Staff name" />
        <Select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} options={meta.priorities} />
        <Textarea label="Note" className="sm:col-span-2" rows={4} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
        <KV label="Created by">{t.createdBy}</KV>
        <KV label="Created">{t.createdAt && fmtDateTime(t.createdAt)}</KV>
        <KV label="Last updated">{t.updatedAt && fmtDateTime(t.updatedAt)}</KV>
        <KV label="Completed">{t.completedAt && fmtDateTime(t.completedAt)}</KV>
      </dl>
      <Confirm open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} variant="danger" confirmLabel="Delete task" title="Delete this task?">
        Room {room.number} · {t.task} will be removed permanently.
      </Confirm>
    </Modal>
  );
}

function TaskRow({ t, onOpen }) {
  return (
    <li {...clickable(() => onOpen(t))} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition hover:bg-gold-50/40">
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">Room {t.room.number} <span className="text-xs font-normal text-slate-500">{t.room.property?.code}</span></span>
        <span className="block truncate text-[13px] text-slate-600">{t.task} · {t.assignedTo || "Unassigned"} · {t.status}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2"><PriorityBadge priority={t.priority} /><ChevronRight className="h-4 w-4 text-slate-300" /></span>
    </li>
  );
}

// Lists behind each stat tile.
function ListDialog({ kind, tasks, dirty, dndRooms, onClose, onOpenTask, onNewTask, markClean }) {
  const titles = { dirty: "Dirty rooms", open: "Open tasks", done: "Done today", dnd: "Do not disturb" };
  const list = kind === "open" ? tasks.filter((t) => t.status !== "Done") : kind === "done" ? tasks.filter((t) => t.status === "Done") : [];
  const rooms = kind === "dirty" ? dirty : kind === "dnd" ? dndRooms : [];
  const isRooms = kind === "dirty" || kind === "dnd";
  const count = isRooms ? rooms.length : list.length;
  return (
    <Modal open onClose={onClose} title={titles[kind]} subtitle={`${count} ${isRooms ? "room" : "task"}${count === 1 ? "" : "s"}`}>
      {count === 0 ? <Empty title="Nothing here" /> : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {isRooms ? rooms.map((r) => {
            const openTask = tasks.find((t) => t.room._id === r._id && t.status !== "Done");
            return (
              <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span><span className="font-semibold">Room {r.number}</span> <span className="text-xs text-slate-500">{r.property.code}{r.floor != null ? ` · Floor ${r.floor === 0 ? "G" : r.floor}` : ""}</span>
                  <span className="mt-0.5 block"><RoomStatusBadge status={r.status} /></span></span>
                <span className="flex gap-1">
                  {openTask
                    ? <Button size="xs" variant="secondary" onClick={() => onOpenTask(openTask)}>View task</Button>
                    : <Button size="xs" variant="secondary" icon={Plus} onClick={() => onNewTask({ roomId: r._id, task: "Checkout Clean" })}>Task</Button>}
                  {r.status === "Dirty" && <Button size="xs" variant="success" icon={Check} loading={markClean.isPending && markClean.variables === r._id} onClick={() => markClean.mutate(r._id)}>Ready</Button>}
                </span>
              </li>
            );
          }) : list.map((t) => <TaskRow key={t._id} t={t} onOpen={onOpenTask} />)}
        </ul>
      )}
    </Modal>
  );
}

export default function HousekeepingPage() {
  const [dialog, setDialog] = useState(null); // new-task preset
  const [openId, setOpenId] = useState(null); // task detail
  const [listKind, setListKind] = useState(null);
  const { data, isLoading } = useApiQuery("housekeeping", "/housekeeping");
  const { data: roomsData } = useApiQuery("rooms", "/rooms");
  const rooms = roomsData?.items || [];
  const update = useApiMutation(({ id, ...b }) => api.patch(`/housekeeping/${id}`, b), { success: (t) => `Room ${t.room.number}: ${t.task} → ${t.status}` });
  const markClean = useApiMutation((id) => api.post(`/rooms/${id}/status`, { status: "Available", note: "Inspected & ready" }), { success: (r) => `Room ${r.number} is ready` });

  const today = new Date().toDateString();
  const tasks = (data?.items || []).filter((t) => t.status !== "Done" || new Date(t.completedAt).toDateString() === today);
  const dirty = rooms.filter((r) => r.status === "Dirty");
  const dndRooms = rooms.filter((r) => r.dnd);
  const openTask = openId && (data?.items || []).find((t) => t._id === openId);
  const showTask = (t) => { setListKind(null); setOpenId(t._id); };
  const newTask = (preset) => { setListKind(null); setDialog(preset); };

  return (
    <>
      <PageHeader title="Housekeeping" subtitle="Cleaning board — click any card to open it"
        actions={<Button icon={Plus} onClick={() => setDialog({})}>New task</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Dirty rooms" value={dirty.length} icon={BedDouble} accent="text-amber-600" onClick={() => setListKind("dirty")} />
        <Stat label="Open tasks" value={tasks.filter((t) => t.status !== "Done").length} icon={Sparkles} onClick={() => setListKind("open")} />
        <Stat label="Done today" value={tasks.filter((t) => t.status === "Done").length} icon={Check} accent="text-emerald-600" onClick={() => setListKind("done")} />
        <Stat label="Do not disturb" value={dndRooms.length} icon={Moon} accent="text-violet-600" sub={dndRooms.map((r) => r.number).join(", ") || "—"} onClick={() => setListKind("dnd")} />
      </div>

      {dirty.length > 0 && (
        <Card className="mb-6 p-4">
          <p className="mb-3 text-[13px] font-semibold">Dirty rooms — click a room to create a cleaning task</p>
          <div className="flex flex-wrap gap-2">
            {dirty.map((r) => {
              const existing = tasks.find((t) => t.room._id === r._id && t.status !== "Done");
              return (
                <div key={r._id} {...clickable(() => (existing ? showTask(existing) : newTask({ roomId: r._id, task: "Checkout Clean" })))}
                  title={existing ? "Open the cleaning task" : "Create a cleaning task"}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 py-1 pl-3 pr-1 transition hover:border-amber-300 hover:bg-amber-100/70">
                  <span className="text-[13px] font-semibold">{r.number}</span>
                  <span className="text-[11px] text-slate-500">{r.property.code}</span>
                  {existing && <span className="text-[11px] text-sky-700">{existing.status}</span>}
                  <Button size="xs" variant="success" icon={Check} loading={markClean.isPending && markClean.variables === r._id} onClick={(e) => { stop(e); markClean.mutate(r._id); }}>Ready</Button>
                </div>
              );
            })}
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
                    <Card key={t._id} {...clickable(() => showTask(t))}
                      className={clsx("cursor-pointer p-3.5 transition hover:-translate-y-0.5 hover:shadow-pop focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400", t.status === "Done" && "opacity-70")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[15px] font-semibold">Room {t.room.number} <span className="text-xs font-normal text-slate-500">{t.room.property?.code}</span></p>
                          <p className="text-[13px] text-slate-600">{t.task}</p>
                        </div>
                        <PriorityBadge priority={t.priority} />
                      </div>
                      {t.note && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{t.note}</p>}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-400">{t.assignedTo || "Unassigned"} · {relTime(t.updatedAt)}</span>
                        <div className="flex gap-1" onClick={stop} onKeyDown={stop}>
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
      {openTask && <TaskDetailDialog key={openTask._id + openTask.updatedAt} task={openTask} onClose={() => setOpenId(null)} />}
      {listKind && <ListDialog kind={listKind} tasks={tasks} dirty={dirty} dndRooms={dndRooms} onClose={() => setListKind(null)} onOpenTask={showTask} onNewTask={newTask} markClean={markClean} />}
      {!isLoading && !tasks.length && !dirty.length && <Empty icon={Sparkles} title="All rooms are clean" />}
    </>
  );
}
