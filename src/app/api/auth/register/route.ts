import { db, passwordHash } from "@/lib/db";
import { createSession, loginLimit } from "@/lib/auth";
import { roleInfo } from "@/lib/roles";
import {
  api,
  ApiError,
  checkOrigin,
  newPassword,
  publicAccount,
  readBody,
  text,
} from "@/lib/server";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Ro‘yxatdan o‘tish: login administrator tomonidan beriladi, parolni hodim o‘zi yaratadi.
 * Faqat `password` yuborilmasa — login tekshiriladi; yuborilsa — parol o‘rnatilib, sessiya ochiladi.
 */
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const body = await readBody(request);
    const username = text(body.username, "Loginni", 32).toLowerCase();
    await loginLimit(request, username);
    const database = await db();
    const row = (
      await database.execute({
        sql: `SELECT * FROM members WHERE username=? COLLATE NOCASE AND deleted_at IS NULL
          AND role<>'admin'`,
        args: [username],
      })
    ).rows[0];
    if (!row)
      throw new ApiError(404, "Bu login topilmadi. Loginni administratoringizdan so‘rang.");
    if (row.password_hash !== null)
      throw new ApiError(409, "Bu login bilan allaqachon ro‘yxatdan o‘tilgan. «Kirish» bo‘limidan kiring.");
    if (body.password === undefined)
      return { member: { name: String(row.name), role: roleInfo[row.role as Role]?.label || "" } };
    const hash = passwordHash(newPassword(body.password));
    const now = new Date().toISOString();
    // Bir vaqtda ikki so‘rov kelsa, faqat birinchisi parol o‘rnatadi.
    const updated = await database.execute({
      sql: "UPDATE members SET password_hash=?,activated_at=? WHERE id=? AND password_hash IS NULL",
      args: [hash, now, row.id],
    });
    if (updated.rowsAffected !== 1)
      throw new ApiError(409, "Bu login bilan allaqachon ro‘yxatdan o‘tilgan. «Kirish» bo‘limidan kiring.");
    await createSession(String(row.id));
    return { user: publicAccount(row) };
  });
}
