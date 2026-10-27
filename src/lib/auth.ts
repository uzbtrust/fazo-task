import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db, passwordHash } from "./db";
import { ApiError, publicAccount } from "./server";
import type { Account } from "./types";

export const SESSION_COOKIE = "fazo_session";
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export { passwordHash };

export function checkPassword(password: string, stored: string): boolean {
  try {
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    return timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(key, "hex"),
    );
  } catch {
    return false;
  }
}

export async function currentUser(): Promise<Account | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const database = await db();
  const result = await database.execute({
    sql: `SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id
      WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.deleted_at IS NULL
        AND u.role='admin'`,
    args: [tokenHash(token), new Date().toISOString()],
  });
  return result.rows[0] ? publicAccount(result.rows[0]) : null;
}

export async function requireUser(): Promise<Account> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Davom etish uchun hisobingizga kiring.");
  return user;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const database = await db();
  await database.batch(
    [
      {
        sql: "DELETE FROM sessions WHERE expires_at < ?",
        args: [new Date().toISOString()],
      },
      {
        sql: "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)",
        args: [tokenHash(token), userId, expiry.toISOString()],
      },
    ],
    "write",
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !!process.env.VERCEL,
    sameSite: "lax",
    path: "/",
    expires: expiry,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    await (
      await db()
    ).execute({
      sql: "DELETE FROM sessions WHERE token_hash=?",
      args: [tokenHash(token)],
    });
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: !!process.env.VERCEL,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function loginLimit(request: Request, username: string) {
  const now = Date.now();
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  const database = await db();
  for (const [key, max] of [
    [`user:${username.toLowerCase()}`, 10],
    [`ip:${ip}`, 40],
  ] as const) {
    const result = await database.execute({
      sql: `INSERT INTO login_attempts(key,attempts,reset_at) VALUES (?,1,?)
        ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,
        reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END RETURNING attempts`,
      args: [tokenHash(key), now + 15 * 60 * 1000, now, now],
    });
    if (Number(result.rows[0]?.attempts) > max)
      throw new ApiError(
        429,
        "Kirishga urinishlar ko‘paydi. 15 daqiqadan keyin qayta urinib ko‘ring.",
      );
  }
  // Keep the persisted limiter bounded without timers or server memory.
  await database.execute({
    sql: "DELETE FROM login_attempts WHERE reset_at<?",
    args: [now],
  });
}
