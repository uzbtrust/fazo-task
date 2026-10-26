import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, readBody, text } from "@/lib/server";
import {
  addActivity,
  fileIds,
  getTasks,
  linkFiles,
  ownsTask,
  taskFields,
} from "@/lib/tasks";
import type { TaskStatus } from "@/lib/types";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    await requireUser();
    const task = (await getTasks(await db(), (await context.params).id))[0];
    if (!task) throw new ApiError(404, "Vazifa topilmadi.");
    return { task };
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);
    const action = text(body.action, "Amalni", 40);
    const message = text(body.message, "Izohni", 20000, false);
    const database = await db();
    const tx = await database.transaction("write");
    try {
      const row = (
        await tx.execute({ sql: "SELECT * FROM tasks WHERE id=?", args: [id] })
      ).rows[0];
      if (!row) throw new ApiError(404, "Vazifa topilmadi.");
      const status = row.status as TaskStatus;
      const assigned = row.assignee_id === user.id && user.role === "designer";
      let next: TaskStatus = status;
      let assignee = row.assignee_id as string | null;
      let submission = String(row.submission_text);
      const mustBeAssigned = () => {
        if (!assigned)
          throw new ApiError(
            403,
            "Bu vazifani faqat uni olgan dizayner boshqaradi.",
          );
      };
      const mustHaveStatus = (...expected: TaskStatus[]) => {
        if (!expected.includes(status))
          throw new ApiError(
            409,
            "Vazifa holati o‘zgargan. Sahifani yangilang.",
          );
      };
      switch (action) {
        case "claim": {
          if (user.role !== "designer")
            throw new ApiError(403, "Vazifani faqat dizayner olishi mumkin.");
          if (status !== "open" || row.assignee_id)
            throw new ApiError(
              409,
              "Bu vazifani boshqa dizayner olgan yoki u yopilgan.",
            );
          next = "in_progress";
          assignee = user.id;
          break;
        }
        case "release":
          mustBeAssigned();
          mustHaveStatus("in_progress");
          next = "open";
          assignee = null;
          submission = "";
          break;
        case "submit": {
          mustBeAssigned();
          mustHaveStatus("in_progress");
          const ids = fileIds(body.fileIds);
          if (!message && !ids.length)
            throw new ApiError(
              400,
              "Tayyor ish uchun izoh yoki fayl kiriting.",
            );
          await linkFiles(tx, id, ids, user.id, "delivery");
          submission = message;
          next = "in_review";
          break;
        }
        case "approve":
          ownsTask(user, row);
          mustHaveStatus("in_review");
          next = "approved";
          break;
        case "request_changes":
          ownsTask(user, row);
          mustHaveStatus("in_review");
          if (!message)
            throw new ApiError(400, "Qanday tuzatish kerakligini yozing.");
          next = "in_progress";
          break;
        case "complete":
          mustBeAssigned();
          mustHaveStatus("approved");
          next = "completed";
          break;
        case "cancel":
          ownsTask(user, row);
          mustHaveStatus("open", "in_progress");
          next = "cancelled";
          break;
        case "edit": {
          ownsTask(user, row);
          mustHaveStatus("open");
          const fields = taskFields({
            title: row.title,
            description: row.description,
            priority: row.priority,
            category: row.category,
            dueDate: row.due_date,
            ...body,
          });
          const ids = fileIds(body.fileIds);
          const existing = (
            await tx.execute({
              sql: "SELECT COUNT(*) AS count FROM task_files WHERE task_id=? AND kind='brief'",
              args: [id],
            })
          ).rows[0];
          if (
            !fields.description &&
            !ids.length &&
            Number(existing.count) === 0
          )
            throw new ApiError(
              400,
              "Vazifa matnini kiriting yoki fayl biriktiring.",
            );
          await linkFiles(tx, id, ids, user.id, "brief");
          await tx.execute({
            sql: "UPDATE tasks SET title=?,description=?,priority=?,category=?,due_date=? WHERE id=?",
            args: [
              fields.title,
              fields.description,
              fields.priority,
              fields.category,
              fields.dueDate,
              id,
            ],
          });
          break;
        }
        default:
          throw new ApiError(400, "Bunday amal mavjud emas.");
      }
      const updated = await tx.execute({
        sql: "UPDATE tasks SET status=?,assignee_id=?,submission_text=?,updated_at=? WHERE id=? AND status=? AND (assignee_id IS ?)",
        args: [
          next,
          assignee,
          submission,
          new Date().toISOString(),
          id,
          status,
          row.assignee_id,
        ],
      });
      if (updated.rowsAffected !== 1)
        throw new ApiError(
          409,
          "Vazifani boshqa xodim o‘zgartirdi. Sahifani yangilang.",
        );
      await addActivity(tx, id, user.id, action, message);
      await tx.commit();
      return { task: (await getTasks(database, id))[0] };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
  });
}
