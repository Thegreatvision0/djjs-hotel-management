import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/User.js";
import { AuditLog } from "../models/Operations.js";
import { HttpError, forbidden } from "../utils/http.js";

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new HttpError(401, "Please sign in");
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || !user.active) throw new HttpError(401, "Account is inactive or no longer exists");
    req.user = user;
    // Convenience audit logger bound to the current user.
    req.audit = (action, type = "edit", ref) =>
      AuditLog.create({ user: user.name, role: user.role, action, type, ref }).catch(() => {});
    // Lightweight actor handed to services: who is acting and how to log it.
    req.actor = { id: user._id, name: user.name, role: user.role, audit: req.audit };
    next();
  } catch (err) {
    next(err instanceof HttpError ? err : new HttpError(401, "Session expired — please sign in again"));
  }
}

export const allow = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};

export const ADMIN = "Admin";
export const FRONT = ["Admin", "Front Desk"];
