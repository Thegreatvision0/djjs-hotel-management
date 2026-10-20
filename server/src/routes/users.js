import { Router } from "express";
import { z } from "zod";
import User from "../models/User.js";
import { allow, ADMIN } from "../middleware/auth.js";
import { ah, parse, badRequest, notFound } from "../utils/http.js";
import { ROLES } from "../config/constants.js";

const r = Router();
r.use(allow(ADMIN));

r.get("/", ah(async (_req, res) => res.json({ items: await User.find().sort("name") })));

r.post("/", ah(async (req, res) => {
  const input = parse(z.object({ name: z.string().trim().min(2), email: z.string().email(), role: z.enum(ROLES), password: z.string().min(6, "Password must be at least 6 characters") }), req.body);
  const user = new User({ name: input.name, email: input.email, role: input.role });
  await user.setPassword(input.password);
  await user.save();
  req.audit(`User created: ${user.name} (${user.role})`, "user");
  res.status(201).json(user);
}));

r.patch("/:id", ah(async (req, res) => {
  const input = parse(z.object({ name: z.string().trim().min(2).optional(), role: z.enum(ROLES).optional(), active: z.boolean().optional(), password: z.string().min(6).optional() }), req.body);
  const user = await User.findById(req.params.id);
  if (!user) throw notFound("User");
  const isSelf = user._id.equals(req.user._id);
  if (isSelf && (input.active === false || (input.role && input.role !== "Admin"))) throw badRequest("You cannot deactivate or demote your own account.");
  if (input.name) user.name = input.name;
  if (input.role) user.role = input.role;
  if (input.active !== undefined) user.active = input.active;
  if (input.password) await user.setPassword(input.password);
  await user.save();
  const changes = [input.role && `role → ${input.role}`, input.active !== undefined && (input.active ? "activated" : "deactivated"), input.password && "password reset"].filter(Boolean).join(", ");
  req.audit(`User ${user.name} updated${changes ? `: ${changes}` : ""}`, "user");
  res.json(user);
}));

export default r;
