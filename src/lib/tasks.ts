import type { Database, Row } from "./db";
import { ApiError, text } from "./server";
import type { Employee, Priority, Task, TaskStatus } from "./types";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export function employeeFields(body: Record<string, unknown>) {
  return {
    name: text(body.name, "Hodim ismini", 80),
    position: text(body.position, "Lavozimni", 80, false),
  };
}

export function taskFields(body: Record<string, unknown>) {
  const title = text(body.title, "Vazifa nomini", 160);
  const description = text(body.description, "Tavsifni", 20000, false);
  const priority = body.priority ?? 1;
  if (
    typeof priority !== "number" || !Number.isInteger(priority) || priority < 1 || priority > 3
  )
    throw new ApiError(400, "Muhimlik 1 dan 3 gacha butun son bo‘lishi kerak.");
  const status = body.status ?? "todo";
  if (!STATUSES.includes(status as TaskStatus))
    throw new ApiError(400, "Vazifa holati noto‘g‘ri.");
  const assigneeId = body.assigneeId;
  if (typeof assigneeId !== "string" || !assigneeId || assigneeId.length > 64)
    throw new ApiError(400, "Vazifa uchun hodimni tanlang.");
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
    status: status as TaskStatus,
    assigneeId,
    dueDate: dueDate as string | null,
  };
}

export async function requireEmployee(database: Database, id: string) {
  const row = (
    await database.execute({
      sql: "SELECT id FROM employees WHERE id=? AND deleted_at IS NULL",
      args: [id],
    })
  ).rows[0];
  if (!row) throw new ApiError(400, "Tanlangan hodim topilmadi. Ro‘yxatni yangilang.");
}

export function employee(row: Row): Employee {
  return {
    id: String(row.id),
    name: String(row.name),
    position: String(row.position),
    createdAt: String(row.created_at),
  };
}

export async function getTasks(
  database: Database,
  id?: string,
): Promise<Task[]> {
  const rows = (
    await database.execute({
      sql: `SELECT t.*,e.name AS assignee_name FROM team_tasks t
        LEFT JOIN employees e ON e.id=t.assignee_id${id ? " WHERE t.id=?" : ""}
        ORDER BY t.number DESC`,
      args: id ? [id] : [],
    })
  ).rows;
  return rows.map((row) => ({
    id: String(row.id),
    number: Number(row.number),
    title: String(row.title),
    description: String(row.description),
    priority: Number(row.priority) as Priority,
    dueDate: row.due_date ? String(row.due_date) : null,
    status: row.status as TaskStatus,
    assigneeId: String(row.assignee_id),
    assigneeName: row.assignee_name ? String(row.assignee_name) : "Hodim",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  }));
}
