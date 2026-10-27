import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, readBody } from "@/lib/server";
import { getTasks, requireEmployee, taskFields } from "@/lib/tasks";
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
    const current = (await getTasks(database, id))[0];
    if (!current) throw new ApiError(404, "Vazifa topilmadi.");
    // Partial update: unspecified fields keep their stored value.
    const fields = taskFields({ ...current, ...(await readBody(request)) });
    if (fields.assigneeId !== current.assigneeId)
      await requireEmployee(database, fields.assigneeId);
    const now = new Date().toISOString();
    const completedAt =
      fields.status !== "done" ? null : current.completedAt || now;
    await database.execute({
      sql: `UPDATE team_tasks SET title=?,description=?,priority=?,due_date=?,status=?,assignee_id=?,
        updated_at=?,completed_at=? WHERE id=?`,
      args: [
        fields.title,
        fields.description,
        fields.priority,
        fields.dueDate,
        fields.status,
        fields.assigneeId,
        now,
        completedAt,
        id,
      ],
    });
    return { task: (await getTasks(database, id))[0] };
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
    const result = await (await db()).execute({
      sql: "DELETE FROM team_tasks WHERE id=?",
      args: [id],
    });
    if (result.rowsAffected !== 1) throw new ApiError(404, "Vazifa topilmadi.");
    return { ok: true };
  });
}
