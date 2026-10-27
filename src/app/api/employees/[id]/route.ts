import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, readBody } from "@/lib/server";
import { employee, employeeFields } from "@/lib/tasks";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    await requireUser();
    const { id } = await context.params;
    const database = await db();
    const row = (
      await database.execute({
        sql: "SELECT * FROM employees WHERE id=? AND deleted_at IS NULL",
        args: [id],
      })
    ).rows[0];
    if (!row) throw new ApiError(404, "Hodim topilmadi.");
    const fields = employeeFields({
      name: row.name,
      position: row.position,
      ...(await readBody(request)),
    });
    await database.execute({
      sql: "UPDATE employees SET name=?,position=? WHERE id=?",
      args: [fields.name, fields.position, id],
    });
    const updated = (
      await database.execute({ sql: "SELECT * FROM employees WHERE id=?", args: [id] })
    ).rows[0];
    return { employee: employee(updated) };
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    await requireUser();
    const { id } = await context.params;
    const tx = await (await db()).transaction("write");
    try {
      const row = (
        await tx.execute({
          sql: "SELECT id FROM employees WHERE id=? AND deleted_at IS NULL",
          args: [id],
        })
      ).rows[0];
      if (!row) throw new ApiError(404, "Hodim topilmadi.");
      const open = Number(
        (
          await tx.execute({
            sql: "SELECT COUNT(*) AS count FROM team_tasks WHERE assignee_id=? AND status<>'done'",
            args: [id],
          })
        ).rows[0].count,
      );
      if (open > 0)
        throw new ApiError(
          409,
          `Hodimda ${open} ta tugallanmagan vazifa bor. Avval ularni boshqa hodimga o‘tkazing yoki o‘chiring.`,
        );
      // Soft delete keeps the name on completed tasks.
      await tx.execute({
        sql: "UPDATE employees SET deleted_at=? WHERE id=?",
        args: [new Date().toISOString(), id],
      });
      await tx.commit();
      return { ok: true };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
  });
}
