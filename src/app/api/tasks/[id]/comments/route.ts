import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, readBody, text } from "@/lib/server";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    const { id: taskId } = await context.params;
    const body = await readBody(request);
    const message = text(body.message, "Izohni", 5000);
    const database = await db();
    const task = (
      await database.execute({
        sql: "SELECT id FROM tasks WHERE id=?",
        args: [taskId],
      })
    ).rows[0];
    if (!task) throw new ApiError(404, "Vazifa topilmadi.");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await database.execute({
      sql: "INSERT INTO comments(id,task_id,user_id,message,created_at) VALUES (?,?,?,?,?)",
      args: [id, taskId, user.id, message, createdAt],
    });
    return {
      comment: { id, userId: user.id, userName: user.name, message, createdAt },
    };
  }, 201);
}
