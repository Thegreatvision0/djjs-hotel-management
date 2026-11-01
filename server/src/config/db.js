import mongoose from "mongoose";
import { env } from "./env.js";

// Dev-only fallback; referenced by a variable so serverless bundlers (Vercel) skip it.
const MEMORY_SERVER_PKG = "mongodb-memory-server";
const CONNECT_TIMEOUT_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 10_000;

let memoryServer = null;

async function connectMemory() {
  const { MongoMemoryServer } = await import(MEMORY_SERVER_PKG);
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri("djjs_hms"));
}

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return; // already connected (warm serverless instance)

  if (!env.mongoUri) {
    if (env.isProd) throw new Error("MONGO_URI is required in production");
    await connectMemory();
    console.log("⚠  No MONGO_URI set — using in-memory MongoDB (data resets on restart)");
    return;
  }

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
    console.log(`✓ MongoDB connected (${mongoose.connection.name})`);
  } catch (err) {
    // In production there is no fallback: surface the real error.
    if (env.isProd) throw err;
    // Local development: don't let an unreachable database stop the app from starting.
    // Common cause: a network that blocks outbound port 27017 (MongoDB), or this IP
    // missing from Atlas → Network Access.
    await mongoose.disconnect().catch(() => {});
    console.warn(`⚠  Could not reach MongoDB at MONGO_URI within ${CONNECT_TIMEOUT_MS / 1000}s (${err.name}).`);
    console.warn("   Likely causes: this network blocks port 27017, or this IP isn't allowed in Atlas → Network Access.");
    console.warn("   Starting with a temporary in-memory database instead (demo data, resets on restart).");
    await connectMemory();
    console.log("✓ In-memory MongoDB ready");
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
