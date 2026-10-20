// Wipes the configured database and re-seeds demo data: `npm run seed`
import { connectDB, disconnectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { resetDatabase, ensureAdminFromEnv } from "./seed.js";

if (!env.mongoUri) {
  console.error("Set MONGO_URI in server/.env first (the in-memory database is seeded automatically on start).");
  process.exit(1);
}
await connectDB();
await resetDatabase();
await ensureAdminFromEnv();
console.log("✓ Database reset and seeded");
await disconnectDB();
