import { requireUser } from "@/lib/auth";
import { db, passwordHash } from "@/lib/db";
import {
  allow,
  api,
  ApiError,
  checkOrigin,
  newPassword,
  publicUser,
  readBody,
  role,
  text,
} from "@/lib/server";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    allow(await requireUser(), ["admin"]);
    const { id } = await context.params;
    const body = await readBody(request);
    const database = await db();
    const tx = await database.transaction("write");
    try {
      const row = (
        await tx.execute({ sql: "SELECT * FROM users WHERE id=?", args: [id] })
      ).rows[0];
      if (!row) throw new ApiError(404, "Xodim topilmadi.");
      const nextRole = body.role === undefined ? row.role : role(body.role);
      const name =
        body.name === undefined
          ? String(row.name)
          : text(body.name, "Ismni", 80);
      if (body.active !== undefined && typeof body.active !== "boolean")
        throw new ApiError(400, "Faollik qiymati noto‘g‘ri.");
      const active =
        body.active === undefined ? Number(row.active) : Number(body.active);
      if (
        row.role === "admin" &&
        row.active &&
        (nextRole !== "admin" || !active)
      ) {
        const count = (
          await tx.execute(
            "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND active=1",
          )
        ).rows[0];
        if (Number(count.count) <= 1)
          throw new ApiError(
            409,
            "Oxirgi faol administratorni o‘chirib yoki rolini almashtirib bo‘lmaydi.",
          );
      }
      if (nextRole !== row.role || !active) {
        const busy = (
          await tx.execute({
            sql: "SELECT COUNT(*) AS count FROM tasks WHERE assignee_id=? AND status IN ('in_progress','in_review','approved')",
            args: [id],
          })
        ).rows[0];
        if (Number(busy.count) > 0 && (!active || nextRole !== "designer"))
          throw new ApiError(
            409,
            "Xodimda yakunlanmagan vazifalar bor. Avval ularni yakunlang yoki ishni qaytaring.",
          );
      }
      const hash =
        body.password === undefined
          ? String(row.password_hash)
          : passwordHash(newPassword(body.password));
      await tx.execute({
        sql: "UPDATE users SET name=?,role=?,active=?,password_hash=? WHERE id=?",
        args: [name, String(nextRole), active, hash, id],
      });
      if (!active || body.password !== undefined || nextRole !== row.role)
        await tx.execute({
          sql: "DELETE FROM sessions WHERE user_id=?",
          args: [id],
        });
      const updated = (
        await tx.execute({ sql: "SELECT * FROM users WHERE id=?", args: [id] })
      ).rows[0];
      await tx.commit();
      return { user: publicUser(updated) };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
  });
}
