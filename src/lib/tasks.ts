import { randomUUID } from "node:crypto";
import type { Row, Database } from "./db";
import { ApiError, text } from "./server";
import type { Attachment, Priority, Task, TaskStatus, User } from "./types";

export function attachment(row: Record<string, unknown>): Attachment {
  return {
    id: String(row.id),
    name: String(row.name),
    size: Number(row.size),
    mime: String(row.mime),
    url: `/api/files/${row.id}`,
  };
}

export function taskFields(body: Record<string, unknown>) {
  const title = text(body.title, "Vazifa nomini", 160);
  const description = text(body.description, "Vazifani", 20000, false);
  const priority = body.priority ?? "medium";
  if (
    typeof priority !== "string" ||
    !["low", "medium", "high"].includes(priority)
  )
    throw new ApiError(400, "Muhimlik darajasi noto‘g‘ri.");
  const category = text(body.category ?? "Dizayn", "Formatni", 60);
  const dueDate =
    body.dueDate === undefined || body.dueDate === null || body.dueDate === ""
      ? null
      : body.dueDate;
  if (dueDate !== null) {
    if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
      throw new ApiError(400, "Muddat sanasi noto‘g‘ri.");
    const parsed = new Date(`${dueDate}T00:00:00Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== dueDate
    )
      throw new ApiError(400, "Muddat sanasi noto‘g‘ri.");
  }
  return {
    title,
    description,
    priority: priority as Priority,
    category,
    dueDate: dueDate as string | null,
  };
}

export function fileIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 10 ||
    value.some((x) => typeof x !== "string" || x.length > 64)
  )
    throw new ApiError(
      400,
      "Fayllar ro‘yxati noto‘g‘ri. Ko‘pi bilan 10 ta fayl tanlang.",
    );
  return [...new Set(value as string[])];
}

export async function linkFiles(
  database: Database,
  taskId: string,
  ids: string[],
  userId: string,
  kind: "brief" | "delivery",
) {
  for (const id of ids) {
    const row = (
      await database.execute({
        sql: "SELECT f.owner_id,tf.task_id FROM files f LEFT JOIN task_files tf ON tf.file_id=f.id WHERE f.id=?",
        args: [id],
      })
    ).rows[0];
    if (!row || row.owner_id !== userId)
      throw new ApiError(400, "Fayl topilmadi yoki sizga tegishli emas.");
    if (row.task_id)
      throw new ApiError(
        409,
        "Bu fayl allaqachon boshqa vazifaga biriktirilgan.",
      );
    await database.execute({
      sql: "INSERT INTO task_files(task_id,file_id,kind) VALUES (?,?,?)",
      args: [taskId, id, kind],
    });
  }
}

export async function addActivity(
  database: Database,
  taskId: string,
  userId: string,
  action: string,
  message = "",
) {
  await database.execute({
    sql: "INSERT INTO activity(id,task_id,user_id,action,message,created_at) VALUES (?,?,?,?,?,?)",
    args: [
      randomUUID(),
      taskId,
      userId,
      action,
      message,
      new Date().toISOString(),
    ],
  });
}

export function ownsTask(user: User, row: Row) {
  if (
    user.role !== "admin" &&
    (user.role !== "creator" || row.creator_id !== user.id)
  )
    throw new ApiError(
      403,
      "Bu vazifani faqat uni yaratgan kontent kreator yoki administrator boshqaradi.",
    );
}

export async function getTasks(
  database: Database,
  id?: string,
): Promise<Task[]> {
  const args = id ? [id] : [];
  const tasks = (
    await database.execute({
      sql: `SELECT * FROM tasks${id ? " WHERE id=?" : ""} ORDER BY number DESC`,
      args,
    })
  ).rows;
  if (!tasks.length) return [];
  const files = (
    await database.execute({
      sql: `SELECT f.id,f.name,f.size,f.mime,tf.task_id,tf.kind FROM task_files tf JOIN files f ON f.id=tf.file_id${id ? " WHERE tf.task_id=?" : ""}`,
      args,
    })
  ).rows;
  const comments = (
    await database.execute({
      sql: `SELECT c.*,u.name AS user_name FROM comments c JOIN users u ON u.id=c.user_id${id ? " WHERE c.task_id=?" : ""} ORDER BY c.created_at,c.rowid`,
      args,
    })
  ).rows;
  const activity = (
    await database.execute({
      sql: `SELECT a.*,u.name AS user_name FROM activity a JOIN users u ON u.id=a.user_id${id ? " WHERE a.task_id=?" : ""} ORDER BY a.created_at,a.rowid`,
      args,
    })
  ).rows;
  return tasks.map((row) => ({
    id: String(row.id),
    number: Number(row.number),
    title: String(row.title),
    description: String(row.description),
    priority: row.priority as Priority,
    category: String(row.category),
    dueDate: row.due_date ? String(row.due_date) : null,
    status: row.status as TaskStatus,
    creatorId: String(row.creator_id),
    assigneeId: row.assignee_id ? String(row.assignee_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    submissionText: String(row.submission_text),
    attachments: files
      .filter((f) => f.task_id === row.id && f.kind === "brief")
      .map(attachment),
    deliveryAttachments: files
      .filter((f) => f.task_id === row.id && f.kind === "delivery")
      .map(attachment),
    comments: comments
      .filter((c) => c.task_id === row.id)
      .map((c) => ({
        id: String(c.id),
        userId: String(c.user_id),
        userName: String(c.user_name),
        message: String(c.message),
        createdAt: String(c.created_at),
      })),
    activity: activity
      .filter((a) => a.task_id === row.id)
      .map((a) => ({
        id: String(a.id),
        userId: String(a.user_id),
        userName: String(a.user_name),
        action: String(a.action),
        message: String(a.message),
        createdAt: String(a.created_at),
      })),
  }));
}
