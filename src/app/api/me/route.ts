import { cookies } from "next/headers";
import {
  checkPassword,
  passwordHash,
  requireUser,
  SESSION_COOKIE,
  tokenHash,
} from "@/lib/auth";
import { db } from "@/lib/db";
import {
  api,
  ApiError,
  checkOrigin,
  newPassword,
  publicUser,
  readBody,
  text,
} from "@/lib/server";
export const runtime = "nodejs";
export async function GET() {
  return api(async () => ({ user: await requireUser() }));
}
export async function PATCH(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    const body = await readBody(request);
    const database = await db();
    const transaction = await database.transaction("write");
    try {
      const row = (
        await transaction.execute({
          sql: "SELECT * FROM users WHERE id=?",
          args: [user.id],
        })
      ).rows[0];
      const name =
        body.name === undefined ? user.name : text(body.name, "Ismni", 80);
      let hash = String(row.password_hash);
      if (body.newPassword !== undefined) {
        const next = newPassword(body.newPassword);
        if (
          typeof body.currentPassword !== "string" ||
          !checkPassword(body.currentPassword, hash)
        )
          throw new ApiError(400, "Joriy parol noto‘g‘ri.");
        hash = passwordHash(next);
        const token = (await cookies()).get(SESSION_COOKIE)?.value || "";
        await transaction.execute({
          sql: "DELETE FROM sessions WHERE user_id=? AND token_hash<>?",
          args: [user.id, tokenHash(token)],
        });
      }
      await transaction.execute({
        sql: "UPDATE users SET name=?,password_hash=? WHERE id=?",
        args: [name, hash, user.id],
      });
      const updated = (
        await transaction.execute({
          sql: "SELECT * FROM users WHERE id=?",
          args: [user.id],
        })
      ).rows[0];
      await transaction.commit();
      return { user: publicUser(updated) };
    } catch (error) {
      if (!transaction.closed) await transaction.rollback();
      throw error;
    }
  });
}
