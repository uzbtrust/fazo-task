import { cookies } from "next/headers";
import {
  checkPassword,
  passwordHash,
  requireUser,
  SESSION_COOKIE,
  tokenHash,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, newPassword, readBody } from "@/lib/server";
export const runtime = "nodejs";
export async function GET() {
  return api(async () => ({ user: await requireUser() }));
}
export async function PATCH(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    const body = await readBody(request);
    const next = newPassword(body.newPassword);
    const database = await db();
    const transaction = await database.transaction("write");
    try {
      const row = (
        await transaction.execute({
          sql: "SELECT password_hash FROM users WHERE id=?",
          args: [user.id],
        })
      ).rows[0];
      if (
        typeof body.currentPassword !== "string" ||
        !checkPassword(body.currentPassword, String(row.password_hash))
      )
        throw new ApiError(400, "Joriy parol noto‘g‘ri.");
      // Sign out every other device; this session stays.
      const token = (await cookies()).get(SESSION_COOKIE)?.value || "";
      await transaction.execute({
        sql: "DELETE FROM sessions WHERE user_id=? AND token_hash<>?",
        args: [user.id, tokenHash(token)],
      });
      await transaction.execute({
        sql: "UPDATE users SET password_hash=? WHERE id=?",
        args: [passwordHash(next), user.id],
      });
      await transaction.commit();
      return { user };
    } catch (error) {
      if (!transaction.closed) await transaction.rollback();
      throw error;
    }
  });
}
