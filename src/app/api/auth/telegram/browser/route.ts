import { api, ApiError, checkOrigin, readBody } from "@/lib/server";
import { browserLink, createToken, telegramName, verifyInitData } from "@/lib/telegram/accounts";
export const runtime = "nodejs";

/** Web-app ichidan «Brauzer orqali kirish»: tashqi brauzer uchun bir martalik havola. */
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const user = verifyInitData((await readBody(request)).initData);
    if (!user) throw new ApiError(401, "Telegram ma’lumoti tasdiqlanmadi. Ilovani qayta oching.");
    const token = await createToken("browser", {
      telegram: { id: user.id, name: telegramName(user), username: user.username },
    });
    return { url: browserLink(token) };
  });
}
