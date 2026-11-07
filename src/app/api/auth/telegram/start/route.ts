import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { attemptLimit, clientIp } from "@/lib/auth";
import { api, ApiError, checkOrigin } from "@/lib/server";
import { telegramEnabled } from "@/lib/telegram/api";
import { botLink, createToken, deviceName } from "@/lib/telegram/accounts";
export const runtime = "nodejs";

/** Saytdagi «Telegram orqali kirish»: bot tasdiqlaydi, so‘rov esa shu brauzerga cookie bilan bog‘lanadi. */
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    if (!telegramEnabled()) throw new ApiError(404, "Telegram ulanmagan.");
    await attemptLimit([[`tg-start:${clientIp(request)}`, 20]]);
    const browser = randomBytes(24).toString("hex");
    const token = await createToken("web-login", { browser, device: deviceName(request.headers.get("user-agent")) });
    (await cookies()).set("fazo_tg_login", browser, {
      httpOnly: true,
      secure: !!process.env.VERCEL,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return { url: await botLink(`w_${token}`) };
  });
}
