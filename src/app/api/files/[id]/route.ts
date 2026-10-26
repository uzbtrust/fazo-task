import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError } from "@/lib/server";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const row = (
      await (
        await db()
      ).execute({
        sql: "SELECT f.*,tf.task_id FROM files f LEFT JOIN task_files tf ON tf.file_id=f.id WHERE f.id=?",
        args: [id],
      })
    ).rows[0];
    if (
      !row ||
      (row.owner_id !== user.id && !row.task_id && user.role !== "admin")
    )
      throw new ApiError(404, "Fayl topilmadi.");
    const name = String(row.name);
    const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
    return new Response(Buffer.from(String(row.data), "base64"), {
      headers: {
        "Content-Type": String(row.mime),
        "Content-Length": String(row.size),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  });
}
