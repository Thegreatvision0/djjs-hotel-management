import mongoose from "mongoose";

// Dev-only fallback; referenced by a variable so serverless bundlers (Vercel) skip it.
const MEMORY_SERVER_PKG = "mongodb-memory-server";
import { env } from "./env.js";

let memoryServer = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return; // already connected (warm serverless instance)
  let uri = env.mongoUri;
  if (!uri) {
    if (env.isProd) throw new Error("MONGO_URI is required in production");
    const { MongoMemoryServer } = await import(MEMORY_SERVER_PKG);
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("djjs_hms");
    console.log("⚠  No MONGO_URI set — using in-memory MongoDB (data resets on restart)");
  }
  await mongoose.connect(uri);
  console.log(`✓ MongoDB connected (${mongoose.connection.name})`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
