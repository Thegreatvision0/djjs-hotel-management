import { Router } from "express";
import { z } from "zod";
import User from "../models/User.js";
import { AuditLog } from "../models/Operations.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { ah, parse, HttpError, badRequest } from "../utils/http.js";

const r = Router();

r.post("/login", ah(async (req, res) => {
  const { email, password } = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !(await user.checkPassword(password))) throw new HttpError(401, "Incorrect email or password");
  if (!user.active) throw new HttpError(403, "This account has been deactivated");
  user.lastLoginAt = new Date();
  await user.save();
  AuditLog.create({ user: user.name, role: user.role, type: "auth", action: `${user.name} signed in` }).catch(() => {});
  res.json({ token: signToken(user), user: user.toJSON() });
}));

r.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

r.post("/change-password", requireAuth, ah(async (req, res) => {
  const { current, next } = parse(z.object({ current: z.string(), next: z.string().min(6, "New password must be at least 6 characters") }), req.body);
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!(await user.checkPassword(current))) throw badRequest("Current password is incorrect");
  await user.setPassword(next);
  await user.save();
  req.audit("Changed own password", "auth");
  res.json({ ok: true });
}));

export default r;
