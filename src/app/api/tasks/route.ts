import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, readBody } from "@/lib/server";
import { addEvent, fileIds, getTasks, linkFiles, linkUrls, saveLinks, taskFields } from "@/lib/tasks";
export const runtime = "nodejs";

export async function GET() {
  return api(async () => {
    const user = await requireUser("pm", "designer");
    // Dizayner faqat o‘zi olgan va hali hech kim olmagan vazifalarni ko‘radi.
    const filter = user.role === "designer" ? { visibleTo: user.id } : {};
    return { tasks: await getTasks(await db(), filter) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser("pm");
    const body = await readBody(request);
    const fields = taskFields(body);
    const files = fileIds(body.fileIds);
    const references = fileIds(body.referenceIds);
    const links = linkUrls(body.links);
    if (!fields.brief && !files.length)
      throw new ApiError(400, "TZ ni matn bilan yozing yoki fayl yuklang.");
    const database = await db();
    const id = randomUUID();
    const now = new Date().toISOString();
    const tx = await database.transaction("write");
    try {
      // Vazifa hech kimga biriktirilmaydi: ochiq vazifalar ro‘yxatiga tushadi.
      await tx.execute({
        sql: `INSERT INTO assignments(id,title,brief,image_count,priority,due_date,status,created_by,created_at,updated_at)
          VALUES (?,?,?,?,?,?,'todo',?,?,?)`,
        args: [
          id,
          fields.title,
          fields.brief,
          fields.imageCount,
          fields.priority,
          fields.dueDate,
          user.id,
          now,
          now,
        ],
      });
      await linkFiles(tx, id, files, user.id, "brief");
      await linkFiles(tx, id, references, user.id, "reference");
      await saveLinks(tx, id, links);
      await addEvent(tx, id, user.id, "created");
      await tx.commit();
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
    return { task: (await getTasks(database, { id }))[0] };
  }, 201);
}
