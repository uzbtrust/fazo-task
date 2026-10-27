import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FILE_TYPES, MAX_FILE } from "@/lib/files";
import { api, ApiError, checkOrigin } from "@/lib/server";
import { fileMeta } from "@/lib/tasks";
import type { Row } from "@/lib/db";
export const runtime = "nodejs";

/**
 * PM: TZ fayli — hali vazifaga bog‘lanmagan holda yuklanadi, vazifa saqlanganda bog‘lanadi.
 * Dizayner: tayyor ish — `assignmentId` bilan to‘g‘ridan-to‘g‘ri o‘z vazifasiga yuklanadi.
 */
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser("pm", "designer");
    if (Number(request.headers.get("content-length") || 0) > MAX_FILE + 64 * 1024)
      throw new ApiError(413, "Fayl 4 MB dan oshmasligi kerak.");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Faylni tanlang.");
    if (!file.size) throw new ApiError(400, "Bo‘sh faylni yuklab bo‘lmaydi.");
    if (file.size > MAX_FILE) throw new ApiError(413, "Fayl 4 MB dan oshmasligi kerak.");
    const name = file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 180);
    const mime = FILE_TYPES[name.split(".").pop()?.toLowerCase() || ""];
    if (!mime)
      throw new ApiError(400, "Bu fayl turi qo‘llab-quvvatlanmaydi. Rasm, PDF, Word yoki dizayn faylini yuklang.");
    const database = await db();
    const assignmentId = form.get("assignmentId");
    let kind: "brief" | "result" = "brief";
    if (user.role === "designer") {
      if (typeof assignmentId !== "string") throw new ApiError(400, "Vazifa ko‘rsatilmagan.");
      const task = (
        await database.execute({
          sql: "SELECT status FROM assignments WHERE id=? AND assignee_id=?",
          args: [assignmentId, user.id],
        })
      ).rows[0];
      if (!task) throw new ApiError(404, "Vazifa topilmadi.");
      if (task.status !== "in_progress")
        throw new ApiError(409, "Rasmlarni ish jarayonida yuklash mumkin. Avval ishni boshlang.");
      kind = "result";
    } else {
      // Tashlab ketilgan yuklamalar bir kundan keyin tozalanadi.
      await database.execute({
        sql: "DELETE FROM attachments WHERE owner_id=? AND assignment_id IS NULL AND created_at<?",
        args: [user.id, new Date(Date.now() - 864e5).toISOString()],
      });
    }
    const id = randomUUID();
    const row = {
      id,
      kind,
      name,
      size: file.size,
      mime,
      owner_id: user.id,
    };
    await database.execute({
      sql: `INSERT INTO attachments(id,assignment_id,owner_id,kind,name,size,mime,data,created_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [
        id,
        kind === "result" ? (assignmentId as string) : null,
        user.id,
        kind,
        name,
        file.size,
        mime,
        Buffer.from(await file.arrayBuffer()).toString("base64"),
        new Date().toISOString(),
      ],
    });
    return { file: fileMeta(row as unknown as Row) };
  }, 201);
}
