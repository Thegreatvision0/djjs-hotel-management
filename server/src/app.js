import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import metaRoutes from "./routes/meta.js";
import dashboardRoutes from "./routes/dashboard.js";
import reservationRoutes from "./routes/reservations.js";
import roomRoutes from "./routes/rooms.js";
import guestRoutes from "./routes/guests.js";
import billingRoutes from "./routes/billing.js";
import housekeepingRoutes from "./routes/housekeeping.js";
import posRoutes from "./routes/pos.js";
import userRoutes from "./routes/users.js";
import reportRoutes from "./routes/reports.js";

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.clientOrigin.split(","), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  if (!env.isProd) app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/meta", requireAuth, metaRoutes);
  app.use("/api/dashboard", requireAuth, dashboardRoutes);
  app.use("/api/reservations", requireAuth, reservationRoutes);
  app.use("/api/rooms", requireAuth, roomRoutes);
  app.use("/api/guests", requireAuth, guestRoutes);
  app.use("/api/billing", requireAuth, billingRoutes);
  app.use("/api/housekeeping", requireAuth, housekeepingRoutes);
  app.use("/api/pos", requireAuth, posRoutes);
  app.use("/api/users", requireAuth, userRoutes);
  app.use("/api", requireAuth, reportRoutes); // /api/reports/:type, /api/night-audit, /api/audit-logs
  app.use("/api", notFoundHandler);

  // In production, serve the built React client from the same origin.
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
