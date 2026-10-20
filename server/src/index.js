import os from "node:os";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";
import { seedIfEmpty } from "./seed/seed.js";

async function main() {
  await connectDB();
  if (env.seedOnEmpty) await seedIfEmpty();
  const app = createApp();
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`✓ Listening on http://localhost:${env.port}`);
    // Print the addresses other devices on the local network can use.
    Object.values(os.networkInterfaces()).flat()
      .filter((i) => i && i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254"))
      .forEach((i) => console.log(`  ↳ Share on your network: http://${i.address}:${env.port}`));
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
