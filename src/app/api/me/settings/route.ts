import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { api, ApiError, checkOrigin, readBody } from "@/lib/server";
import { isTheme, setTheme } from "@/lib/settings";
import { refreshHomes } from "@/lib/telegram/home";
import { telegramEnabled } from "@/lib/telegram/api";
export const runtime = "nodejs";

/** Mavzu hisobga yoziladi: boshqa qurilma va bot rasmlari ham shu zahoti almashadi. */
export async function PUT(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    const { theme } = await readBody(request);
    if (theme !== null && !isTheme(theme)) throw new ApiError(400, "Mavzu noto‘g‘ri.");
    await setTheme(user.id, theme);
    if (telegramEnabled()) after(() => refreshHomes([user.id], true));
    return { theme };
  });
}
