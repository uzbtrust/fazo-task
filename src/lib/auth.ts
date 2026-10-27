import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db, passwordHash } from "./db";
import { ApiError, publicAccount } from "./server";
import type { Account, Role } from "./types";

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

/** Parol hali yaratilmagan hisoblar uchun ham vaqt sarfi bir xil bo‘lsin. */
export const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

/** Sessiya 180 kun yashaydi va ishlatilgan sari uzayadi — foydalanuvchi o‘zi chiqmaguncha kirgan holda qoladi. */
const SESSION_DAYS = 180;
const REFRESH_AFTER_DAYS = 7;

async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const database = await db();
  const row = (
    await database.execute({
      sql: `SELECT m.*,s.expires_at AS session_expires FROM member_sessions s JOIN members m ON s.member_id=m.id
      WHERE s.token_hash=? AND s.expires_at>? AND m.deleted_at IS NULL
        AND m.password_hash IS NOT NULL`,
      args: [tokenHash(token), new Date().toISOString()],
    })
  ).rows[0];
  return row ? { user: publicAccount(row), token, expiresAt: String(row.session_expires) } : null;
}

/** Sahifa (server komponent) uchun: faqat o‘qiydi, cookie yozilmaydi. */
export async function currentUser(): Promise<Account | null> {
  return (await readSession())?.user ?? null;
}

/** Route Handler uchun: ruxsatni tekshiradi va kerak bo‘lsa sessiya muddatini uzaytiradi. */
export async function requireUser(...roles: Role[]): Promise<Account> {
  const session = await readSession();
  if (!session) throw new ApiError(401, "Davom etish uchun hisobingizga kiring.");
  if (roles.length && !roles.includes(session.user.role))
    throw new ApiError(403, "Bu amal sizning rolingiz uchun emas.");
  const left = Date.parse(session.expiresAt) - Date.now();
  if (left < (SESSION_DAYS - REFRESH_AFTER_DAYS) * 864e5) await writeSession(session.token, session.user.id, true);
  return session.user;
}

async function writeSession(token: string, memberId: string, extend = false) {
  const expiry = new Date(Date.now() + SESSION_DAYS * 864e5);
  const database = await db();
  if (extend) {
    await database.execute({
      sql: "UPDATE member_sessions SET expires_at=? WHERE token_hash=?",
      args: [expiry.toISOString(), tokenHash(token)],
    });
  } else {
    await database.batch(
      [
        { sql: "DELETE FROM member_sessions WHERE expires_at < ?", args: [new Date().toISOString()] },
        {
          sql: "INSERT INTO member_sessions(token_hash,member_id,expires_at) VALUES (?,?,?)",
          args: [tokenHash(token), memberId, expiry.toISOString()],
        },
      ],
      "write",
    );
  }
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !!process.env.VERCEL,
    sameSite: "lax",
    path: "/",
    expires: expiry,
  });
}

export async function createSession(memberId: string) {
  await writeSession(randomBytes(32).toString("hex"), memberId);
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    await (
      await db()
    ).execute({
      sql: "DELETE FROM member_sessions WHERE token_hash=?",
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
        "Urinishlar ko‘paydi. 15 daqiqadan keyin qayta urinib ko‘ring.",
      );
  }
  // Keep the persisted limiter bounded without timers or server memory.
  await database.execute({
    sql: "DELETE FROM login_attempts WHERE reset_at<?",
    args: [now],
  });
}
