import "dotenv/config";

// Tolerate common copy-paste mistakes in MONGO_URI (e.g. in the Vercel dashboard):
// surrounding whitespace/quotes, a pasted "MONGODB_URI=" prefix, and special
// characters like "@" in the password that must be percent-encoded.
function normalizeMongoUri(raw) {
  let uri = (raw || "").trim();
  uri = uri.replace(/^(MONGO(DB)?_URI\s*=\s*)+/i, "").trim();
  uri = uri.replace(/^["']+|["']+$/g, "").trim();
  if (!uri) return "";

  const m = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^/?#]*)@([^@/?#]+)(.*)$/);
  if (!m) return uri; // no credentials, or unrecognised: let the driver report it
  const [, scheme, userinfo, host, rest] = m;
  const sep = userinfo.indexOf(":");
  const encode = (s) => encodeURIComponent(safeDecode(s));
  const creds = sep === -1
    ? encode(userinfo)
    : `${encode(userinfo.slice(0, sep))}:${encode(userinfo.slice(sep + 1))}`;
  return `${scheme}${creds}@${host}${rest}`;
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export const env = {
  mongoUri: normalizeMongoUri(process.env.MONGO_URI),
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
