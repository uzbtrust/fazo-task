import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin } from "@/lib/server";
import { attachment } from "@/lib/tasks";
export const runtime = "nodejs";

const MAX_FILE = 3 * 1024 * 1024;
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  zip: "application/zip",
  psd: "image/vnd.adobe.photoshop",
  ai: "application/postscript",
  fig: "application/octet-stream",
  sketch: "application/octet-stream",
  eps: "application/postscript",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    if (Number(request.headers.get("content-length") || 0) > MAX_FILE + 100000)
      throw new ApiError(413, "Fayl 3 MB dan oshmasligi kerak.");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Faylni tanlang.");
    if (!file.size) throw new ApiError(400, "Bo‘sh faylni yuklab bo‘lmaydi.");
    if (file.size > MAX_FILE)
      throw new ApiError(413, "Fayl 3 MB dan oshmasligi kerak.");
    const name = file.name
      .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
      .slice(0, 180);
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const mime = TYPES[ext];
    if (!mime)
      throw new ApiError(
        400,
        "Bu fayl turi qo‘llab-quvvatlanmaydi. Rasm, PDF, matn, dizayn yoki ZIP fayl yuklang.",
      );
    const database = await db();
    // Remove abandoned uploads after a day. Files attached to tasks are kept.
    await database.execute({
      sql: "DELETE FROM files WHERE owner_id=? AND created_at<? AND id NOT IN (SELECT file_id FROM task_files)",
      args: [user.id, new Date(Date.now() - 86400000).toISOString()],
    });
    const id = randomUUID();
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const tx = await database.transaction("write");
    try {
      const storage = (
        await tx.execute({
          sql: "SELECT COALESCE(SUM(size),0) AS bytes FROM files WHERE owner_id=?",
          args: [user.id],
        })
      ).rows[0];
      if (Number(storage.bytes) + file.size > 100 * 1024 * 1024)
        throw new ApiError(
          413,
          "Hisobingiz uchun 100 MB fayl chegarasiga yetildi.",
        );
      await tx.execute({
        sql: "INSERT INTO files(id,owner_id,name,size,mime,data,created_at) VALUES (?,?,?,?,?,?,?)",
        args: [
          id,
          user.id,
          name,
          file.size,
          mime,
          data,
          new Date().toISOString(),
        ],
      });
      await tx.commit();
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
    return { file: attachment({ id, name, size: file.size, mime }) };
  }, 201);
}
