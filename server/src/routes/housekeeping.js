import { Router } from "express";
import { z } from "zod";
import { HousekeepingTask } from "../models/Operations.js";
import Room from "../models/Room.js";
import { allow } from "../middleware/auth.js";
import { ah, parse, notFound } from "../utils/http.js";
import { HK_TASK_TYPES, HK_STATUSES, PRIORITIES } from "../config/constants.js";

const r = Router();
r.use(allow("Admin", "Housekeeping", "Front Desk"));

const populate = { path: "room", select: "number floor status dnd property", populate: { path: "property", select: "code name" } };

r.get("/", ah(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  else if (req.query.open === "true") q.status = { $ne: "Done" };
  const items = await HousekeepingTask.find(q).sort({ status: 1, createdAt: -1 }).limit(300).populate(populate).lean();
  const order = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
  items.sort((a, b) => (a.status === "Done") - (b.status === "Done") || order[a.priority] - order[b.priority]);
  res.json({ items });
}));

const taskSchema = z.object({
  roomId: z.string(),
  task: z.enum(HK_TASK_TYPES),
  assignedTo: z.string().optional().default(""),
  priority: z.enum(PRIORITIES).default("Normal"),
  note: z.string().optional().default(""),
});

r.post("/", ah(async (req, res) => {
  const input = parse(taskSchema, req.body);
  const room = await Room.findById(input.roomId);
  if (!room) throw notFound("Room");
  const task = await HousekeepingTask.create({ ...input, room: room._id, createdBy: req.user.name });
  req.audit(`HK task "${input.task}" for Room ${room.number}${input.assignedTo ? ` → ${input.assignedTo}` : ""}`, "housekeeping");
  res.status(201).json(await task.populate(populate));
}));

r.patch("/:id", ah(async (req, res) => {
  const input = parse(z.object({
    status: z.enum(HK_STATUSES).optional(),
    assignedTo: z.string().optional(),
    priority: z.enum(PRIORITIES).optional(),
    note: z.string().optional(),
  }), req.body);
  const task = await HousekeepingTask.findById(req.params.id).populate("room");
  if (!task) throw notFound("Task");
  Object.assign(task, input);
  if (input.status === "Done") {
    task.completedAt = new Date();
    // Finishing a cleaning task on a dirty room makes it sellable again.
    if (task.room.status === "Dirty" && ["Checkout Clean", "Full Clean", "Deep Clean"].includes(task.task)) {
      task.room.setStatus("Available", req.user.name, `Cleaned (${task.task})`);
      await task.room.save();
    }
  }
  await task.save();
  req.audit(`HK task "${task.task}" Room ${task.room.number} → ${task.status}`, "housekeeping");
  res.json(await HousekeepingTask.findById(task._id).populate(populate));
}));

r.delete("/:id", allow("Admin"), ah(async (req, res) => {
  await HousekeepingTask.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

export default r;
