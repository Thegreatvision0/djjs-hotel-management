export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const conflict = (msg) => new HttpError(409, msg);
export const forbidden = (msg = "You do not have permission to do this") => new HttpError(403, msg);

// Wraps async route handlers so thrown errors reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Parses a body/query with a zod schema, throwing a 400 with readable messages.
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`);
    throw badRequest(issues[0], issues);
  }
  return result.data;
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
