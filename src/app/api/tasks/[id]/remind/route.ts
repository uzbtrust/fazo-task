import { requireUser } from "@/lib/auth";
import { api, ApiError, checkOrigin } from "@/lib/server";
import { telegramEnabled } from "@/lib/telegram/api";
import { remindTask } from "@/lib/telegram/remind";
export const runtime = "nodejs";

/** PM dizaynerga bot orqali eslatadi. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser("pm");
    if (!telegramEnabled()) throw new ApiError(404, "Telegram ulanmagan.");
    const { id } = await context.params;
    return { sent: await remindTask(user, id) };
  });
}
