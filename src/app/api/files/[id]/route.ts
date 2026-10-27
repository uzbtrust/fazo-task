import { requireUser } from "@/lib/auth";
import { db, type Database } from "@/lib/db";
import { serveFile } from "@/lib/files";
import { api, ApiError, checkOrigin } from "@/lib/server";
import type { Account } from "@/lib/types";
export const runtime = "nodejs";

async function readable(database: Database, user: Account, id: string) {
  const row = (
    await database.execute({
      sql: `SELECT f.*,a.assignee_id,a.status FROM attachments f
        LEFT JOIN assignments a ON a.id=f.assignment_id WHERE f.id=?`,
      args: [id],
    })
  ).rows[0];
  // Bog‘lanmagan fayl faqat yuklagan odamga. Vazifa fayli PMga va vazifani olgan dizaynerga;
  // ochiq vazifaning TZ fayllari esa barcha dizaynerlarga (olishdan oldin o‘qish uchun).
  const openBrief =
    row?.status === "todo" && row.assignee_id === null && (row.kind === "brief" || row.kind === "reference");
  const allowed =
    row &&
    (row.assignment_id
      ? row.status !== null && (user.role === "pm" || row.assignee_id === user.id || openBrief)
      : row.owner_id === user.id);
  if (!allowed) throw new ApiError(404, "Fayl topilmadi.");
  return row;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const user = await requireUser("pm", "designer");
    const row = await readable(await db(), user, (await context.params).id);
    return serveFile(row, new URL(request.url).searchParams.has("download"));
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser("pm", "designer");
    const database = await db();
    const row = await readable(database, user, (await context.params).id);
    // TZ fayllari vazifani tahrirlash orqali o‘chiriladi; bu yerda — o‘z yuklamalari.
    if (row.owner_id !== user.id) throw new ApiError(403, "Bu faylni o‘chira olmaysiz.");
    if (row.kind === "result" && row.status !== "in_progress")
      throw new ApiError(409, "Topshirilgan ishni o‘zgartirib bo‘lmaydi.");
    if (row.kind !== "result" && row.assignment_id)
      throw new ApiError(409, "TZ va referens fayllarini vazifani tahrirlash orqali olib tashlang.");
    await database.execute({ sql: "DELETE FROM attachments WHERE id=?", args: [row.id] });
    return { ok: true };
  });
}
