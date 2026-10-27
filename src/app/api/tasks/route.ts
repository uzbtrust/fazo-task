import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, checkOrigin, readBody } from "@/lib/server";
import { getTasks, requireEmployee, taskFields } from "@/lib/tasks";
export const runtime = "nodejs";

export async function GET() {
  return api(async () => {
    await requireUser();
    return { tasks: await getTasks(await db()) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    await requireUser();
    const fields = taskFields(await readBody(request));
    const database = await db();
    await requireEmployee(database, fields.assigneeId);
    const id = randomUUID();
    const now = new Date().toISOString();
    await database.execute({
      sql: `INSERT INTO team_tasks(id,title,description,priority,due_date,status,assignee_id,created_at,updated_at,completed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id,
        fields.title,
        fields.description,
        fields.priority,
        fields.dueDate,
        fields.status,
        fields.assigneeId,
        now,
        now,
        fields.status === "done" ? now : null,
      ],
    });
    return { task: (await getTasks(database, id))[0] };
  }, 201);
}
