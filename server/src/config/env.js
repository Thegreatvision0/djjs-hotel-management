import "dotenv/config";

export const env = {
  mongoUri: process.env.MONGO_URI || "",
  port: Number(process.env.PORT) || 5050,
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  seedOnEmpty: (process.env.SEED_ON_EMPTY ?? "true") === "true",
  // Admin login, kept out of the code. Applied on every start (created or password updated).
  adminName: process.env.ADMIN_NAME || "Admin User",
  adminEmail: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  isProd: process.env.NODE_ENV === "production",
};
