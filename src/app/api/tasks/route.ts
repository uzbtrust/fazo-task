import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { allow, api, ApiError, checkOrigin, readBody } from "@/lib/server";
import {
  addActivity,
  fileIds,
  getTasks,
  linkFiles,
  taskFields,
} from "@/lib/tasks";
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
    const user = await requireUser();
    allow(user, ["admin", "creator"]);
    const body = await readBody(request);
    const fields = taskFields(body);
    const ids = fileIds(body.fileIds);
    if (!fields.description && !ids.length)
      throw new ApiError(400, "Vazifa matnini kiriting yoki fayl biriktiring.");
    const id = randomUUID();
    const now = new Date().toISOString();
    const database = await db();
    const tx = await database.transaction("write");
    try {
      await tx.execute({
        sql: "INSERT INTO tasks(id,title,description,priority,category,due_date,creator_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        args: [
          id,
          fields.title,
          fields.description,
          fields.priority,
          fields.category,
          fields.dueDate,
          user.id,
          now,
          now,
        ],
      });
      await linkFiles(tx, id, ids, user.id, "brief");
      await addActivity(tx, id, user.id, "created");
      await tx.commit();
      return { task: (await getTasks(database, id))[0] };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
  }, 201);
}
