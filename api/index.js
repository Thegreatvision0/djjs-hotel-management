// Vercel serverless entry: runs the Express API as a single function.
// Every /api/* request is rewritten here (see vercel.json). The MongoDB connection
// and start-up tasks (demo seed on an empty DB, admin from ADMIN_EMAIL/ADMIN_PASSWORD)
// run once per warm instance and are reused across requests.
import { createApp } from "../server/src/app.js";
import { connectDB } from "../server/src/config/db.js";
import { env } from "../server/src/config/env.js";
import { seedIfEmpty, ensureAdminFromEnv } from "../server/src/seed/seed.js";

const app = createApp();
let ready = null;

async function init() {
  await connectDB();
  if (env.seedOnEmpty) await seedIfEmpty();
  await ensureAdminFromEnv();
}

export default async function handler(req, res) {
  try {
    ready ||= init();
    await ready;
  } catch (err) {
    ready = null; // retry on the next request
    console.error("Start-up failed:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: `Server start-up failed: ${err.message}` }));
  }
  return app(req, res);
}
