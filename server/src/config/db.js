import mongoose from "mongoose";
import { env } from "./env.js";

let memoryServer = null;

export async function connectDB() {
  let uri = env.mongoUri;
  if (!uri) {
    if (env.isProd) throw new Error("MONGO_URI is required in production");
    const { MongoMemoryServer } = await import("mongodb-memory-server");
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
