import { sha256 } from "../../shared/archive";
const enc = new TextEncoder();
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function passwordHash(password: string, salt: string) {
  if (password.length < 8 || password.length > 256)
    throw new Error("Use a password between 8 and 256 characters");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function tokenHash(token: string, pepper: string) {
  return sha256(enc.encode(pepper + ":" + token));
}
export async function requireSession(
  request: Request,
  db: D1Database,
  pepper: string,
) {
  const token =
    request.headers
      .get("Authorization")
      ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] ||
    request.headers
      .get("Cookie")
      ?.match(/(?:^|;\s*)corelum_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) throw new HttpError(401, "Administrator sign-in required");
  const row = await db
    .prepare(
      "SELECT sessions.admin_id,admins.role,admins.email AS username FROM sessions JOIN admins ON admins.id=sessions.admin_id WHERE hash=? AND expires_at>?",
    )
    .bind(await tokenHash(token, pepper), Date.now())
    .first<{ admin_id: string; role: "admin" | "user"; username: string }>();
  if (!row)
    throw new HttpError(401, "Your session expired. Please sign in again.");
  return row;
}
export async function requireAdmin(
  request: Request,
  db: D1Database,
  pepper: string,
  allowedCity?: string,
) {
  const session = await requireSession(request, db, pepper);
  if (session.role !== "admin" || session.username.toLowerCase() !== "stormydev")
    throw new HttpError(403, "Administrator access required");
  if (allowedCity) {
    const city = String(request.cf?.city || "").trim().toLowerCase();
    if (!city || city !== allowedCity.trim().toLowerCase())
      throw new HttpError(403, "Administrator access is not permitted from this location");
  }
  return session.admin_id;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
