import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { api, ApiError, checkOrigin, readBody } from "@/lib/server";
import { runTaskAction } from "@/lib/task-actions";
import { telegramEnabled } from "@/lib/telegram/api";
import { refreshHomes } from "@/lib/telegram/home";
import { dropNotices } from "@/lib/telegram/screens";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser("pm", "designer");
    const { id } = await context.params;
    return { task: await runTaskAction(user, id, await readBody(request)) };
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    checkOrigin(request);
    await requireUser("pm");
    const { id } = await context.params;
    const result = await (await db()).batch(
      [
        { sql: "DELETE FROM assignments WHERE id=?", args: [id] },
        { sql: "DELETE FROM attachments WHERE assignment_id=?", args: [id] },
        { sql: "DELETE FROM assignment_events WHERE assignment_id=?", args: [id] },
        { sql: "DELETE FROM assignment_links WHERE assignment_id=?", args: [id] },
      ],
      "write",
    );
    if (result[0].rowsAffected !== 1) throw new ApiError(404, "Vazifa topilmadi.");
    if (telegramEnabled())
      after(async () => {
        await dropNotices(id);
        await refreshHomes();
      });
    return { ok: true };
  });
}
