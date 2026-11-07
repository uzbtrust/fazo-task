import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin } from "@/lib/server";
import { unlinkMember } from "@/lib/telegram/accounts";
export const runtime = "nodejs";

/** Parolni tiklash: hodim yana «Ro‘yxatdan o‘tish» orqali yangi parol yaratadi. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    await requireUser("admin");
    const { id } = await context.params;
    const database = await db();
    const result = await database.execute({
      sql: `UPDATE members SET password_hash=NULL,activated_at=NULL
        WHERE id=? AND deleted_at IS NULL AND role<>'admin'`,
      args: [id],
    });
    if (result.rowsAffected !== 1) throw new ApiError(404, "Hodim topilmadi.");
    await database.execute({ sql: "DELETE FROM member_sessions WHERE member_id=?", args: [id] });
    await unlinkMember(id, "Parolingiz tiklandi. Yangi parol yarating va qayta kiring: /start");
    return { ok: true };
  });
}
